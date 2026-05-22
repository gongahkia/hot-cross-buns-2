import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServiceContainer } from "./serviceContainer";

describe("service container integration", () => {
  it("shares domain services between MCP tool handlers and planner IPC services", async () => {
    const appSupportDirectory = mkdtempSync(join(tmpdir(), "hcb2-service-container-"));
    const services = createServiceContainer({
      appSupportDirectory
    });

    try {
      const created = await services.mcpTools.callTool(
        "hcb_create_note",
        {
          title: "MCP shared note",
          body: "Body stays inside the SQLite-backed domain service."
        },
        {
          permissionMode: "allow-writes",
          credentialRevision: "test-revision",
          clientKey: "test-client",
          now: new Date("2026-05-22T00:00:00.000Z")
        }
      );
      const search = await services.domain.planner.search({
        query: "MCP shared note",
        domains: ["notes"],
        limit: 10
      });

      expect(created).toMatchObject({
        applied: true,
        item: {
          kind: "note",
          title: "MCP shared note"
        }
      });
      expect(search.items).toContainEqual(
        expect.objectContaining({
          domain: "notes",
          title: "MCP shared note"
        })
      );
    } finally {
      services.close();
      rmSync(appSupportDirectory, { recursive: true, force: true });
    }
  });
});
