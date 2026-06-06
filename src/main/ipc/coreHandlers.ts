import {
  ipcContracts,
  type AvailabilityExportRequest,
  type BootstrapGetRequest,
  type CalendarEventCompletionRequest,
  type CalendarListRequest,
  type CalendarEventCreateRequest,
  type CalendarEventDeleteRequest,
  type CalendarEventUpdateRequest,
  type CalendarRangeRequest,
  type CalendarScheduleSuggestRequest,
  type EntityByIdRequest,
  type GoogleDisconnectRequest,
  type GoogleSaveOAuthClientRequest,
  type McpSetEnabledRequest,
  type NoteBrokenLinksRequest,
  type NoteCreateRequest,
  type NoteDeleteRequest,
  type NoteLinkSuggestRequest,
  type NoteListCreateRequest,
  type NoteListDeleteRequest,
  type NoteListRequest,
  type NoteListRenameRequest,
  type NoteUpdateRequest,
  type SearchQueryRequest,
  type ScheduledTaskBlockCreateRequest,
  type ScheduledTaskBlockListRequest,
  type ScheduledTaskBlockMoveRequest,
  type ScheduledTaskBlockUnscheduleRequest,
  type SettingsRecoveryActionRequest,
  type SettingsUpdateRequest,
  type SyncRunNowRequest,
  type TaskCompletionRequest,
  type TaskCreateRequest,
  type TaskDeleteRequest,
  type TaskListCreateRequest,
  type TaskListDeleteRequest,
  type TaskListRenameRequest,
  type TaskListsRequest,
  type TaskListRequest,
  type TaskMoveRequest,
  type TaskUpdateRequest
} from "@shared/ipc/contracts";
import { appLogger } from "../diagnostics/appLogger";
import type { AppDomainServices } from "../services/domainInterfaces";
import type { IpcHandlerDefinition } from "./registry";

