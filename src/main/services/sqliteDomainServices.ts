import type {
  CalendarListRequest,
  CalendarRangeRequest,
  EntityByIdRequest,
  McpSetEnabledRequest,
  McpStatusResponse,
  NativeCapabilitiesResponse,
  NativeNotificationPermissionResponse,
  NoteCreateRequest,
  NoteDeleteRequest,
  NoteUpdateRequest,
  SearchQueryRequest,
  SettingsSnapshot,
  SettingsUpdateRequest,
  SyncRunNowRequest,
  SyncRunNowResponse,
  SyncStatusResponse,
  TaskListsRequest,
  TaskListRequest
} from "@shared/ipc/contracts";
import { notImplemented } from "@shared/ipc/result";
import type {
  GoogleAccountConnectionStatusDto,
  GoogleCalendarReadTransport,
  GoogleTasksReadTransport
} from "../google";
import type { LocalPlannerRepository, LocalSettingsRepository } from "../data/localRepositories";
import { GoogleReadSyncService } from "../sync/readSyncService";
import type { GoogleSyncRepository } from "../sync/readSyncRepository";
import type { ReadSyncResource } from "../sync/types";
import type {
  AppDomainServices,
  DomainJsonObject,
  DomainJsonValue,
  McpDomainServices,
  SyncControlDomainService
} from "./domainInterfaces";

export interface SqliteDomainServiceOptions {
  plannerRepository: LocalPlannerRepository;
  settingsRepository: LocalSettingsRepository;
  syncRepository: GoogleSyncRepository;
  syncTasksTransport?: GoogleTasksReadTransport;
  syncCalendarTransport?: GoogleCalendarReadTransport;
}

type SyncStatusListener = (status: SyncStatusResponse) => void;

const noopTasksTransport: GoogleTasksReadTransport = {
  listTaskLists: async () => [],
  listTasks: async () => ({ tasks: [], serverDate: new Date().toISOString() })
};

const noopCalendarTransport: GoogleCalendarReadTransport = {
  listCalendarLists: async () => [],
  listEvents: async () => ({ events: [], nextSyncToken: null })
};

export function createSqliteDomainServices(
  options: SqliteDomainServiceOptions
): AppDomainServices {
  const sync = new LocalSyncControlService({
    repository: options.syncRepository,
    tasksTransport: options.syncTasksTransport ?? noopTasksTransport,
    calendarTransport: options.syncCalendarTransport ?? noopCalendarTransport
  });
  const mcpState: McpStatusResponse = {
    enabled: options.settingsRepository.get().mcpEnabled,
    running: false,
    readOnly: false,
    confirmationRequired: true,
    url: "http://127.0.0.1"
  };
  const mcpTools = createMcpDomainServices(options.plannerRepository);

  return {
    planner: {
      listTaskLists: (request: TaskListsRequest) =>
        options.plannerRepository.listTaskLists(request),
      listTasks: (request: TaskListRequest) => options.plannerRepository.listTasks(request),
      getTask: (request: EntityByIdRequest) => options.plannerRepository.getTask(request.id),
      listCalendars: (request: CalendarListRequest) =>
        options.plannerRepository.listCalendars(request),
      listCalendarEvents: (request: CalendarRangeRequest) =>
        options.plannerRepository.listCalendarEvents(request),
      getCalendarEvent: (request: EntityByIdRequest) =>
        options.plannerRepository.getCalendarEvent(request.id),
      listNotes: (request) => options.plannerRepository.listNotes(request),
      getNote: (request) => options.plannerRepository.getNote(request.id),
      createNote: (request: NoteCreateRequest) => options.plannerRepository.createNote(request),
      updateNote: (request: NoteUpdateRequest) => options.plannerRepository.updateNote(request),
      deleteNote: (request: NoteDeleteRequest) => options.plannerRepository.deleteNote(request),
      search: (request: SearchQueryRequest) => options.plannerRepository.search(request)
    },
    sync,
    settings: {
      get: () => options.settingsRepository.get(),
      update: (request: SettingsUpdateRequest) => {
        const snapshot = options.settingsRepository.update(request);

        if (request.mcpEnabled !== undefined) {
          mcpState.enabled = request.mcpEnabled;
        }

        return snapshot;
      }
    },
    mcp: {
      status: () => ({ ...mcpState }),
      setEnabled: (request: McpSetEnabledRequest) => {
        mcpState.enabled = request.enabled;
        mcpState.confirmationRequired =
          request.confirmationRequired ?? mcpState.confirmationRequired;
        options.settingsRepository.update({ mcpEnabled: request.enabled });

        return { ...mcpState };
      }
    },
    native: {
      capabilities: () => nativeCapabilities(),
      requestNotificationPermission: () => nativeNotificationPermission()
    },
    mcpTools
  };
}

