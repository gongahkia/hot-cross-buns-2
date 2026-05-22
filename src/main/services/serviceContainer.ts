import { createAppSqliteConnection, type SqliteConnection } from "../data/sqliteConnection";
import { runLocalDataMigrations, type MigrationResult } from "../data/migrations";
import {
  LocalPerformanceRepository,
  LocalPlannerRepository,
  LocalSettingsRepository
} from "../data/localRepositories";
import { McpToolRegistry } from "../mcp/toolRegistry";
import { GoogleSyncRepository } from "../sync/readSyncRepository";
import { markStartupTiming } from "../startupTiming";
import type { AppDomainServices } from "./domainInterfaces";
import { createSqliteDomainServices } from "./sqliteDomainServices";

export interface LocalDataService {
  status: "ready";
  connection: SqliteConnection;
  migrations: MigrationResult;
  plannerRepository: LocalPlannerRepository;
  settingsRepository: LocalSettingsRepository;
  syncRepository: GoogleSyncRepository;
  performanceRepository: LocalPerformanceRepository;
}

export interface ServiceContainer {
  domain: AppDomainServices;
  localData: LocalDataService;
  performance: LocalPerformanceRepository;
  mcpTools: McpToolRegistry;
  close: () => void;
}

export interface ServiceContainerOptions {
  appSupportDirectory: string;
  databaseFilename?: string;
}

export function createServiceContainer(options: ServiceContainerOptions): ServiceContainer {
  const connection = createAppSqliteConnection({
    appSupportDirectory: options.appSupportDirectory,
    filename: options.databaseFilename
  });
  const migrations = runLocalDataMigrations(connection);
  const performanceRepository = new LocalPerformanceRepository(connection);
  const plannerRepository = new LocalPlannerRepository(connection, performanceRepository);
  const settingsRepository = new LocalSettingsRepository(connection);
  const syncRepository = new GoogleSyncRepository(connection);
  const domain = createSqliteDomainServices({
    plannerRepository,
    settingsRepository,
    syncRepository
  });

  markStartupTiming("databaseReadyMs");
  performanceRepository.record({
    kind: "startup",
    name: "database.migrations",
    durationMs: migrations.durationMs,
    metadata: {
      version: migrations.version,
      appliedCount: migrations.appliedVersions.length
    }
  });

  return {
    domain,
    localData: {
      status: "ready",
      connection,
      migrations,
      plannerRepository,
      settingsRepository,
      syncRepository,
      performanceRepository
    },
    performance: performanceRepository,
    mcpTools: new McpToolRegistry(domain.mcpTools),
    close: () => {
      connection.close();
    }
  };
}
