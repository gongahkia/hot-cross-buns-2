import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_TASKS_SCOPE,
  sanitizeGoogleAccountConnectionStatus,
  type GoogleCalendarReadTransport,
  type GoogleCalendarWriteTransport,
  type GoogleTasksReadTransport,
  type GoogleTasksWriteTransport
} from "../google";
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

  it("keeps runtime Google writes disabled when explicitly configured read-only", async () => {
    const appSupportDirectory = mkdtempSync(join(tmpdir(), "hcb2-service-runtime-readonly-"));
    let createdTaskId: string | undefined;
    const tasksRead: GoogleTasksReadTransport = {
      listTaskLists: vi.fn(async () => [
        {
          id: "inbox",
          title: "Inbox",
          updatedAt: "2026-05-22T00:00:00.000Z"
        }
      ]),
      listTasks: vi.fn(async () => ({
        tasks: createdTaskId
          ? [
              {
                id: createdTaskId,
                taskListId: "inbox",
                title: "Queued but not pushed",
                notes: "",
                status: "needsAction" as const,
                dueAt: null,
                completedAt: null,
                deleted: false,
                hidden: false,
                updatedAt: "2026-05-22T00:00:00.000Z"
              }
            ]
          : [],
        serverDate: "2026-05-22T00:00:00.000Z"
      }))
    };
    const calendarRead: GoogleCalendarReadTransport = {
      listCalendarLists: vi.fn(async () => []),
      listEvents: vi.fn(async () => ({ events: [], nextSyncToken: null }))
    };
    const services = createServiceContainer({
      appSupportDirectory,
      enableRuntimeGoogle: true,
      enableRuntimeGoogleWrites: false,
      syncTasksTransport: tasksRead,
      syncCalendarTransport: calendarRead
    });

    try {
      services.localData.syncRepository.upsertAccountStatus(
        sanitizeGoogleAccountConnectionStatus({
          accountId: "acct-1",
          googleAccountId: "acct-1",
          email: "planner@example.com",
          connectionState: "connected",
          grantedScopes: [GOOGLE_TASKS_SCOPE, GOOGLE_CALENDAR_SCOPE],
          lastAuthenticatedAt: "2026-05-22T00:00:00.000Z",
          updatedAt: "2026-05-22T00:00:00.000Z"
        })
      );
      services.localData.syncRepository.writeTaskLists(
        "acct-1",
        [{ id: "inbox", title: "Inbox", updatedAt: "2026-05-22T00:00:00.000Z" }],
        "2026-05-22T00:00:00.000Z"
      );

      const created = await services.domain.planner.createTask({
        title: "Queued but not pushed",
        listId: "acct-1:task-list:inbox"
      });
      createdTaskId = created.id;

      await services.domain.sync.runNow({ resources: ["tasks"] });

      expect(
        services.localData.connection.get<{ status: string }>(
          "SELECT status FROM google_pending_mutations WHERE resource_id = ?;",
          [created.id]
        )
      ).toEqual({ status: "pending" });
    } finally {
      services.close();
      rmSync(appSupportDirectory, { recursive: true, force: true });
    }
  });

  it("drains queued Google mutations from sync.runNow when write transports are configured", async () => {
    const appSupportDirectory = mkdtempSync(join(tmpdir(), "hcb2-service-sync-worker-"));
    const tasks: GoogleTasksWriteTransport = {
      insertTaskList: vi.fn(async (title) => ({
        id: "remote-list",
        title,
        updatedAt: "2026-05-22T00:00:00.000Z"
      })),
      updateTaskList: vi.fn(async ({ taskListId, title }) => ({
        id: taskListId,
        title,
        updatedAt: "2026-05-22T00:00:00.000Z"
      })),
      deleteTaskList: vi.fn(async () => undefined),
      insertTask: vi.fn(async (taskListId, input) => ({
        id: "remote-task-from-container",
        taskListId,
        title: input.title,
        notes: input.notes ?? null,
        status: "needsAction" as const,
        dueAt: input.dueDate ? `${input.dueDate}T00:00:00.000Z` : null,
        deleted: false,
        hidden: false,
        updatedAt: "2026-05-22T00:00:00.000Z",
        etag: "remote-task-etag"
      })),
      updateTask: vi.fn(async (input) => ({
        id: input.taskId,
        taskListId: input.taskListId,
        title: input.title ?? "Updated task",
        status: input.status ?? "needsAction" as const,
        deleted: false,
        hidden: false,
        updatedAt: "2026-05-22T00:00:00.000Z"
      })),
      setTaskCompleted: vi.fn(async (request) => ({
        id: request.taskId,
        taskListId: request.taskListId,
        title: "Task",
        status: request.completed ? "completed" as const : "needsAction" as const,
        completedAt: request.completed ? "2026-05-22T00:00:00.000Z" : null,
        deleted: false,
        hidden: false,
        updatedAt: "2026-05-22T00:00:00.000Z"
      })),
      moveTask: vi.fn(async (input) => ({
        id: input.taskId,
        taskListId: input.taskListId,
        title: "Moved task",
        status: "needsAction" as const,
        deleted: false,
        hidden: false,
        updatedAt: "2026-05-22T00:00:00.000Z"
      })),
      deleteTask: vi.fn(async () => undefined)
    };
    const calendar: GoogleCalendarWriteTransport = {
      insertEvent: vi.fn(async () => {
        throw new Error("Calendar writes are not used in this test.");
      }),
      updateEvent: vi.fn(async () => {
        throw new Error("Calendar writes are not used in this test.");
      }),
      deleteEvent: vi.fn(async () => undefined)
    };
    const services = createServiceContainer({
      appSupportDirectory,
      syncTasksWriteTransport: tasks,
      syncCalendarWriteTransport: calendar
    });

    try {
      services.localData.syncRepository.upsertAccountStatus(
        sanitizeGoogleAccountConnectionStatus({
          accountId: "acct-1",
          googleAccountId: "acct-1",
          email: "planner@example.com",
          connectionState: "connected",
          grantedScopes: [GOOGLE_TASKS_SCOPE, GOOGLE_CALENDAR_SCOPE],
          lastAuthenticatedAt: "2026-05-22T00:00:00.000Z",
          updatedAt: "2026-05-22T00:00:00.000Z"
        })
      );
      services.localData.syncRepository.writeTaskLists(
        "acct-1",
        [{ id: "inbox", title: "Inbox", updatedAt: "2026-05-22T00:00:00.000Z" }],
        "2026-05-22T00:00:00.000Z"
      );

      const created = await services.domain.planner.createTask({
        title: "Container queued task",
        listId: "acct-1:task-list:inbox"
      });

      await services.domain.sync.runNow({ resources: ["tasks"] });

      expect(tasks.insertTask).toHaveBeenCalledWith(
        "inbox",
        expect.objectContaining({
          title: "Container queued task"
        })
      );
      expect(
        services.localData.connection.get<{ status: string }>(
          "SELECT status FROM google_pending_mutations WHERE resource_id = ?;",
          [created.id]
        )
      ).toEqual({ status: "applied" });
    } finally {
      services.close();
      rmSync(appSupportDirectory, { recursive: true, force: true });
    }
  });
});