class LocalSyncControlService implements SyncControlDomainService {
  private readonly repository: GoogleSyncRepository;
  private readonly readSync: GoogleReadSyncService;
  private readonly listeners = new Set<SyncStatusListener>();
  private running = false;

  constructor(options: {
    repository: GoogleSyncRepository;
    tasksTransport: GoogleTasksReadTransport;
    calendarTransport: GoogleCalendarReadTransport;
  }) {
    this.repository = options.repository;
    this.readSync = new GoogleReadSyncService({
      repository: options.repository,
      tasks: options.tasksTransport,
      calendar: options.calendarTransport
    });
  }

  status(): SyncStatusResponse {
    const account = this.repository.latestAccountStatus();
    const status = this.repository.syncStatus();
    const offline = account?.connectionState !== "connected";

    return {
      ...status,
      state: this.running ? "running" : status.state,
      offline,
      stale: isStale(status)
    };
  }

  async runNow(request: SyncRunNowRequest): Promise<SyncRunNowResponse> {
    const resources = normalizedResources(request.resources);

    if (request.dryRun) {
      return {
        accepted: true,
        dryRun: true,
        resources
      };
    }

    if (this.running) {
      return {
        accepted: false,
        dryRun: false,
        resources
      };
    }

    this.running = true;
    this.emit();

    try {
      await this.readSync.runReadSync({
        account: this.repository.latestAccountStatus() ?? signedOutAccount(),
        resources,
        full: request.full ?? false
      });
    } finally {
      this.running = false;
      this.emit();
    }

    return {
      accepted: true,
      dryRun: false,
      resources
    };
  }

  subscribeStatus(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const status = this.status();

    for (const listener of this.listeners) {
      listener(status);
    }
  }
}

function createMcpDomainServices(repository: LocalPlannerRepository): McpDomainServices {
  return {
    planning: {
      search: ({ query, scope, limit }) =>
        repository
          .search({
            query,
            domains: searchDomainsForScope(scope),
            limit: Math.max(1, Math.min(50, limit ?? 20))
          })
          .items.map((item) => jsonObject({
            kind: item.domain,
            id: item.id,
            title: item.title,
            snippet: item.snippet ?? "",
            updatedAt: item.updatedAt ?? "",
            deepLink: `hotcrossbuns://${item.domain}/${item.id}`
          })),
      today: () => {
        const now = new Date();
        const start = startOfUtcDay(now);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

        return jsonObject({
          date: start.toISOString().slice(0, 10),
          tasks: repository.listTasks({ status: "active", limit: 20 }).items.map(jsonObject),
          events: repository
            .listCalendarEvents({
              start: start.toISOString(),
              end: end.toISOString(),
              limit: 20
            })
            .items.map(jsonObject),
          notes: repository.listNotes({ limit: 10 }).items.map(jsonObject)
        });
      },
      week: ({ startDate }) => {
        const start = startDate === undefined ? startOfUtcDay(new Date()) : startOfUtcDay(new Date(startDate));
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

        return jsonObject({
          startDate: start.toISOString(),
          tasks: repository.listTasks({ status: "active", limit: 50 }).items.map(jsonObject),
          events: repository
            .listCalendarEvents({
              start: start.toISOString(),
              end: end.toISOString(),
              limit: 100
            })
            .items.map(jsonObject)
        });
      }
    },
    tasks: {
      getTask: (id) => jsonObject(repository.getTask(id)),
      listTaskLists: () => repository.listTaskLists({ limit: 100 }).items.map(jsonObject),
      previewCreateTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      createTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      previewUpdateTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      updateTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      previewCompleteTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      completeTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      previewReopenTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      reopenTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      previewMoveTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      moveTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      previewDeleteTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      },
      deleteTask: () => {
        throw notImplemented("Task writes are not wired yet.");
      }
    },
    notes: {
      getNote: (id) => jsonObject(repository.getNote(id)),
      previewCreateNote: (input) =>
        jsonObject({
          kind: "note",
          title: requiredText(input, "title"),
          body: optionalText(input, "body") ?? "",
          deepLink: "hotcrossbuns://note/preview"
        }),
      createNote: (input) =>
        jsonObject(
          repository.createNote({
            title: requiredText(input, "title"),
            body: optionalText(input, "body") ?? ""
          })
        ),
      previewUpdateNote: (id, patch) =>
        jsonObject({
          ...repository.getNote(id),
          patch
        }),
      updateNote: (id, patch) =>
        jsonObject(
          repository.updateNote({
            id,
            ...(optionalText(patch, "title") === undefined
              ? {}
              : { title: optionalText(patch, "title") }),
            ...(optionalText(patch, "body") === undefined
              ? {}
              : { body: optionalText(patch, "body") })
          })
        ),
      previewDeleteNote: (id) => jsonObject(repository.getNote(id)),
      deleteNote: (id) => jsonObject(repository.deleteNote({ id }))
    },
    calendar: {
      getEvent: (id) => repository.getCalendarEvent(id),
      listCalendars: () => repository.listCalendars({ limit: 100 }).items.map(jsonObject),
      previewCreateEvent: () => {
        throw notImplemented("Event writes are not wired yet.");
      },
      createEvent: () => {
        throw notImplemented("Event writes are not wired yet.");
      },
      previewUpdateEvent: () => {
        throw notImplemented("Event writes are not wired yet.");
      },
      updateEvent: () => {
        throw notImplemented("Event writes are not wired yet.");
      },
      previewDeleteEvent: () => {
        throw notImplemented("Event writes are not wired yet.");
      },
      deleteEvent: () => {
        throw notImplemented("Event writes are not wired yet.");
      }
    }
  };
}