export function createCoreIpcHandlers(services: AppDomainServices): IpcHandlerDefinition[] {
  const scheduleMutationDrain = createMutationDrainScheduler(services);
  const withMutationDrain = <Request, Response>(
    handle: (request: Request) => Promise<Response> | Response
  ) => async (request: Request): Promise<Response> => {
    const response = await handle(request);
    scheduleMutationDrain();
    return response;
  };

  return [
    {
      contract: ipcContracts.bootstrap.get,
      handle: (request) => bootstrapSnapshot(services, request as BootstrapGetRequest)
    },
    {
      contract: ipcContracts.tasks.listTaskLists,
      handle: (request) => services.planner.listTaskLists(request as TaskListsRequest)
    },
    {
      contract: ipcContracts.tasks.list,
      handle: (request) => services.planner.listTasks(request as TaskListRequest)
    },
    {
      contract: ipcContracts.tasks.get,
      handle: (request) => services.planner.getTask(request as EntityByIdRequest)
    },
    {
      contract: ipcContracts.tasks.create,
      handle: withMutationDrain((request) =>
        services.planner.createTask(request as TaskCreateRequest)
      )
    },
    {
      contract: ipcContracts.tasks.update,
      handle: withMutationDrain((request) =>
        services.planner.updateTask(request as TaskUpdateRequest)
      )
    },
    {
      contract: ipcContracts.tasks.complete,
      handle: withMutationDrain((request) =>
        services.planner.completeTask(request as TaskCompletionRequest)
      )
    },
    {
      contract: ipcContracts.tasks.reopen,
      handle: withMutationDrain((request) =>
        services.planner.reopenTask(request as TaskCompletionRequest)
      )
    },
    {
      contract: ipcContracts.tasks.move,
      handle: withMutationDrain((request) =>
        services.planner.moveTask(request as TaskMoveRequest)
      )
    },
    {
      contract: ipcContracts.tasks.delete,
      handle: withMutationDrain((request) =>
        services.planner.deleteTask(request as TaskDeleteRequest)
      )
    },
    {
      contract: ipcContracts.tasks.createTaskList,
      handle: withMutationDrain((request) =>
        services.planner.createTaskList(request as TaskListCreateRequest)
      )
    },
    {
      contract: ipcContracts.tasks.renameTaskList,
      handle: withMutationDrain((request) =>
        services.planner.renameTaskList(request as TaskListRenameRequest)
      )
    },
    {
      contract: ipcContracts.tasks.deleteTaskList,
      handle: withMutationDrain((request) =>
        services.planner.deleteTaskList(request as TaskListDeleteRequest)
      )
    },
    {
      contract: ipcContracts.calendar.listCalendars,
      handle: (request) => services.planner.listCalendars(request as CalendarListRequest)
    },
    {
      contract: ipcContracts.calendar.listEvents,
      handle: (request) => services.planner.listCalendarEvents(request as CalendarRangeRequest)
    },
    {
      contract: ipcContracts.calendar.get,
      handle: (request) => services.planner.getCalendarEvent(request as EntityByIdRequest)
    },
    {
      contract: ipcContracts.calendar.create,
      handle: withMutationDrain((request) =>
        services.planner.createCalendarEvent(request as CalendarEventCreateRequest)
      )
    },
    {
      contract: ipcContracts.calendar.update,
      handle: withMutationDrain((request) =>
        services.planner.updateCalendarEvent(request as CalendarEventUpdateRequest)
      )
    },
    {
      contract: ipcContracts.calendar.complete,
      handle: (request) => services.planner.completeCalendarEvent(request as CalendarEventCompletionRequest)
    },
    {
      contract: ipcContracts.calendar.reopen,
      handle: (request) => services.planner.reopenCalendarEvent(request as CalendarEventCompletionRequest)
    },
    {
      contract: ipcContracts.calendar.delete,
      handle: withMutationDrain((request) =>
        services.planner.deleteCalendarEvent(request as CalendarEventDeleteRequest)
      )
    },
    {
      contract: ipcContracts.calendar.listScheduledTaskBlocks,
      handle: (request) =>
        services.planner.listScheduledTaskBlocks(request as ScheduledTaskBlockListRequest)
    },
    {
      contract: ipcContracts.calendar.scheduleTaskBlock,
      handle: withMutationDrain((request) =>
        services.planner.scheduleTaskBlock(request as ScheduledTaskBlockCreateRequest)
      )
    },
    {
      contract: ipcContracts.calendar.moveScheduledTaskBlock,
      handle: withMutationDrain((request) =>
        services.planner.moveScheduledTaskBlock(request as ScheduledTaskBlockMoveRequest)
      )
    },
    {
      contract: ipcContracts.calendar.unscheduleTaskBlock,
      handle: withMutationDrain((request) =>
        services.planner.unscheduleTaskBlock(request as ScheduledTaskBlockUnscheduleRequest)
      )
    },
    {
      contract: ipcContracts.calendar.scheduleSuggest,
      handle: (request) =>
        services.planner.scheduleSuggest(request as CalendarScheduleSuggestRequest)
    },
    {
      contract: ipcContracts.calendar.exportAvailability,
      handle: (request) =>
        services.planner.exportAvailability(request as AvailabilityExportRequest)
    },
    {
      contract: ipcContracts.notes.list,
      handle: (request) => services.planner.listNotes(request as NoteListRequest)
    },
    {
      contract: ipcContracts.notes.createList,
      handle: withMutationDrain((request) =>
        services.planner.createNoteList(request as NoteListCreateRequest)
      )
    },
    {
      contract: ipcContracts.notes.renameList,
      handle: withMutationDrain((request) =>
        services.planner.renameNoteList(request as NoteListRenameRequest)
      )
    },
    {
      contract: ipcContracts.notes.deleteList,
      handle: withMutationDrain((request) =>
        services.planner.deleteNoteList(request as NoteListDeleteRequest)
      )
    },
    {
      contract: ipcContracts.notes.get,
      handle: (request) => services.planner.getNote(request as EntityByIdRequest)
    },
    {
      contract: ipcContracts.notes.create,
      handle: withMutationDrain((request) =>
        services.planner.createNote(request as NoteCreateRequest)
      )
    },
    {
      contract: ipcContracts.notes.update,
      handle: withMutationDrain((request) =>
        services.planner.updateNote(request as NoteUpdateRequest)
      )
    },
    {
      contract: ipcContracts.notes.delete,
      handle: withMutationDrain((request) =>
        services.planner.deleteNote(request as NoteDeleteRequest)
      )
    },
    {
      contract: ipcContracts.notes.linkSuggest,
      handle: (request) => services.planner.suggestNoteLinks(request as NoteLinkSuggestRequest)
    },
    {
      contract: ipcContracts.notes.listBrokenLinks,
      handle: (request) => services.planner.listBrokenNoteLinks(request as NoteBrokenLinksRequest)
    },
    {
      contract: ipcContracts.search.query,
      handle: (request) => services.planner.search(request as SearchQueryRequest)
    },
    {
      contract: ipcContracts.sync.status,
      handle: () => services.sync.status()
    },
    {
      contract: ipcContracts.sync.runNow,
      handle: (request) => services.sync.runNow(request as SyncRunNowRequest)
    },
    {
      contract: ipcContracts.google.status,
      handle: () => services.google.status()
    },
    {
      contract: ipcContracts.google.saveOAuthClient,
      handle: (request) =>
        services.google.saveOAuthClient(request as GoogleSaveOAuthClientRequest)
    },
    {
      contract: ipcContracts.google.beginOAuth,
      handle: () => services.google.beginOAuth()
    },
    {
      contract: ipcContracts.google.disconnect,
      handle: (request) => services.google.disconnect(request as GoogleDisconnectRequest)
    },
    {
      contract: ipcContracts.settings.get,
      handle: () => services.settings.get()
    },
    {
      contract: ipcContracts.settings.update,
      handle: (request) => services.settings.update(request as SettingsUpdateRequest)
    },
    {
      contract: ipcContracts.settings.recoveryAction,
      handle: (request) =>
        services.settings.recoveryAction(request as SettingsRecoveryActionRequest)
    },
    {
      contract: ipcContracts.undo.status,
      handle: () => services.undo.status()
    },
    {
      contract: ipcContracts.undo.undo,
      handle: () => services.undo.undo()
    },
    {
      contract: ipcContracts.undo.redo,
      handle: () => services.undo.redo()
    },
    {
      contract: ipcContracts.mcp.status,
      handle: () => services.mcp.status()
    },
    {
      contract: ipcContracts.mcp.setEnabled,
      handle: (request) => services.mcp.setEnabled(request as McpSetEnabledRequest)
    },
    {
      contract: ipcContracts.native.capabilities,
      handle: () => services.native.capabilities()
    },
    {
      contract: ipcContracts.native.requestNotificationPermission,
      handle: () => services.native.requestNotificationPermission()
    },
    {
      contract: ipcContracts.native.listFontFamilies,
      handle: () => services.native.listFontFamilies()
    }
  ];
}

