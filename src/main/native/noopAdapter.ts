import type { NativeNotificationPermissionResponse } from "@shared/ipc/contracts";
import {
  HCB_DEEP_LINK_SCHEME,
  type NativeOperationResult,
  type NativePlatformAdapter,
  type NativePlatformCapabilities,
  type NativeNotificationRequest,
  type NativeTrayActions,
  type ScheduledNativeNotification
} from "./types";

export function createNoopNativeAdapter(
  platform: NativePlatformCapabilities["platform"] = nativePlatform()
): NativePlatformAdapter {
  const capabilities: NativePlatformCapabilities = {
    platform,
    notifications: false,
    globalShortcuts: false,
    tray: false,
    deepLinks: false,
    updaterChecks: false
  };

  return {
    capabilities: () => capabilities,
    installAppMenu: (_actions: NativeTrayActions) => unsupported("App menu is unavailable."),
    createTray: (_actions: NativeTrayActions) => unsupported("Tray/menu bar is unavailable."),
    destroyTray: () => undefined,
    registerGlobalShortcut: () => unsupported("Global shortcuts are unavailable."),
    unregisterGlobalShortcut: () => undefined,
    registerProtocolClient: (_scheme: typeof HCB_DEEP_LINK_SCHEME) =>
      unsupported("Protocol registration is unavailable."),
    requestNotificationPermission: (): NativeNotificationPermissionResponse => ({
      state: "unsupported"
    }),
    scheduleNotification: (
      _request: NativeNotificationRequest,
      _onClick: () => void
    ): ScheduledNativeNotification | undefined => undefined,
    clearScheduledNotifications: () => undefined,
    checkForUpdates: () => unsupported("Preview update checks are not configured."),
    dispose: () => undefined
  };
}

function unsupported(message: string): NativeOperationResult {
  return {
    ok: false,
    state: "unsupported",
    message
  };
}

function nativePlatform(): NativePlatformCapabilities["platform"] {
  if (process.platform === "darwin" || process.platform === "linux" || process.platform === "win32") {
    return process.platform;
  }

  return "unknown";
}
