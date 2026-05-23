import type { CoreViewModelSource } from "./coreViewModelSource";

export type AppNotificationTone = "info" | "success" | "warning" | "danger" | "offline";

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  status: string;
  tone: AppNotificationTone;
}

export function getAppNotifications(source: CoreViewModelSource): AppNotification[] {
  const notifications: AppNotification[] = [];

  if (source.dataState === "loading") {
    notifications.push({
      id: "cache.loading",
      title: "Loading local cache",
      description: "Opening SQLite and reading cached planner data.",
      status: "Loading",
      tone: "info"
    });
  } else if (source.dataState === "error") {
    notifications.push({
      id: "cache.error",
      title: "Local cache unavailable",
      description: source.errorMessage ?? "The local cache request failed.",
      status: "Error",
      tone: "danger"
    });
  } else if (source.isOffline) {
    notifications.push({
      id: "cache.offline",
      title: "Offline cache",
      description: source.errorMessage ?? "Google sync is not connected; cached local data remains available.",
      status: "Offline",
      tone: "offline"
    });
  } else if (source.isStale || source.dataState === "stale") {
    notifications.push({
      id: "cache.stale",
      title: "Refreshing local cache",
      description: "Rendering cached rows while a newer read is pending.",
      status: "Stale",
      tone: "info"
    });
  } else if (source.dataState === "empty") {
    notifications.push({
      id: "cache.empty",
      title: "Fresh local cache",
      description: "No cached tasks, events, or notes are stored yet.",
      status: "Empty",
      tone: "warning"
    });
  } else {
    notifications.push({
      id: "cache.ready",
      title: "Local cache ready",
      description: "Tasks, events, notes, and settings are loaded from local services.",
      status: "Ready",
      tone: "success"
    });
  }

  if (source.settingsMutationError) {
    notifications.push({
      id: "settings.error",
      title: "Settings action not applied",
      description: source.settingsMutationError,
      status: "Settings",
      tone: "warning"
    });
  }

  if (source.taskMutationError) {
    notifications.push({
      id: "tasks.error",
      title: "Task action not applied",
      description: source.taskMutationError,
      status: "Tasks",
      tone: "warning"
    });
  }

  return notifications;
}
