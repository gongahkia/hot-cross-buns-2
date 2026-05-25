import type {
  NativeCapabilitiesResponse,
  NativeFontFamiliesResponse,
  NativeNotificationPermissionResponse,
  NativeRoute,
  SettingsSnapshot
} from "@shared/ipc/contracts";
import type { GoogleAccountConnectionStatusDto } from "../google";
import type { NativeDomainService } from "../services/domainInterfaces";
import { parseHotCrossBunsDeepLink } from "./deepLinks";
import { normalizeFontFamilies } from "./fontFamilies";
import { buildNativeMenuBarSnapshot } from "./menuBarSnapshot";
import { buildNativeNotificationRequests } from "./notificationScheduling";
import {
  featureStatus,
  initialStatus,
  isPromise,
  messageFromError,
  sanitizedNativeMessage,
  statusFromResult,
  updateCapabilityReportStatus
} from "./status";
import {
  HCB_DEEP_LINK_SCHEME,
  type NativeMenuBarSnapshot,
  type NativeOperationResult,
  type NativePlannerSnapshotSource,
  type NativePlatformAdapter,
  type NativeSettingsSource,
  type NativeShellSyncActions,
  type NativeShellWindowActions,
  type NativeTrayActions
} from "./types";

export { parseHotCrossBunsDeepLink } from "./deepLinks";

export interface NativeShellServiceOptions {
  adapter: NativePlatformAdapter;
  planner: NativePlannerSnapshotSource;
  account?: {
    latest: () => GoogleAccountConnectionStatusDto | null;
  };
  settings: NativeSettingsSource;
  windows: NativeShellWindowActions;
  sync: NativeShellSyncActions;
  now?: () => Date;
}

export class NativeShellService implements NativeDomainService {
  private readonly now: () => Date;
  private status: NativeCapabilitiesResponse;
  private currentShortcut: string | null = null;
  private deferredStarted = false;

  constructor(private readonly options: NativeShellServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.status = initialStatus(options.adapter.capabilities(), options.settings.get());
  }

  installAppMenu(): void {
    this.options.adapter.installAppMenu(this.actions());
  }

  startDeferredStartup(): void {
    if (this.deferredStarted) {
      return;
    }

    this.deferredStarted = true;
    this.status = {
      ...this.status,
      deferredStartup: {
        state: "running",
        startedAt: this.now().toISOString()
      }
    };

    setTimeout(() => {
      void this.runDeferredStartup();
    }, 0);
  }

  applySettings(snapshot: SettingsSnapshot): void {
    this.status = {
      ...this.status,
      mcpStatus: snapshot.mcpEnabled
        ? featureStatus("pending", "MCP listener startup is managed by the main runtime service.")
        : featureStatus("disabled", "MCP local agent access is disabled.")
    };

    if (!snapshot.showTrayIcon) {
      this.options.adapter.destroyTray();
      this.status = {
        ...this.status,
        trayStatus: featureStatus("disabled", "Menu bar icon is disabled in Settings.")
      };
    } else if (this.deferredStarted && this.status.trayStatus.state === "disabled") {
      this.setupTray();
    } else if (this.deferredStarted && this.status.trayStatus.state === "ready") {
      this.setupTray();
    }

    if (!snapshot.notificationsEnabled) {
      this.options.adapter.clearScheduledNotifications();
      this.status = {
        ...this.status,
        notificationsStatus: {
          ...this.status.notificationsStatus,
          scheduledCount: 0,
          state: "disabled",
          message: "Local notifications are disabled in Settings."
        }
      };
    } else if (this.deferredStarted) {
      this.scheduleNotificationsFromCache();
    }

    if (this.deferredStarted) {
      this.applyAutostartSetting(snapshot.startOnLogin);
    }

    const quickCaptureShortcut = snapshot.globalQuickAddHotkeyEnabled
      ? snapshot.quickCaptureShortcut
      : null;

    if (!this.deferredStarted) {
      this.status = {
        ...this.status,
        quickCaptureShortcut: {
          ...this.status.quickCaptureShortcut,
          accelerator: quickCaptureShortcut,
          state: quickCaptureShortcut ? "pending" : "disabled",
          registered: false,
          ...(quickCaptureShortcut ? {} : { message: "Global quick-add hotkey is disabled in Settings." })
        }
      };
      return;
    }

    this.registerQuickCaptureShortcut(quickCaptureShortcut);
  }

  capabilities(): NativeCapabilitiesResponse {
    return structuredClone(this.status);
  }

  async listFontFamilies(): Promise<NativeFontFamiliesResponse> {
    const families = normalizeFontFamilies(await this.options.adapter.listFontFamilies());

    return {
      platform: this.status.platform,
      families
    };
  }