function normalizedResources(resources: SyncRunNowRequest["resources"]): ReadSyncResource[] {
  return [...new Set(resources ?? ["tasks", "calendar"])] as ReadSyncResource[];
}

function signedOutAccount(): GoogleAccountConnectionStatusDto {
  const now = new Date().toISOString();

  return {
    accountId: "local-google-account",
    connectionState: "signed_out",
    grantedScopes: [],
    missingScopes: [
      "https://www.googleapis.com/auth/tasks",
      "https://www.googleapis.com/auth/calendar"
    ],
    updatedAt: now
  };
}

function isStale(status: SyncStatusResponse): boolean {
  if (status.lastCompletedAt === undefined) {
    return true;
  }

  return Date.now() - Date.parse(status.lastCompletedAt) > 15 * 60 * 1000;
}

function nativeCapabilities(): NativeCapabilitiesResponse {
  return {
    platform: nativePlatform(),
    notifications: process.platform === "darwin",
    globalShortcuts: process.platform === "darwin",
    tray: process.platform === "darwin",
    deepLinks: process.platform === "darwin"
  };
}

function nativeNotificationPermission(): NativeNotificationPermissionResponse {
  return {
    state: process.platform === "darwin" ? "prompt" : "unsupported"
  };
}

function nativePlatform(): "darwin" | "linux" | "win32" | "unknown" {
  if (process.platform === "darwin" || process.platform === "linux" || process.platform === "win32") {
    return process.platform;
  }

  return "unknown";
}

function searchDomainsForScope(scope: string | undefined): SearchQueryRequest["domains"] {
  if (scope === "tasks" || scope === "lists") {
    return ["tasks"];
  }

  if (scope === "events" || scope === "calendars") {
    return ["calendar"];
  }

  if (scope === "notes") {
    return ["notes"];
  }

  return undefined;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function requiredText(input: DomainJsonObject, key: string): string {
  const value = optionalText(input, key);

  if (!value) {
    throw new Error(`Missing required string argument '${key}'.`);
  }

  return value;
}

function optionalText(input: DomainJsonObject, key: string): string | undefined {
  const value = input[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function jsonObject(value: object): DomainJsonObject {
  const output: DomainJsonObject = {};

  for (const [key, child] of Object.entries(value)) {
    output[key] = jsonValue(child);
  }

  return output;
}

function jsonValue(value: unknown): DomainJsonValue {
  if (value === undefined) {
    return null;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(jsonValue);
  }

  if (typeof value === "object") {
    return jsonObject(value);
  }

  return null;
}