async function bootstrapSnapshot(services: AppDomainServices, request: BootstrapGetRequest) {
  const [
    taskLists,
    tasks,
    hiddenTasks,
    deletedTasks,
    calendars,
    events,
    scheduledTaskBlocks,
    notes,
    settings,
    syncStatus,
    googleStatus,
    undoStatus,
    native
  ] = await Promise.all([
    loadAllBootstrapPages({ limit: 100 }, (pageRequest) =>
      services.planner.listTaskLists(pageRequest)
    ),
    loadAllBootstrapPages({ status: "all", limit: 100 }, (pageRequest) =>
      services.planner.listTasks(pageRequest)
    ),
    loadAllBootstrapPages({ status: "hidden", limit: 100 }, (pageRequest) =>
      services.planner.listTasks(pageRequest)
    ),
    loadAllBootstrapPages({ status: "deleted", limit: 100 }, (pageRequest) =>
      services.planner.listTasks(pageRequest)
    ),
    loadAllBootstrapPages({ limit: 100 }, (pageRequest) =>
      services.planner.listCalendars(pageRequest)
    ),
    loadAllBootstrapPages(
      {
        start: request.calendarRange.start,
        end: request.calendarRange.end,
        limit: request.calendarRange.limit ?? 500
      },
      (pageRequest) => services.planner.listCalendarEvents(pageRequest)
    ),
    loadAllBootstrapPages(
      {
        start: request.calendarRange.start,
        end: request.calendarRange.end,
        limit: 500
      },
      (pageRequest) => services.planner.listScheduledTaskBlocks(pageRequest)
    ),
    loadAllBootstrapPages({ limit: 50 }, (pageRequest) =>
      services.planner.listNotes(pageRequest)
    ),
    services.settings.get(),
    services.sync.status(),
    services.google.status(),
    services.undo.status(),
    services.native.capabilities()
  ]);

  return {
    taskLists,
    tasks,
    hiddenTasks,
    deletedTasks,
    calendars,
    events,
    scheduledTaskBlocks,
    notes,
    settings,
    syncStatus,
    googleStatus,
    undoStatus,
    native,
    resourceCounts: {
      calendarEvents: calendars.items.every((calendar) => calendar.eventCount !== undefined)
        ? calendars.items.reduce((count, calendar) => count + (calendar.eventCount ?? 0), 0)
        : knownTotal(events.page.totalKnown, events.items.length),
      notes: knownTotal(notes.page.totalKnown, notes.items.length),
      tasks: taskLists.items.every((taskList) => taskList.taskCount !== undefined)
        ? taskLists.items.reduce((count, taskList) => count + (taskList.taskCount ?? 0), 0)
        : knownTotal(tasks.page.totalKnown, tasks.items.length) +
          knownTotal(hiddenTasks.page.totalKnown, hiddenTasks.items.length) +
          knownTotal(deletedTasks.page.totalKnown, deletedTasks.items.length)
    }
  };
}