  requestNotificationPermission(): NativeNotificationPermissionResponse {
    const permission = this.options.adapter.requestNotificationPermission();

    this.status = {
      ...this.status,
      notificationsStatus: {
        ...this.status.notificationsStatus,
        permission: permission.state,
        state: permission.state === "unsupported" ? "unsupported" : "ready",
        message:
          permission.state === "unsupported"
            ? "Local notifications are not supported by this platform adapter."
            : "Notification permission request was handed to the operating system."
      }
    };

    return permission;
  }

  rescheduleNotificationsForDiagnostics(): NativeCapabilitiesResponse["notificationsStatus"] {
    this.scheduleNotificationsFromCache();

    return structuredClone(this.status.notificationsStatus);
  }

  handleDeepLink(rawUrl: string): boolean {
    const action = parseHotCrossBunsDeepLink(rawUrl);

    if (!action) {
      this.status = {
        ...this.status,
        deepLinkStatus: {
          ...this.status.deepLinkStatus,
          state: "error",
          message: "Ignored malformed hotcrossbuns deep link."
        }
      };
      return false;
    }

    this.options.windows.showMainWindow();
    this.options.windows.dispatchAction(action);
    this.status = {
      ...this.status,
      deepLinkStatus: {
        ...this.status.deepLinkStatus,
        state: this.status.deepLinkStatus.registered ? "ready" : this.status.deepLinkStatus.state,
        message: "Last deep link was routed to the renderer through preload."
      }
    };

    return true;
  }

  dispose(): void {
    this.options.adapter.dispose();
  }

  private async runDeferredStartup(): Promise<void> {
    try {
      this.setupTray();
      const settings = this.options.settings.get();
      this.registerQuickCaptureShortcut(
        settings.globalQuickAddHotkeyEnabled ? settings.quickCaptureShortcut : null
      );
      this.registerProtocolClient();
      this.scheduleNotificationsFromCache();
      await this.checkForUpdates();
      this.applyAutostartSetting(settings.startOnLogin);
      this.updateMcpDeferredStatus(settings);
      this.status = {
        ...this.status,
        deferredStartup: {
          ...this.status.deferredStartup,
          state: "complete",
          completedAt: this.now().toISOString()
        }
      };
    } catch (error) {
      this.status = {
        ...this.status,
        deferredStartup: {
          ...this.status.deferredStartup,
          state: "error",
          message: messageFromError(error, "Deferred native startup failed.")
        }
      };
    }
  }

  private actions(): NativeTrayActions {
    return {
      primaryClick: () => this.handleTrayPrimaryAction(),
      openMainWindow: this.options.windows.showMainWindow,
      showOrHideMainWindow: this.options.windows.showOrHideMainWindow,
      quickCapture: () => {
        this.options.windows.showMainWindow();
        this.options.windows.dispatchAction({ type: "quickCapture" });
      },
      refresh: () => {
        this.options.windows.showMainWindow();
        this.options.windows.dispatchAction({ type: "refresh" });
        void this.options.sync.runNow({
          resources: ["tasks", "calendar"],
          full: false,
          dryRun: false
        });
      },
      openSettings: () => {
        this.options.windows.showMainWindow();
        this.options.windows.dispatchAction({ type: "openSettings" });
      },
      openRoute: (route: NativeRoute) => {
        this.options.windows.showMainWindow();
        this.options.windows.dispatchAction({ type: "openRoute", route });
      },
      snapshot: () => this.menuBarSnapshot(),
      quit: this.options.windows.quit
    };
  }

  private setupTray(): void {
    if (!this.status.tray) {
      this.status = {
        ...this.status,
        trayStatus: featureStatus("unsupported", "Tray/menu bar adapter is unavailable.")
      };
      return;
    }

    if (!this.options.settings.get().showTrayIcon) {
      this.status = {
        ...this.status,
        trayStatus: featureStatus("disabled", "Menu bar icon is disabled in Settings.")
      };
      return;
    }

    const result = this.options.adapter.createTray(this.actions());
    this.status = {
      ...this.status,
      trayStatus: statusFromResult(result, "ready", "Menu bar item is ready.")
    };
  }

  private registerQuickCaptureShortcut(accelerator: string | null): void {
    if (this.currentShortcut) {
      this.options.adapter.unregisterGlobalShortcut(this.currentShortcut);
      this.currentShortcut = null;
    }

    if (!accelerator) {
      this.status = {
        ...this.status,
        quickCaptureShortcut: {
          accelerator,
          registered: false,
          state: "disabled",
          message: "Quick capture shortcut is not configured."
        }
      };
      return;
    }

    if (!this.status.globalShortcuts) {
      this.status = {
        ...this.status,
        quickCaptureShortcut: {
          accelerator,
          registered: false,
          state: "unsupported",
          message: "Global shortcuts are not supported by this platform adapter."
        }
      };
      return;
    }

    const result = this.options.adapter.registerGlobalShortcut(accelerator, () => {
      this.options.windows.showMainWindow();
      this.options.windows.dispatchAction({ type: "quickCapture" });
    });

    if (result.ok) {
      this.currentShortcut = accelerator;
    }

    this.status = {
      ...this.status,
      quickCaptureShortcut: {
        accelerator,
        registered: result.ok,
        state: result.ok ? "ready" : result.state ?? "conflict",
        message: sanitizedNativeMessage(
          result.message ??
            (result.ok ? "Quick capture shortcut is registered." : "Shortcut registration failed.")
        )
      }
    };
  }

