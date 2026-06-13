import {
  HCB_DEEP_LINK_SCHEME,
  type NativeAppPaths,
  type NativeNotificationRequest,
  type NativeOperationResult,
  type NativePlatformAdapter,
  type NativePlatformCapabilities,
  type NativeTrayActions,
  type ScheduledNativeNotification
} from "./types";
import {
  appPaths,
  autostartStatus,
  capabilities,
  checkForUpdates,
  collectDiagnostics,
  credentialStorageStatus,
  installAppMenu,
  openExternalUrl,
  openPath,
  registerProtocolClient,
  setAutostart
} from "./electronLinux/appEnvironment";
import { unsupported } from "./electronLinux/operationResults";
import { LinuxGlobalShortcutRegistry } from "./electronLinux/globalShortcuts";
import { LinuxNotificationScheduler } from "./electronLinux/notifications";

export function createElectronLinuxNativeAdapter(): NativePlatformAdapter {
  return new ElectronLinuxNativeAdapter();
}

class ElectronLinuxNativeAdapter implements NativePlatformAdapter {
  private readonly shortcuts = new LinuxGlobalShortcutRegistry();
  private readonly notifications = new LinuxNotificationScheduler();

  appPaths(): NativeAppPaths {
    return appPaths();
  }

  capabilities(): NativePlatformCapabilities {
    return capabilities();
  }

  credentialStorageStatus(): NativeOperationResult {
    return credentialStorageStatus();
  }

  installAppMenu(_actions: NativeTrayActions): NativeOperationResult {
    return installAppMenu();
  }

  createTray(_actions: NativeTrayActions): NativeOperationResult {
    return unsupported("Linux tray/status-area support is not enabled in the technical preview scaffold.");
  }

  destroyTray(): void {
    return undefined;
  }

  registerGlobalShortcut(accelerator: string, action: () => void): NativeOperationResult {
    return this.shortcuts.register(accelerator, action);
  }

  unregisterGlobalShortcut(accelerator?: string): void {
    this.shortcuts.unregister(accelerator);
  }

  registerProtocolClient(scheme: typeof HCB_DEEP_LINK_SCHEME): NativeOperationResult {
    return registerProtocolClient(scheme);
  }

  requestNotificationPermission() {
    return {
      state: "unsupported" as const
    };
  }

  listFontFamilies(): string[] {
    return [];
  }

  scheduleNotification(
    request: NativeNotificationRequest,
    onClick: () => void,
    onFailure?: (message: string) => void
  ): ScheduledNativeNotification | undefined {
    return this.notifications.schedule(request, onClick, onFailure);
  }

  clearScheduledNotifications(): void {
    this.notifications.clear();
  }

  setAutostart(enabled: boolean): NativeOperationResult {
    return setAutostart(enabled);
  }

  autostartStatus(): NativeOperationResult {
    return autostartStatus();
  }

  checkForUpdates(): NativeOperationResult {
    return checkForUpdates();
  }

  async openExternalUrl(url: string): Promise<NativeOperationResult> {
    return openExternalUrl(url);
  }

  async openPath(path: string): Promise<NativeOperationResult> {
    return openPath(path);
  }

  collectDiagnostics(): NativeOperationResult {
    return collectDiagnostics();
  }

  dispose(): void {
    this.unregisterGlobalShortcut();
    this.clearScheduledNotifications();
  }
}
