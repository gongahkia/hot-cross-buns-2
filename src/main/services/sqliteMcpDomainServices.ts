import type { SearchQueryRequest, TaskPriority, TaskUpdateRequest } from "@shared/ipc/contracts";
import type { LocalPlannerRepository } from "../data/localRepositories";
import type {
  DomainJsonObject,
  DomainJsonValue,
  McpDomainServices
} from "./domainInterfaces";

export function createMcpDomainServices(repository: LocalPlannerRepository): McpDomainServices {
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
      previewCreateTask: (input) =>
        jsonObject({
          kind: "task",
          title: requiredText(input, "title"),
          notes: optionalText(input, "notes") ?? "",
          dueDate: dateOnlyFromInput(optionalText(input, "dueDate")),
          taskListId: optionalText(input, "taskListId") ?? firstTaskListId(repository),
          parentId: optionalText(input, "parentId") ?? null,
          priority: priorityFromInput(optionalText(input, "priority")),
          deepLink: "hotcrossbuns://task/preview"
        }),
      createTask: (input) =>
        jsonObject({
          kind: "task",
          ...repository.createTask({
            title: requiredText(input, "title"),
            notes: optionalText(input, "notes") ?? "",
            dueDate: dateOnlyFromInput(optionalText(input, "dueDate")),
            listId: optionalText(input, "taskListId") ?? firstTaskListId(repository),
            parentId: optionalText(input, "parentId") ?? null,
            priority: priorityFromInput(optionalText(input, "priority"))
          })
        }),
      previewUpdateTask: (id, patch) => jsonObject({ ...repository.getTask(id), patch }),
      updateTask: (id, patch) =>
        jsonObject({
          kind: "task",
          ...repository.updateTask(taskUpdateFromPatch(id, patch))
        }),
      previewCompleteTask: (id) => jsonObject({ ...repository.getTask(id), targetStatus: "completed" }),
      completeTask: (id) => jsonObject({ kind: "task", ...repository.completeTask({ id }) }),
      previewReopenTask: (id) => jsonObject({ ...repository.getTask(id), targetStatus: "active" }),
      reopenTask: (id) => jsonObject({ kind: "task", ...repository.reopenTask({ id }) }),
      previewMoveTask: (id, taskListId) =>
        jsonObject({ ...repository.getTask(id), targetTaskListId: taskListId }),
      moveTask: (id, taskListId) =>
        jsonObject({ kind: "task", ...repository.moveTask({ id, listId: taskListId }) }),
      previewDeleteTask: (id) => jsonObject(repository.getTask(id)),
      deleteTask: (id) => jsonObject({ kind: "task", ...repository.deleteTask({ id }) })
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
        jsonObject({
          kind: "note",
          ...repository.createNote({
            title: requiredText(input, "title"),
            body: optionalText(input, "body") ?? ""
          })
        }),
      previewUpdateNote: (id, patch) =>
        jsonObject({
          ...repository.getNote(id),
          patch
        }),
      updateNote: (id, patch) =>
        jsonObject({
          kind: "note",
          ...repository.updateNote({
            id,
            ...(optionalText(patch, "title") === undefined
              ? {}
              : { title: optionalText(patch, "title") }),
            ...(optionalText(patch, "body") === undefined
              ? {}
              : { body: optionalText(patch, "body") })
          })
        }),
      previewDeleteNote: (id) => jsonObject(repository.getNote(id)),
      deleteNote: (id) => jsonObject(repository.deleteNote({ id }))
    },
    calendar: {
      getEvent: (id) => repository.getCalendarEvent(id),
      listCalendars: () => repository.listCalendars({ limit: 100 }).items.map(jsonObject),
      previewCreateEvent: (input) =>
        jsonObject({
          kind: "event",
          ...calendarEventRequestFromJson(repository, input),
          deepLink: "hotcrossbuns://event/preview"
        }),
      createEvent: (input) =>
        jsonObject({
          kind: "event",
          ...repository.createCalendarEvent(calendarEventRequestFromJson(repository, input))
        }),
      previewUpdateEvent: (id, patch) =>
        jsonObject({
          ...repository.getCalendarEvent(id),
          patch
        }),
      updateEvent: (id, patch) =>
        jsonObject({
          kind: "event",
          ...repository.updateCalendarEvent({
            id,
            ...calendarEventPatchFromJson(patch)
          })
        }),
      previewDeleteEvent: (id) => jsonObject(repository.getCalendarEvent(id)),
      deleteEvent: (id) => jsonObject(repository.deleteCalendarEvent({ id }))
    }
  };
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

