import type { SettingsSnapshot } from "@shared/ipc/contracts";
import { dateOnlyFromLocalDate, visibleCalendarRange } from "./dateFormat";
import { unwrap } from "./result";
import { uniqueTasks } from "./taskViewModels";
import type { CoreDataSnapshot } from "./types";

type CursorRequest = { cursor?: string };
type PagedResponse<Item> = {
  items: Item[];
  page: {
    limit: number;
    nextCursor?: string;
    totalKnown?: number;
  };
};

function knownTotal(pageTotal: number | undefined, itemCount: number): number {
  return pageTotal ?? itemCount;
}

async function loadAllPages<Request extends CursorRequest, Item, Response extends PagedResponse<Item>>(
  loadPage: (request: Request) => Promise<Response>,
  request: Request
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

  if (firstPage === null || lastPage === null) {
    throw new Error("Paged request returned no data.");
  }

  const { nextCursor: _nextCursor, ...pageMetadata } = lastPage.page;

  return {
    ...lastPage,
    items,
    page: {
      ...pageMetadata,
      totalKnown: lastPage.page.totalKnown ?? firstPage.page.totalKnown ?? items.length
    }
  };
}

export async function loadCoreData(settingsPromise?: Promise<SettingsSnapshot>): Promise<CoreDataSnapshot> {
  if (!window.hcb) {
    throw new Error("Preload bridge is unavailable.");
  }

  const range = visibleCalendarRange();
  const settingsLoad =
    settingsPromise ?? window.hcb.settings.get().then((result) => unwrap(result, "Settings failed"));
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
    native
  ] = await Promise.all([
    loadAllPages(
      (request) => window.hcb.tasks.listTaskLists(request).then((result) => unwrap(result, "Task lists failed")),
      { limit: 100 }
    ),
    loadAllPages(
      (request) => window.hcb.tasks.list(request).then((result) => unwrap(result, "Tasks failed")),
      { status: "all", limit: 100 }
    ),
    loadAllPages(
      (request) => window.hcb.tasks.list(request).then((result) => unwrap(result, "Hidden tasks failed")),
      { status: "hidden", limit: 100 }
    ),
    loadAllPages(
      (request) => window.hcb.tasks.list(request).then((result) => unwrap(result, "Deleted tasks failed")),
      { status: "deleted", limit: 100 }
    ),
    loadAllPages(
      (request) => window.hcb.calendar.listCalendars(request).then((result) => unwrap(result, "Calendars failed")),
      { limit: 100 }
    ),
    loadAllPages(
      (request) => window.hcb.calendar.listEvents(request).then((result) => unwrap(result, "Calendar events failed")),
      { start: range.start, end: range.end, limit: 500 }
    ),
    loadAllPages(
      (request) =>
        window.hcb.calendar
          .listScheduledTaskBlocks(request)
          .then((result) => unwrap(result, "Scheduled task blocks failed")),
      { start: range.start, end: range.end, limit: 500 }
    ),
    loadAllPages(
      (request) => window.hcb.notes.list(request).then((result) => unwrap(result, "Notes failed")),
      { limit: 100 }
    ),
    settingsLoad,
    window.hcb.sync.status().then((result) => unwrap(result, "Sync status failed")),
    window.hcb.google.status().then((result) => unwrap(result, "Google status failed")),
    window.hcb.native.capabilities().then((result) => unwrap(result, "Native status failed"))
  ]);
  const scheduleDate = dateOnlyFromLocalDate(new Date());
  const scheduleSuggestion = await window.hcb.calendar
    .scheduleSuggest({
      date: scheduleDate,
      capacityMinutes: settings.todayCapacityMinutes,
      workingHours: {
        start: settings.todayWorkingHoursStart,
        end: settings.todayWorkingHoursEnd
      }
    })
    .then((result) => unwrap(result, "Schedule suggestion failed"));

  return {
    taskLists: taskLists.items,
    tasks: uniqueTasks([...tasks.items, ...hiddenTasks.items, ...deletedTasks.items]),
    calendars: calendars.items,
    events: events.items,
    scheduledTaskBlocks: scheduledTaskBlocks.items,
    scheduleSuggestion,
    notes: notes.items,
    noteLists: notes.lists,
    settings,
    syncStatus,
    googleStatus,
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
