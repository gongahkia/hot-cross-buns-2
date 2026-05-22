import type { SqliteConnection, SqliteWriteOperation } from "./sqliteConnection";

export interface MigrationResult {
  version: number;
  appliedVersions: number[];
  durationMs: number;
}

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "local app tables",
    sql: `
CREATE TABLE IF NOT EXISTS local_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  linked_task_id TEXT,
  linked_event_id TEXT,
  linked_list_id TEXT,
  linked_calendar_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_local_notes_updated
  ON local_notes(deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_local_notes_title
  ON local_notes(deleted_at, title);

CREATE TABLE IF NOT EXISTS local_settings (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(scope, key)
);

CREATE TABLE IF NOT EXISTS local_performance_timings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_ms REAL NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_performance_timings_recent
  ON local_performance_timings(created_at DESC, kind);
`
  },
  {
    version: 2,
    name: "local notes fts index",
    sql: `
CREATE VIRTUAL TABLE IF NOT EXISTS local_notes_fts
  USING fts5(title, body, content='local_notes', content_rowid='rowid');

CREATE TABLE IF NOT EXISTS local_search_index_state (
  name TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS local_notes_fts_ai
AFTER INSERT ON local_notes
BEGIN
  INSERT INTO local_notes_fts(rowid, title, body)
  VALUES (new.rowid, new.title, new.body);
END;

CREATE TRIGGER IF NOT EXISTS local_notes_fts_ad
AFTER DELETE ON local_notes
BEGIN
  INSERT INTO local_notes_fts(local_notes_fts, rowid, title, body)
  VALUES ('delete', old.rowid, old.title, old.body);
END;

CREATE TRIGGER IF NOT EXISTS local_notes_fts_au
AFTER UPDATE ON local_notes
BEGIN
  INSERT INTO local_notes_fts(local_notes_fts, rowid, title, body)
  VALUES ('delete', old.rowid, old.title, old.body);
  INSERT INTO local_notes_fts(rowid, title, body)
  VALUES (new.rowid, new.title, new.body);
END;

INSERT INTO local_notes_fts(local_notes_fts) VALUES ('rebuild');
`
  }
];

export function runLocalDataMigrations(connection: SqliteConnection): MigrationResult {
  const startedAt = Date.now();

  connection.exec(`
CREATE TABLE IF NOT EXISTS local_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`);

  const appliedRows = connection.query<{ version: number }>(
    "SELECT version FROM local_schema_migrations;"
  );
  const applied = new Set(appliedRows.map((row) => row.version));
  const appliedVersions: number[] = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }

    const now = new Date().toISOString();
    const operations: SqliteWriteOperation[] = [
      {
        kind: "exec",
        sql: migration.sql
      },
      {
        kind: "run",
        sql: `INSERT INTO local_schema_migrations (version, name, applied_at)
              VALUES (?, ?, ?);`,
        params: [migration.version, migration.name, now]
      }
    ];

    connection.executeTransaction(operations);
    appliedVersions.push(migration.version);
  }

  return {
    version: MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0,
    appliedVersions,
    durationMs: Math.max(0, Date.now() - startedAt)
  };
}