function calendarEventRequestFromJson(
  repository: LocalPlannerRepository,
  input: DomainJsonObject
) {
  const startsAt = optionalText(input, "startsAt") ?? requiredText(input, "startDate");
  const endsAt = optionalText(input, "endsAt") ?? optionalText(input, "endDate") ?? startsAt;

  return {
    title: requiredText(input, "title"),
    calendarId: optionalText(input, "calendarId") ?? defaultCalendarId(repository),
    startsAt,
    endsAt,
    allDay: optionalBoolean(input, "allDay") ?? optionalBoolean(input, "isAllDay") ?? false,
    location: optionalText(input, "location") ?? "",
    notes: optionalText(input, "notes") ?? optionalText(input, "details") ?? "",
    guestEmails: optionalTextArray(input, "guestEmails") ?? optionalTextArray(input, "attendeeEmails") ?? [],
    reminderMinutes: optionalNumberArray(input, "reminderMinutes") ?? []
  };
}

function calendarEventPatchFromJson(patch: DomainJsonObject) {
  return {
    ...(optionalText(patch, "title") === undefined ? {} : { title: optionalText(patch, "title") }),
    ...(optionalText(patch, "calendarId") === undefined ? {} : { calendarId: optionalText(patch, "calendarId") }),
    ...(optionalText(patch, "startsAt") === undefined ? {} : { startsAt: optionalText(patch, "startsAt") }),
    ...(optionalText(patch, "startDate") === undefined ? {} : { startsAt: optionalText(patch, "startDate") }),
    ...(optionalText(patch, "endsAt") === undefined ? {} : { endsAt: optionalText(patch, "endsAt") }),
    ...(optionalText(patch, "endDate") === undefined ? {} : { endsAt: optionalText(patch, "endDate") }),
    ...(optionalBoolean(patch, "allDay") === undefined ? {} : { allDay: optionalBoolean(patch, "allDay") }),
    ...(optionalBoolean(patch, "isAllDay") === undefined ? {} : { allDay: optionalBoolean(patch, "isAllDay") }),
    ...(optionalText(patch, "location") === undefined ? {} : { location: optionalText(patch, "location") }),
    ...(optionalText(patch, "notes") === undefined ? {} : { notes: optionalText(patch, "notes") }),
    ...(optionalText(patch, "details") === undefined ? {} : { notes: optionalText(patch, "details") }),
    ...(optionalTextArray(patch, "guestEmails") === undefined ? {} : { guestEmails: optionalTextArray(patch, "guestEmails") }),
    ...(optionalTextArray(patch, "attendeeEmails") === undefined ? {} : { guestEmails: optionalTextArray(patch, "attendeeEmails") }),
    ...(optionalNumberArray(patch, "reminderMinutes") === undefined ? {} : { reminderMinutes: optionalNumberArray(patch, "reminderMinutes") })
  };
}

function defaultCalendarId(repository: LocalPlannerRepository): string {
  const calendar = repository.listCalendars({ limit: 1 }).items[0];

  if (calendar === undefined) {
    throw new Error("No writable calendar is available.");
  }

  return calendar.id;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function firstTaskListId(repository: LocalPlannerRepository): string {
  const taskList = repository.listTaskLists({ limit: 1 }).items[0];

  if (taskList === undefined) {
    throw new Error("No task list is available.");
  }

  return taskList.id;
}

function dateOnlyFromInput(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function priorityFromInput(value: string | undefined): TaskPriority {
  return value === "low" || value === "medium" || value === "high" ? value : "none";
}

function taskUpdateFromPatch(id: string, patch: DomainJsonObject): TaskUpdateRequest {
  return {
    id,
    ...(optionalText(patch, "title") === undefined ? {} : { title: optionalText(patch, "title") }),
    ...(optionalText(patch, "notes") === undefined ? {} : { notes: optionalText(patch, "notes") }),
    ...(optionalText(patch, "dueDate") === undefined
      ? {}
      : { dueDate: dateOnlyFromInput(optionalText(patch, "dueDate")) }),
    ...(optionalText(patch, "taskListId") === undefined
      ? {}
      : { listId: optionalText(patch, "taskListId") }),
    ...(optionalText(patch, "listId") === undefined ? {} : { listId: optionalText(patch, "listId") }),
    ...(optionalText(patch, "parentId") === undefined
      ? {}
      : { parentId: optionalText(patch, "parentId") }),
    ...(optionalText(patch, "priority") === undefined
      ? {}
      : { priority: priorityFromInput(optionalText(patch, "priority")) })
  };
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

function optionalBoolean(input: DomainJsonObject, key: string): boolean | undefined {
  const value = input[key];

  return typeof value === "boolean" ? value : undefined;
}

function optionalTextArray(input: DomainJsonObject, key: string): string[] | undefined {
  const value = input[key];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return undefined;
}

function optionalNumberArray(input: DomainJsonObject, key: string): number[] | undefined {
  const value = input[key];

  if (Array.isArray(value)) {
    return value.filter((item): item is number => typeof item === "number");
  }

  if (typeof value === "number") {
    return [value];
  }

  return undefined;
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