  private registerProtocolClient(): void {
    if (!this.status.deepLinks) {
      this.status = {
        ...this.status,
        deepLinkStatus: {
          scheme: HCB_DEEP_LINK_SCHEME,
          registered: false,
          state: "unsupported",
          message: "Deep links are not supported by this platform adapter."
        }
      };
      return;
    }

    const result = this.options.adapter.registerProtocolClient(HCB_DEEP_LINK_SCHEME);
    this.status = {
      ...this.status,
      deepLinkStatus: {
        scheme: HCB_DEEP_LINK_SCHEME,
        registered: result.ok,
        state: result.ok ? "ready" : result.state ?? "error",
        message: sanitizedNativeMessage(
          result.message ??
            (result.ok ? "Protocol handler is registered." : "Protocol handler registration failed.")
        )
      }
    };
  }

  private scheduleNotificationsFromCache(): void {
    if (!this.status.notifications) {
      this.status = {
        ...this.status,
        notificationsStatus: {
          permission: "unsupported",
          scheduledCount: 0,
          state: "unsupported",
          message: "Local notifications are not supported by this platform adapter."
        }
      };
      return;
    }

    const settings = this.options.settings.get();

    if (!settings.notificationsEnabled) {
      this.options.adapter.clearScheduledNotifications();
      this.status = {
        ...this.status,
        notificationsStatus: {
          ...this.status.notificationsStatus,
          scheduledCount: 0,
          state: "disabled",
          message: "Local notifications are disabled in Settings."
        }
      };
      return;
    }

    this.options.adapter.clearScheduledNotifications();

    const requests = buildNativeNotificationRequests({
      planner: this.options.planner,
      now: this.now(),
      leadMinutes: settings.notificationLeadMinutes
    });
    let scheduledCount = 0;

    for (const request of requests) {
      const scheduled = this.options.adapter.scheduleNotification(request, () => {
        if (request.action) {
          this.options.windows.showMainWindow();
          this.options.windows.dispatchAction(request.action);
        }
      });

      if (scheduled) {
        scheduledCount += 1;
      }
    }

    this.status = {
      ...this.status,
      notificationsStatus: {
        ...this.status.notificationsStatus,
        scheduledCount,
        state: "ready",
        message:
          scheduledCount === 0
            ? "No due tasks or upcoming events are in the next 24 hours."
            : `${scheduledCount} local notification${scheduledCount === 1 ? "" : "s"} scheduled.`
      }
    };
  }

  private menuBarSnapshot(): NativeMenuBarSnapshot {
    return buildNativeMenuBarSnapshot({
      planner: this.options.planner,
      settings: this.options.settings.get(),
      account: this.options.account?.latest() ?? null,
      now: this.now()
    });
  }

  private checkForUpdates(): void | Promise<void> {
    const result = this.options.adapter.checkForUpdates();

    if (isPromise(result)) {
      return result.then((resolved) => {
        this.applyUpdateStatus(resolved);
      });
    }

    this.applyUpdateStatus(result);
  }

  private applyUpdateStatus(result: NativeOperationResult): void {
    this.status = {
      ...this.status,
      updaterStatus: statusFromResult(
        result,
        "ready",
        "Preview update check completed without blocking startup."
      )
    };
  }

  private handleTrayPrimaryAction(): void {
    const action = this.options.settings.get().trayClickAction;

    if (action === "quick-capture") {
      this.options.windows.showMainWindow();
      this.options.windows.dispatchAction({ type: "quickCapture" });
      return;
    }

    if (action === "open-today") {
      this.options.windows.showMainWindow();
      this.options.windows.dispatchAction({ type: "openRoute", route: { kind: "today" } });
      return;
    }

    if (action === "open-menu") {
      return;
    }

    this.options.windows.showOrHideMainWindow();
  }

  private updateMcpDeferredStatus(settings: SettingsSnapshot): void {
    this.status = {
      ...this.status,
      mcpStatus: settings.mcpEnabled
        ? featureStatus("pending", "MCP listener startup is managed by the main runtime service.")
        : featureStatus("disabled", "MCP local agent access is disabled.")
    };
  }

  private applyAutostartSetting(enabled: boolean): void {
    const result = this.options.adapter.setAutostart(enabled);

    this.status = {
      ...this.status,
      capabilityReport: updateCapabilityReportStatus(
        this.status.capabilityReport,
        "autostart",
        result,
        enabled ? "Open-at-login is enabled." : "Open-at-login is disabled."
      )
    };
  }
}
