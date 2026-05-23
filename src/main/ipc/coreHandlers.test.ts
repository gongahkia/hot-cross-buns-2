import { describe, expect, it } from "vitest";
import {
  HCB_IPC_VERSION,
  type HcbDomain
} from "@shared/ipc/contracts";
import { createPlaceholderDomainServices } from "../services/placeholderDomainServices";
import { createCoreIpcHandlers } from "./coreHandlers";
import { createIpcDispatcher } from "./registry";

describe("core IPC handlers", () => {
  it("routes planner reads through the shared domain services", async () => {
    const dispatch = createIpcDispatcher(createCoreIpcHandlers(createPlaceholderDomainServices()));

    const result = await dispatch(
      {},
      envelope("tasks", "list", {
        status: "active",
        limit: 2
      })
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        page: {
          limit: 2,
          totalKnown: expect.any(Number)
        }
      }
    });
    expect(JSON.stringify(result)).not.toContain("NOT_IMPLEMENTED");
  });

  it("routes schedule suggestions through planner services", async () => {
    const dispatch = createIpcDispatcher(createCoreIpcHandlers(createPlaceholderDomainServices()));

    const result = await dispatch(
      {},
      envelope("calendar", "scheduleSuggest", {
        date: "2026-05-22"
      })
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        slots: expect.any(Array),
        unscheduled: expect.any(Array),
        overloadMinutes: expect.any(Number)
      }
    });
  });

  it("keeps sync and MCP controls sanitized and non-blocking", async () => {
    const dispatch = createIpcDispatcher(createCoreIpcHandlers(createPlaceholderDomainServices()));

    const sync = await dispatch(
      {},
      envelope("sync", "runNow", {
        resources: ["tasks"],
        dryRun: true
      })
    );
    const mcp = await dispatch(
      {},
      envelope("mcp", "setEnabled", {
        enabled: true
      })
    );

    expect(sync).toMatchObject({
      ok: true,
      data: {
        accepted: true,
        dryRun: true,
        resources: ["tasks"]
      }
    });
    expect(mcp).toMatchObject({
      ok: true,
      data: {
        enabled: true,
        running: false,
        url: "http://127.0.0.1"
      }
    });
    expect(JSON.stringify({ sync, mcp })).not.toMatch(
      /fake-access-token|fake-refresh-token|fake-mcp-token|Bearer\s+[A-Za-z0-9._~+/=-]+|secret=/i
    );
  });

  it("routes onboarding completion and reset through settings IPC without planner deletion", async () => {
    const dispatch = createIpcDispatcher(createCoreIpcHandlers(createPlaceholderDomainServices()));
    const completedAt = "2026-05-22T00:00:00.000Z";
    const update = await dispatch(
      {},
      envelope("settings", "update", {
        setupCompletedAt: completedAt,
        selectedTaskListIds: ["list-inbox"],
        selectedCalendarIds: ["cal-product"],
        syncMode: "manual",
        notificationsEnabled: false,
        mcpEnabled: false
      })
    );
    const reset = await dispatch({}, envelope("settings", "recoveryAction", { action: "resetOnboarding" }));
    const settings = await dispatch({}, envelope("settings", "get", {}));

    expect(update).toMatchObject({
      ok: true,
      data: {
        setupCompletedAt: completedAt,
        syncMode: "manual"
      }
    });
    expect(reset).toMatchObject({
      ok: true,
      data: {
        action: "resetOnboarding",
        accepted: true,
        destructive: false,
        requiresReload: false
      }
    });
    expect(settings).toMatchObject({
      ok: true,
      data: {
        setupCompletedAt: null
      }
    });
  });
});

function envelope(domain: HcbDomain, method: string, request: unknown) {
  return {
    version: HCB_IPC_VERSION,
    domain,
    method,
    request
  };
}
