import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import type { CalendarEventDetail, TaskDetail } from "./src/shared/ipc/contracts";
import type { HcbApi } from "./src/shared/ipc/preloadApi";
import { ok } from "./src/shared/ipc/result";

const now = new Date("2026-05-22T00:00:00.000Z").toISOString();
const later = new Date("2026-05-22T01:00:00.000Z").toISOString();

function testTask(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: "test-task",
    listId: "test-list",
    title: "Test task",
    status: "active" as const,
    updatedAt: now,
    priority: "none" as const,
    dueAt: null,
    notes: "",
    parentId: null,
    ...overrides
  };
}

function testCalendarEvent(overrides: Partial<CalendarEventDetail> = {}): CalendarEventDetail {
  return {
    id: "test-event",
    calendarId: "test-calendar",
    title: "Test event",
    startsAt: now,
    endsAt: later,
    allDay: false,
    updatedAt: now,
    calendarTitle: "Test calendar",
    deepLink: "hotcrossbuns://calendar/test-event",
    location: "",
    notes: "",
    guestEmails: [],
    reminderMinutes: [],
    ...overrides
  };
}

const hcbApi: HcbApi = {
  tasks: {
    listTaskLists: vi.fn(async (request = {}) =>
      ok({
        items: [],
        page: {
          limit: request.limit ?? 50,
          totalKnown: 0
        }
      })
    ),
    list: vi.fn(async (request = {}) =>
      ok({
        items: [],
        page: {
          limit: request.limit ?? 50,
          totalKnown: 0
        }
      })
    ),
    get: vi.fn(async (request) =>
      ok(testTask({ id: request.id }))
    ),
    create: vi.fn(async (request) =>
      ok(testTask({
        id: "task-created",
        listId: request.listId,
        title: request.title,
        notes: request.notes,
        parentId: request.parentId ?? null,
        priority: request.priority ?? "none"
      }))
    ),
    update: vi.fn(async (request) =>
      ok(testTask({
        id: request.id,
        title: request.title ?? "Updated task",
        notes: request.notes ?? "",
        listId: request.listId ?? "test-list",
        parentId: request.parentId ?? null,
        priority: request.priority ?? "none"
      }))
    ),
    complete: vi.fn(async (request) =>
      ok(testTask({ id: request.id, status: "completed" }))
    ),
    reopen: vi.fn(async (request) =>
      ok(testTask({ id: request.id, status: "active" }))
    ),
    move: vi.fn(async (request) =>
      ok(testTask({
        id: request.id,
        listId: request.listId ?? "test-list",
        parentId: request.parentId ?? null
      }))
    ),
    delete: vi.fn(async (request) =>
      ok({
        id: request.id,
        queued: false,
        revision: now
      })
    ),
    createTaskList: vi.fn(async (request) =>
      ok({
        id: "task-list-created",
        title: request.title,
        updatedAt: now,
        taskCount: 0,
        activeTaskCount: 0
      })
    ),
    renameTaskList: vi.fn(async (request) =>
      ok({
        id: request.id,
        title: request.title,
        updatedAt: now,
        taskCount: 0,
        activeTaskCount: 0
      })
    ),
    deleteTaskList: vi.fn(async (request) =>
      ok({
        id: request.id,
        queued: false,
        revision: now
      })
    )
  },
  calendar: {
    listCalendars: vi.fn(async (request = {}) =>
      ok({
        items: [],
        page: {
          limit: request.limit ?? 50,
          totalKnown: 0
        }
      })
    ),
    listEvents: vi.fn(async (request) =>
      ok({
        items: [],
        page: {
          limit: request.limit ?? 100,
          totalKnown: 0
        }
      })
    ),
    get: vi.fn(async (request) =>
      ok(testCalendarEvent({ id: request.id }))
    ),
    create: vi.fn(async (request) =>
      ok(testCalendarEvent({
        id: "event-created",
        calendarId: request.calendarId,
        title: request.title,
        startsAt: request.startsAt,
        endsAt: request.endsAt,
        allDay: request.allDay ?? false,
        location: request.location ?? "",
        notes: request.notes ?? "",
        guestEmails: request.guestEmails ?? [],
        reminderMinutes: request.reminderMinutes ?? []
      }))
    ),
    update: vi.fn(async (request) =>
      ok(testCalendarEvent({
        id: request.id,
        calendarId: request.calendarId ?? "test-calendar",
        title: request.title ?? "Updated event",
        startsAt: request.startsAt ?? now,
        endsAt: request.endsAt ?? later,
        allDay: request.allDay ?? false,
        location: request.location ?? "",
        notes: request.notes ?? "",
        guestEmails: request.guestEmails ?? [],
        reminderMinutes: request.reminderMinutes ?? []
      }))
    ),
    delete: vi.fn(async (request) =>
      ok({
        id: request.id,
        queued: false,
        revision: now
      })
    )
  },
  notes: {
    list: vi.fn(async (request = {}) =>
      ok({
        items: [],
        page: {
          limit: request.limit ?? 50,
          totalKnown: 0
        }
      })
    ),
    get: vi.fn(async (request) =>
      ok({
        id: request.id,
        title: "Test note",
        preview: "",
        body: "",
        updatedAt: now
      })
    ),
    create: vi.fn(async (request) =>
      ok({
        id: "note-created",
        title: request.title,
        preview: request.body ?? "",
        body: request.body ?? "",
        updatedAt: now
      })
    ),
    update: vi.fn(async (request) =>
      ok({
        id: request.id,
        title: request.title ?? "Updated note",
        preview: request.body ?? "",
        body: request.body ?? "",
        updatedAt: now
      })
    ),
    delete: vi.fn(async (request) =>
      ok({
        id: request.id,
        queued: false,
        revision: now
      })
    )
  },
  search: {
    query: vi.fn(async (request) =>
      ok({
        items: [],
        page: {
          limit: request.limit ?? 20,
          totalKnown: 0
        }
      })
    )
  },
  sync: {
    status: vi.fn(async () =>
      ok({
        state: "idle" as const,
        pendingMutationCount: 0
      })
    ),
    runNow: vi.fn(async (request = {}) =>
      ok({
        accepted: true,
        dryRun: request.dryRun ?? false,
        resources: request.resources ?? ["tasks", "calendar"]
      })
    ),
    subscribeStatus: vi.fn(() => () => undefined)
  },
  settings: {
    get: vi.fn(async () =>
      ok({
        theme: "system" as const,
        startOnLogin: false,
        quickCaptureShortcut: null,
        mcpEnabled: false
      })
    ),
    update: vi.fn(async (request) =>
      ok({
        theme: request.theme ?? "system",
        startOnLogin: request.startOnLogin ?? false,
        quickCaptureShortcut: request.quickCaptureShortcut ?? null,
        mcpEnabled: request.mcpEnabled ?? false
      })
    )
  },
  mcp: {
    status: vi.fn(async () =>
      ok({
        enabled: false,
        running: false,
        readOnly: true,
        confirmationRequired: true
      })
    ),
    setEnabled: vi.fn(async (request) =>
      ok({
        enabled: request.enabled,
        running: false,
        readOnly: true,
        confirmationRequired: request.confirmationRequired ?? true
      })
    )
  },
  native: {
    capabilities: vi.fn(async () =>
      ok({
        platform: "darwin" as const,
        notifications: false,
        globalShortcuts: false,
        tray: false,
        deepLinks: false
      })
    ),
    requestNotificationPermission: vi.fn(async () =>
      ok({
        state: "unsupported" as const
      })
    )
  },
  diagnostics: {
    health: vi.fn(async () =>
      ok({
        status: "ok" as const,
        version: "0.0.0-test",
        environment: "test" as const,
        timestamp: now,
        uptimeMs: 1,
        startup: {
          processStartedMs: 0
        }
      })
    ),
    markShellVisible: vi.fn(async () =>
      ok({
        processStartedMs: 0,
        shellVisibleMs: 1
      })
    ),
    markCachedDataRendered: vi.fn(async () =>
      ok({
        processStartedMs: 0,
        cachedDataRenderedMs: 2
      })
    ),
    ipcMetrics: vi.fn(async () =>
      ok({
        totalCalls: 0,
        validationFailures: 0,
        serviceFailures: 0,
        responseFailures: 0,
        routes: []
      })
    ),
    performance: vi.fn(async () =>
      ok({
        timings: []
      })
    )
  }
};

Object.defineProperty(window, "hcb", {
  configurable: true,
  value: hcbApi
});
