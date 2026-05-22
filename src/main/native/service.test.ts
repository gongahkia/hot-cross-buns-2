import { describe, expect, it, vi } from "vitest";
import type {
  CalendarEventSummary,
  NativeAction,
  SettingsSnapshot,
  TaskSummary
} from "@shared/ipc/contracts";
import { NativeShellService, parseHotCrossBunsDeepLink } from "./service";
import type {
  NativeNotificationRequest,
  NativeOperationResult,
  NativePlatformAdapter,
  NativePlatformCapabilities,
  NativeTrayActions,
  ScheduledNativeNotification
} from "./types";

const now = new Date("2026-05-22T12:00:00.000Z");

async function flushNativeStartup(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function defaultSettings(overrides: Partial<SettingsSnapshot> = {}): SettingsSnapshot {
  return {
    theme: "system",
    startOnLogin: false,
    selectedTaskListIds: [],
    selectedCalendarIds: [],
    syncMode: "balanced",
    quickCaptureShortcut: "Ctrl+Space",
    showTrayIcon: true,
    trayClickAction: "toggle-window",
    notificationsEnabled: true,
    notificationLeadMinutes: 10,
    mcpEnabled: false,
    mcpPermissionMode: "confirm-writes",
    mcpPort: 0,
    diagnosticsIncludePerformance: true,
    ...overrides
  };
}

class FakeNativeAdapter implements NativePlatformAdapter {
  capabilitiesValue: NativePlatformCapabilities = {
    platform: "darwin",
    notifications: true,
    globalShortcuts: true,
    tray: true,
    deepLinks: true,
    updaterChecks: false
  };
  shortcutResult: NativeOperationResult = {
    ok: true,
    state: "ready",
    message: "registered"
  };
  trayActions: NativeTrayActions | undefined;
  appMenuActions: NativeTrayActions | undefined;
  registeredShortcuts: string[] = [];
  unregisteredShortcuts: string[] = [];
  protocolSchemes: string[] = [];
  scheduledNotifications: NativeNotificationRequest[] = [];
  trayCreateCount = 0;
  trayDestroyCount = 0;

  capabilities(): NativePlatformCapabilities {
    return this.capabilitiesValue;
  }

  installAppMenu(actions: NativeTrayActions): NativeOperationResult {
    this.appMenuActions = actions;
    return { ok: true, state: "ready", message: "menu" };
  }

  createTray(actions: NativeTrayActions): NativeOperationResult {
    this.trayActions = actions;
    this.trayCreateCount += 1;
    return { ok: true, state: "ready", message: "tray" };
  }

  destroyTray(): void {
    this.trayDestroyCount += 1;
  }

  registerGlobalShortcut(accelerator: string): NativeOperationResult {
    this.registeredShortcuts.push(accelerator);
    return this.shortcutResult;
  }

  unregisterGlobalShortcut(accelerator?: string): void {
    if (accelerator) {
      this.unregisteredShortcuts.push(accelerator);
    }
  }

  registerProtocolClient(scheme: "hotcrossbuns"): NativeOperationResult {
    this.protocolSchemes.push(scheme);
    return { ok: true, state: "ready", message: "protocol" };
  }

  requestNotificationPermission() {
    return { state: "prompt" as const };
  }

  scheduleNotification(request: NativeNotificationRequest): ScheduledNativeNotification {
    this.scheduledNotifications.push(request);
    return {
      id: request.id,
      cancel: () => undefined
    };
  }

  clearScheduledNotifications(): void {
    this.scheduledNotifications = [];
  }

  checkForUpdates(): NativeOperationResult {
    return {
      ok: false,
      state: "unsupported",
      message: "not configured"
    };
  }

  dispose(): void {
    this.registeredShortcuts = [];
    this.scheduledNotifications = [];
  }
}

function createService(input: {
  adapter?: FakeNativeAdapter;
  settings?: SettingsSnapshot;
  tasks?: TaskSummary[];
  events?: CalendarEventSummary[];
  dispatch?: (action: NativeAction) => void;
} = {}) {
  const adapter = input.adapter ?? new FakeNativeAdapter();
  const settings = { current: input.settings ?? defaultSettings() };
  const dispatch = input.dispatch ?? vi.fn();
  const sync = vi.fn();
  const service = new NativeShellService({
    adapter,
    planner: {
      listTasks: () => ({ items: input.tasks ?? [] }),
      listCalendarEvents: () => ({ items: input.events ?? [] })
    },
    settings: {
      get: () => settings.current
    },
    windows: {
      showMainWindow: vi.fn(),
      hideMainWindow: vi.fn(),
      showOrHideMainWindow: vi.fn(),
      quit: vi.fn(),
      dispatchAction: dispatch
    },
    sync: {
      runNow: sync
    },
    now: () => now
  });

  return { adapter, service, settings, dispatch, sync };
}

describe("native shell service", () => {
  it("defers tray, hotkey, notifications, protocol, updater, and MCP startup", async () => {
    const { adapter, service } = createService({
      tasks: [
        {
          id: "task-1",
          listId: "inbox",
          title: "Pay invoice",
          status: "active",
          dueAt: "2026-05-22T00:00:00.000Z",
          updatedAt: now.toISOString(),
          priority: "none"
        }
      ],
      events: [
        {
          id: "event-1",
          calendarId: "cal-1",
          title: "Standup",
          startsAt: "2026-05-22T12:20:00.000Z",
          endsAt: "2026-05-22T12:40:00.000Z",
          allDay: false,
          updatedAt: now.toISOString(),
          reminderMinutes: []
        }
      ]
    });

    expect(service.capabilities().deferredStartup.state).toBe("pending");
    expect(adapter.trayCreateCount).toBe(0);
    expect(adapter.registeredShortcuts).toEqual([]);

    service.startDeferredStartup();
    await flushNativeStartup();

    expect(adapter.trayCreateCount).toBe(1);
    expect(adapter.registeredShortcuts).toEqual(["Ctrl+Space"]);
    expect(adapter.protocolSchemes).toEqual(["hotcrossbuns"]);
    expect(adapter.scheduledNotifications.map((request) => request.id)).toEqual([
      "task:task-1",
      "event:event-1"
    ]);
    expect(service.capabilities()).toMatchObject({
      deferredStartup: {
        state: "complete"
      },
      quickCaptureShortcut: {
        registered: true,
        state: "ready"
      },
      notificationsStatus: {
        scheduledCount: 2,
        state: "ready"
      }
    });
  });

  it("reports recoverable quick capture shortcut conflicts", async () => {
    const adapter = new FakeNativeAdapter();
    adapter.shortcutResult = {
      ok: false,
      state: "conflict",
      message: "Ctrl+Space is already registered by another app."
    };
    const { service } = createService({ adapter });

    service.startDeferredStartup();
    await flushNativeStartup();

    expect(service.capabilities().quickCaptureShortcut).toEqual({
      accelerator: "Ctrl+Space",
      registered: false,
      state: "conflict",
      message: "Ctrl+Space is already registered by another app."
    });
  });

  it("routes tray menu actions without renderer-native calls", async () => {
    const { adapter, dispatch, service, sync } = createService();

    service.startDeferredStartup();
    await flushNativeStartup();
    adapter.trayActions?.quickCapture();
    adapter.trayActions?.openSettings();
    adapter.trayActions?.refresh();

    expect(dispatch).toHaveBeenCalledWith({ type: "quickCapture" });
    expect(dispatch).toHaveBeenCalledWith({ type: "openSettings" });
    expect(dispatch).toHaveBeenCalledWith({ type: "refresh" });
    expect(sync).toHaveBeenCalledWith({
      resources: ["tasks", "calendar"],
      full: false,
      dryRun: false
    });
  });

  it("parses and dispatches custom protocol deep links safely", () => {
    expect(parseHotCrossBunsDeepLink("hotcrossbuns://task/task-1")).toEqual({
      type: "openRoute",
      route: {
        kind: "task",
        id: "task-1"
      }
    });
    expect(parseHotCrossBunsDeepLink("hotcrossbuns://search?q=invoice")).toEqual({
      type: "openRoute",
      route: {
        kind: "search",
        query: "invoice"
      }
    });
    expect(parseHotCrossBunsDeepLink("https://example.com/task/task-1")).toBeNull();

    const dispatch = vi.fn();
    const { service } = createService({ dispatch });

    expect(service.handleDeepLink("hotcrossbuns://event/event-1")).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({
      type: "openRoute",
      route: {
        kind: "event",
        id: "event-1"
      }
    });
  });

  it("keeps disabled tray and notification settings reflected in native status", async () => {
    const { adapter, service } = createService({
      settings: defaultSettings({
        showTrayIcon: false,
        notificationsEnabled: false
      })
    });

    service.startDeferredStartup();
    await flushNativeStartup();

    expect(adapter.trayCreateCount).toBe(0);
    expect(adapter.scheduledNotifications).toEqual([]);
    expect(service.capabilities()).toMatchObject({
      trayStatus: {
        state: "disabled"
      },
      notificationsStatus: {
        state: "disabled",
        scheduledCount: 0
      }
    });
  });
});
