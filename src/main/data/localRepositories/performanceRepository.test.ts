import { describe, expect, it } from "vitest";
import { runLocalDataMigrations } from "../migrations";
import { createTemporarySqliteConnection } from "../sqliteConnection";
import { LocalPerformanceRepository } from "./performanceRepository";

describe("local performance repository", () => {
  it("roundtrips sanitized timing metadata", () => {
    const temporary = createTemporarySqliteConnection("hcb2-performance-repository-");

    try {
      runLocalDataMigrations(temporary.connection);
      const repository = new LocalPerformanceRepository(temporary.connection);

      repository.record({
        kind: "startup",
        name: "startup.bootstrap.get",
        durationMs: 12.345,
        metadata: {
          outcome: "used",
          payloadBytes: 1234,
          accepted: true,
          token: "secret-value"
        },
        createdAt: "2026-06-06T00:00:00.000Z"
      });

      expect(repository.listRecent(1)).toEqual([
        {
          id: expect.any(Number),
          kind: "startup",
          name: "startup.bootstrap.get",
          durationMs: 12.35,
          metadata: {
            "[redacted]": "[redacted]",
            outcome: "used",
            payloadBytes: 1234,
            accepted: true
          },
          createdAt: "2026-06-06T00:00:00.000Z"
        }
      ]);
    } finally {
      temporary.cleanup();
    }
  });
});
