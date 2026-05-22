import type {
  CalendarEventSummary,
  NativeAction,
  NativeCapabilitiesResponse,
  NativeFeatureState,
  NativeNotificationPermissionResponse,
  SettingsSnapshot,
  SyncRunNowRequest,
  TaskSummary
} from "@shared/ipc/contracts";

export const HCB_DEEP_LINK_SCHEME = "hotcrossbuns";

export interface NativeOperationResult {
  ok: boolean;
  state?: NativeFeatureState;
  message?: string;
}

export interface NativePlatformCapabilities {
  platform: NativeCapabilitiesResponse["platform"];
  notifications: boolean;
  globalShortcuts: boolean;
  tray: boolean;
  deepLinks: boolean;
  updaterChecks: boolean;
}

export interface NativeTrayActions {
  showOrHideMainWindow: () => void;
  quickCapture: () => void;
  refresh: () => void;
  openSettings: () => void;
  quit: () => void;
}

export interface NativeNotificationRequest {
  id: string;
  title: string;
  body: string;
  deliveryDate: Date;
  action?: NativeAction;
}

export interface ScheduledNativeNotification {
  id: string;
  cancel: () => void;
}

export interface NativePlatformAdapter {
  capabilities: () => NativePlatformCapabilities;
  installAppMenu: (actions: NativeTrayActions) => NativeOperationResult;
  createTray: (actions: NativeTrayActions) => NativeOperationResult;
  destroyTray: () => void;
  registerGlobalShortcut: (
    accelerator: string,
    action: () => void
  ) => NativeOperationResult;
  unregisterGlobalShortcut: (accelerator?: string) => void;
  registerProtocolClient: (scheme: typeof HCB_DEEP_LINK_SCHEME) => NativeOperationResult;
  requestNotificationPermission: () => NativeNotificationPermissionResponse;
  scheduleNotification: (
    request: NativeNotificationRequest,
    onClick: () => void
  ) => ScheduledNativeNotification | undefined;
  clearScheduledNotifications: () => void;
  checkForUpdates: () => NativeOperationResult | Promise<NativeOperationResult>;
  dispose: () => void;
}

export interface NativePlannerSnapshotSource {
  listTasks: (request: { status: "active"; limit: number }) => { items: TaskSummary[] };
  listCalendarEvents: (request: {
    start: string;
    end: string;
    limit: number;
  }) => { items: CalendarEventSummary[] };
}

export interface NativeSettingsSource {
  get: () => SettingsSnapshot;
}

export interface NativeShellWindowActions {
  showMainWindow: () => void;
  hideMainWindow: () => void;
  showOrHideMainWindow: () => void;
  quit: () => void;
  dispatchAction: (action: NativeAction) => void;
}

export interface NativeShellSyncActions {
  runNow: (request: SyncRunNowRequest) => void | Promise<unknown>;
}