function knownTotal(pageTotal: number | undefined, itemCount: number): number {
  return pageTotal ?? itemCount;
}

type BootstrapPageRequest = Record<string, unknown> & { cursor?: string };
type BootstrapPagedResponse<Item> = {
  items: Item[];
  page: {
    limit: number;
    nextCursor?: string;
    totalKnown?: number;
  };
};

async function loadAllBootstrapPages<
  Item,
  Response extends BootstrapPagedResponse<Item>
>(
  request: BootstrapPageRequest,
  loadPage: (request: any) => Promise<Response> | Response
): Promise<Response> {
  const items: Item[] = [];
  let firstPage: Response | null = null;
  let lastPage: Response | null = null;
  let cursor = request.cursor;

  do {
    const page = await loadPage({
      ...request,
      ...(cursor === undefined ? {} : { cursor })
    });

    firstPage ??= page;
    lastPage = page;
    items.push(...page.items);
    cursor = page.page.nextCursor;
  } while (cursor !== undefined);

  if (!firstPage || !lastPage) {
    throw new Error("Paged bootstrap request returned no data.");
  }

  const { nextCursor: _nextCursor, ...pageMetadata } = lastPage.page;

  return {
    ...lastPage,
    items,
    page: {
      ...pageMetadata,
      totalKnown: lastPage.page.totalKnown ?? firstPage.page.totalKnown ?? items.length
    }
  } as Response;
}

function createMutationDrainScheduler(services: AppDomainServices): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let requested = false;

  const schedule = (delayMs = 1_000): void => {
    requested = true;
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      void run();
    }, delayMs);
  };

  const run = async (): Promise<void> => {
    if (running) {
      return;
    }

    running = true;
    requested = false;

    try {
      const result = await services.sync.runNow({ drainOnly: true });

      if (!result.accepted) {
        schedule(2_000);
      }
    } catch (thrown) {
      appLogger.warn("post-write mutation drain failed", "sync", {
        message: thrown instanceof Error ? thrown.message : String(thrown)
      });
    } finally {
      running = false;
      if (requested) {
        schedule();
      }
    }
  };

  return schedule;
}
