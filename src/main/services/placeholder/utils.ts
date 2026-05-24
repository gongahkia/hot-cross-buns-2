import type {
  SettingsSnapshot,
  SettingsUpdateRequest,
  TaskSummary
} from "@shared/ipc/contracts";
import type {
  DomainJsonObject,
  DomainJsonValue
} from "../domainInterfaces";
import type { CalendarRecord, TaskRecord } from "./state";

type PlaceholderTaskStatus = TaskSummary["status"];

export interface PageWindow<T> {
  items: T[];
  page: {
    limit: number;
    nextCursor?: string;
    totalKnown: number;
  };
}

export function pageItems<T>(
  inputItems: T[],
  cursor: string | undefined,
  requestedLimit: number | undefined,
  defaultLimit: number,
  maxLimit: number
): PageWindow<T> {
  const limit = Math.max(1, Math.min(maxLimit, requestedLimit ?? defaultLimit));
  const start = parseCursor(cursor);
  const items = inputItems.slice(start, start + limit);
  const nextIndex = start + items.length;

  return {
    items,
    page: {
      limit,
      ...(nextIndex < inputItems.length ? { nextCursor: String(nextIndex) } : {}),
      totalKnown: inputItems.length
    }
  };
}

function parseCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function requiredById<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((candidate) => candidate.id === id);

  if (!item) {
    throw new Error(`${label} was not found.`);
  }

  return item;
}

export function requiredText(input: DomainJsonObject, key: string): string {
  const value = optionalText(input, key);

  if (!value) {
    throw new Error(`Missing required string argument '${key}'.`);
  }

  return value;
}

export function optionalText(input: DomainJsonObject, key: string): string | undefined {
  const value = input[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function taskPatch(patch: DomainJsonObject): Partial<TaskRecord> {
  return {
    ...(optionalText(patch, "title") === undefined ? {} : { title: optionalText(patch, "title") }),
    ...(optionalText(patch, "notes") === undefined ? {} : { notes: optionalText(patch, "notes") }),
    ...(optionalText(patch, "dueDate") === undefined ? {} : { dueAt: optionalText(patch, "dueDate") }),
    ...(optionalText(patch, "taskListId") === undefined ? {} : { listId: optionalText(patch, "taskListId") }),
    ...(taskStatus(patch.status) === undefined ? {} : { status: taskStatus(patch.status) })
  };
}

export function eventPatch(patch: DomainJsonObject): Partial<CalendarRecord> {
  return {
    ...(optionalText(patch, "title") === undefined ? {} : { title: optionalText(patch, "title") }),
    ...(optionalText(patch, "details") === undefined ? {} : { notes: optionalText(patch, "details") }),
    ...(optionalText(patch, "startDate") === undefined ? {} : { startsAt: optionalText(patch, "startDate") }),
    ...(optionalText(patch, "endDate") === undefined ? {} : { endsAt: optionalText(patch, "endDate") }),
    ...(optionalText(patch, "calendarId") === undefined ? {} : { calendarId: optionalText(patch, "calendarId") }),
    ...(optionalText(patch, "location") === undefined ? {} : { location: optionalText(patch, "location") }),
    ...(typeof patch.isAllDay === "boolean" ? { allDay: patch.isAllDay } : {})
  };
}

function taskStatus(value: DomainJsonValue | undefined): PlaceholderTaskStatus | undefined {
  return value === "active" || value === "completed" ? value : undefined;
}

export function compactJsonObject(input: Record<string, DomainJsonValue | undefined>): DomainJsonObject {
  const output: DomainJsonObject = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}

export function textMatches(query: string, ...values: Array<string | null | undefined>): boolean {
  return values.some((value) => value?.toLowerCase().includes(query));
}

export function preview(body: string): string {
  const trimmed = body.trim();

  if (!trimmed) {
    return "Empty local note";
  }

  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

export function definedSettingsPatch(request: SettingsUpdateRequest): Partial<SettingsSnapshot> {
  const patch: Partial<SettingsSnapshot> = {};

  if (request.theme !== undefined) {
    patch.theme = request.theme as SettingsSnapshot["theme"];
  }

  if (request.colorTheme !== undefined) {
    patch.colorTheme = request.colorTheme as SettingsSnapshot["colorTheme"];
  }

  if (request.appLanguage !== undefined) {
    patch.appLanguage = request.appLanguage;
  }

  if (request.uiFontName !== undefined) {
    patch.uiFontName = request.uiFontName;
  }

  if (request.uiTextSizePoints !== undefined) {
    patch.uiTextSizePoints = request.uiTextSizePoints;
  }

  if (request.perSurfaceFontOverrides !== undefined) {
    patch.perSurfaceFontOverrides = request.perSurfaceFontOverrides;
  }

  if (request.performanceMode !== undefined) {
    patch.performanceMode = request.performanceMode;
  }

  if (request.appBackgroundTranslucencyEnabled !== undefined) {
    patch.appBackgroundTranslucencyEnabled = request.appBackgroundTranslucencyEnabled;
  }

  if (request.appBackgroundOpacity !== undefined) {
    patch.appBackgroundOpacity = request.appBackgroundOpacity;
  }

  if (request.disableAnimations !== undefined) {
    patch.disableAnimations = request.disableAnimations;
  }

  if (request.uiLayoutScale !== undefined) {
    patch.uiLayoutScale = request.uiLayoutScale;
  }

  if (request.navigationPlacement !== undefined) {
    patch.navigationPlacement = request.navigationPlacement;
  }

  if (request.hiddenNavigationTabs !== undefined) {
    patch.hiddenNavigationTabs = [...new Set(request.hiddenNavigationTabs)];
  }

  if (request.hiddenCalendarViewModes !== undefined) {
    patch.hiddenCalendarViewModes = [...new Set(request.hiddenCalendarViewModes)];
  }

  if (request.monthScrollPastMonths !== undefined) {
    patch.monthScrollPastMonths = request.monthScrollPastMonths;
  }

  if (request.monthScrollFutureMonths !== undefined) {
    patch.monthScrollFutureMonths = request.monthScrollFutureMonths;
  }

  if (request.quickCreateExpandedByDefault !== undefined) {
    patch.quickCreateExpandedByDefault = request.quickCreateExpandedByDefault;
  }

  if (request.restoreWindowStateEnabled !== undefined) {
    patch.restoreWindowStateEnabled = request.restoreWindowStateEnabled;
  }

  if (request.startOnLogin !== undefined) {
    patch.startOnLogin = request.startOnLogin;
  }

  if (request.quickCaptureShortcut !== undefined) {
    patch.quickCaptureShortcut = request.quickCaptureShortcut;
  }

  if (request.selectedTaskListIds !== undefined) {
    patch.selectedTaskListIds = [...new Set(request.selectedTaskListIds)];
  }

  if (request.selectedCalendarIds !== undefined) {
    patch.selectedCalendarIds = [...new Set(request.selectedCalendarIds)];
  }

  if (request.setupCompletedAt !== undefined) {
    patch.setupCompletedAt = request.setupCompletedAt;
  }

  if (request.syncMode !== undefined) {
    patch.syncMode = request.syncMode;
  }

  if (request.eventRetentionDaysBack !== undefined) {
    patch.eventRetentionDaysBack = request.eventRetentionDaysBack;
  }

  if (request.completedTaskRetentionDaysBack !== undefined) {
    patch.completedTaskRetentionDaysBack = request.completedTaskRetentionDaysBack;
  }

  if (request.showTrayIcon !== undefined) {
    patch.showTrayIcon = request.showTrayIcon;
  }

  if (request.trayClickAction !== undefined) {
    patch.trayClickAction = request.trayClickAction;
  }

  if (request.menuBarPanelStyle !== undefined) {
    patch.menuBarPanelStyle = request.menuBarPanelStyle;
  }

  if (request.showMenuBarBadge !== undefined) {
    patch.showMenuBarBadge = request.showMenuBarBadge;
  }

  if (request.notificationsEnabled !== undefined) {
    patch.notificationsEnabled = request.notificationsEnabled;
  }

  if (request.notificationLeadMinutes !== undefined) {
    patch.notificationLeadMinutes = request.notificationLeadMinutes;
  }

  if (request.mcpEnabled !== undefined) {
    patch.mcpEnabled = request.mcpEnabled;
  }

  if (request.mcpPermissionMode !== undefined) {
    patch.mcpPermissionMode = request.mcpPermissionMode;
  }

  if (request.mcpPort !== undefined) {
    patch.mcpPort = request.mcpPort;
  }

  if (request.defaultTimeZone !== undefined) {
    patch.defaultTimeZone = request.defaultTimeZone;
  }

  if (request.todayCapacityMinutes !== undefined) {
    patch.todayCapacityMinutes = request.todayCapacityMinutes;
  }

  if (request.todayWorkingHoursStart !== undefined) {
    patch.todayWorkingHoursStart = request.todayWorkingHoursStart;
  }

  if (request.todayWorkingHoursEnd !== undefined) {
    patch.todayWorkingHoursEnd = request.todayWorkingHoursEnd;
  }

  if (request.diagnosticsIncludePerformance !== undefined) {
    patch.diagnosticsIncludePerformance = request.diagnosticsIncludePerformance;
  }

  if (request.rawGoogleDiagnosticsEnabled !== undefined) {
    patch.rawGoogleDiagnosticsEnabled = request.rawGoogleDiagnosticsEnabled;
  }

  if (request.savedSearchViews !== undefined) {
    patch.savedSearchViews = request.savedSearchViews;
  }

  if (request.savedTaskViews !== undefined) {
    patch.savedTaskViews = request.savedTaskViews;
  }

  return patch;
}

export function recoveryPhrase(
  action: "refresh" | "forceFullResync" | "clearGoogleCache" | "resetOnboarding" | "resetMcpToken"
): string {
  if (action === "forceFullResync") {
    return "FULL RESYNC";
  }

  if (action === "clearGoogleCache") {
    return "CLEAR CACHE";
  }

  if (action === "resetMcpToken") {
    return "RESET MCP TOKEN";
  }

  return "";
}

export function recoveryMessage(
  action: "refresh" | "forceFullResync" | "clearGoogleCache" | "resetOnboarding" | "resetMcpToken"
): string {
  if (action === "forceFullResync") {
    return "Sync checkpoints were cleared and a full resync was requested.";
  }

  if (action === "clearGoogleCache") {
    return "Local Google cache was cleared.";
  }

  if (action === "resetMcpToken") {
    return "MCP bearer token was reset without exposing the new token value.";
  }

  if (action === "resetOnboarding") {
    return "Onboarding will be shown again without changing planner data.";
  }

  return "Refresh requested for selected Google resources.";
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
