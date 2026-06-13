import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  nativeCapabilitiesResponseSchema,
  type SettingsSnapshot
} from "@shared/ipc/contracts";
import {
  defaultHistoryCategoryVisibility,
  defaultKeybindings,
  defaultLeaderKey,
  defaultLeaderKeybindings
} from "@shared/settingsCatalog";
import { defaultSemanticSearchModels } from "@shared/ipc/contracts";
import {
  nativeAdapterKindForPlatform,
  nativePlatformFromNodePlatform
} from "./createNativeAdapter";
import type { LinuxSafeStorageBackendName } from "../credentials/secretStore";
import { createElectronLinuxNativeAdapter } from "./electronLinuxAdapter";
import { createNoopNativeAdapter } from "./noopAdapter";
import { NativeShellService } from "./service";

const electronMock = vi.hoisted(() => {
  const paths: Record<string, string> = {
    userData: "/home/test/.config/Hot Cross Buns 2",
    sessionData: "/home/test/.cache/Hot Cross Buns 2",
    logs: "/home/test/.local/state/Hot Cross Buns 2/logs",
    temp: "/tmp"
  };
  const notificationInstances: MockNotification[] = [];

  class MockNotification {
    static isSupported = vi.fn(() => true);

    readonly listeners = new Map<string, (...args: unknown[]) => void>();
    readonly show = vi.fn();
    readonly close = vi.fn();

    constructor(readonly options: Record<string, unknown>) {
      notificationInstances.push(this);
    }

    on(event: string, listener: (...args: unknown[]) => void): this {
      this.listeners.set(event, listener);
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      this.listeners.get(event)?.({}, ...args);
    }
  }

  return {
    Notification: MockNotification,
    notificationInstances,
    app: {
      isPackaged: false,
      getName: vi.fn(() => "Hot Cross Buns 2"),
      getPath: vi.fn((name: string) => paths[name] ?? `/tmp/hcb-${name}`)
    },
    globalShortcut: {
      register: vi.fn((_accelerator: string, _action: () => void) => true),
      unregister: vi.fn((_accelerator: string) => undefined)
    },
    shell: {
      openExternal: vi.fn(async () => undefined),
      openPath: vi.fn(async () => "")
    },
    safeStorage: {
      decryptString: vi.fn((encrypted: Buffer) => encrypted.toString("utf8").replace(/^encrypted:/, "")),
      encryptString: vi.fn((plainText: string) => Buffer.from(`encrypted:${plainText}`, "utf8")),
      getSelectedStorageBackend: vi.fn<() => LinuxSafeStorageBackendName>(() => "gnome_libsecret"),
      isEncryptionAvailable: vi.fn(() => true),
      setUsePlainTextEncryption: vi.fn()
    }
  };
});

vi.mock("electron", () => electronMock);

const originalAppImage = process.env.APPIMAGE;
const originalDisplay = process.env.DISPLAY;
const originalGlobalShortcutsPortal = process.env.HCB_LINUX_GLOBAL_SHORTCUTS_PORTAL;
const originalSessionType = process.env.XDG_SESSION_TYPE;

beforeEach(() => {
  electronMock.Notification.isSupported.mockReset();
  electronMock.Notification.isSupported.mockReturnValue(true);
  electronMock.notificationInstances.length = 0;
  electronMock.globalShortcut.register.mockReset();
  electronMock.globalShortcut.register.mockReturnValue(true);
  electronMock.globalShortcut.unregister.mockReset();
  electronMock.app.isPackaged = false;
  electronMock.app.getPath.mockClear();
  electronMock.shell.openExternal.mockReset();
  electronMock.shell.openExternal.mockResolvedValue(undefined);
  electronMock.shell.openPath.mockReset();
  electronMock.shell.openPath.mockResolvedValue("");
  electronMock.safeStorage.decryptString.mockClear();
  electronMock.safeStorage.encryptString.mockClear();
  electronMock.safeStorage.getSelectedStorageBackend.mockClear();
  electronMock.safeStorage.getSelectedStorageBackend.mockReturnValue("gnome_libsecret");
  electronMock.safeStorage.isEncryptionAvailable.mockClear();
  electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(true);
  electronMock.safeStorage.setUsePlainTextEncryption.mockClear();

  if (originalAppImage === undefined) {
    delete process.env.APPIMAGE;
  } else {
    process.env.APPIMAGE = originalAppImage;
  }

  process.env.DISPLAY = ":1";
  delete process.env.HCB_LINUX_GLOBAL_SHORTCUTS_PORTAL;
  process.env.XDG_SESSION_TYPE = "x11";
});

afterEach(() => {
  vi.useRealTimers();

  if (originalDisplay === undefined) {
    delete process.env.DISPLAY;
  } else {
    process.env.DISPLAY = originalDisplay;
  }

  if (originalGlobalShortcutsPortal === undefined) {
    delete process.env.HCB_LINUX_GLOBAL_SHORTCUTS_PORTAL;
  } else {
    process.env.HCB_LINUX_GLOBAL_SHORTCUTS_PORTAL = originalGlobalShortcutsPortal;
  }

  if (originalSessionType === undefined) {
    delete process.env.XDG_SESSION_TYPE;
  } else {
    process.env.XDG_SESSION_TYPE = originalSessionType;
  }
});

function defaultSettings(overrides: Partial<SettingsSnapshot> = {}): SettingsSnapshot {
  return {
    theme: "system",
    colorTheme: "notion",
    customBackground: null,
    useInferredBackgroundTheme: true,
    appLanguage: "system",
    uiFontName: null,
    uiTextSizePoints: 13,
    perSurfaceFontOverrides: {},
    calendarEventColorOverrides: {},
    autoTagRules: [],
    autoTagBackgroundReapplyMode: "preview",
    disableAnimations: false,
    uiLayoutScale: 1,
    navigationPlacement: "left",
    hiddenNavigationTabs: [],
    navigationTabOrder: ["calendar", "tasks", "notes"],
    toolbarActionOrder: ["commandPalette", "notifications", "diagnostics", "splitPane", "refresh", "settings"],
    hiddenCalendarViewModes: [],
    showCompletedInCalendarViews: true,
    eventCompletionDefaultScope: "occurrence",
    calendarTimelineDensity: "compact",
    monthScrollPastMonths: 0,
    monthScrollFutureMonths: 1,
    quickCreateExpandedByDefault: false,
    restoreWindowStateEnabled: true,
    startOnLogin: false,
    selectedTaskListIds: [],
    selectedCalendarIds: [],
    setupCompletedAt: "2026-05-22T00:00:00.000Z",
    syncMode: "balanced",
    syncTasksEnabled: true,
    syncCalendarEventsEnabled: true,
    eventRetentionDaysBack: 0,
    completedTaskRetentionDaysBack: 365,
    keybindings: defaultKeybindings,
    leaderKey: defaultLeaderKey,
    leaderKeybindings: defaultLeaderKeybindings,
    showTrayIcon: true,
    trayClickAction: "open-menu",
    menuBarPanelStyle: "adaptive",
    menuBarIconName: "calendar",
    menuBarCalendarIconId: "calendar",
    menuBarCalendarDoneMode: "visibleTodayDone",
    customMenuBarIcons: [],
    showMenuBarBadge: true,
    showDockBadge: true,
    notificationsEnabled: true,
    notificationLeadMinutes: 10,
    taskCompletionSoundEnabled: true,
    taskCompletionSoundId: "glass",
    eventCompletionSoundEnabled: true,
    eventCompletionSoundId: "pop",
    importedSoundCount: 0,
    perTabListFilters: {
      tasks: { useCustomFilter: false, selectedTaskListIds: [] },
      notes: { useCustomFilter: false, selectedTaskListIds: [] }
    },
    portableExportOnlySelectedTaskLists: false,
    portableExportOnlySelectedCalendars: false,
    portableExportOnlyFutureCurrentEvents: false,
    dailyLocalBackupEnabled: false,
    localBackupRetentionCount: 14,
    lastLocalBackupAt: null,
    visibleHistoryEntryCount: 50,
    historyStorageCap: 5_000,
    historyCategoryVisibility: defaultHistoryCategoryVisibility,
    dismissedDuplicateGroupIds: [],
    taskTemplates: [],
    eventTemplates: [],
    noteTemplates: [],
    lastUpdateCheckAt: null,
    mcpEnabled: false,
    mcpPermissionMode: "confirm-writes",
    mcpPort: 0,
    defaultTimeZone: "UTC",
    todayCapacityMinutes: 480,
    todayWorkingHoursStart: 6,
    todayWorkingHoursEnd: 22,
    diagnosticsIncludePerformance: true,
    rawGoogleDiagnosticsEnabled: false,
    savedSearchViews: [],
    pinnedSavedSearchViewIds: [],
    savedTaskViews: [],
    semanticSearchEnabled: false,
    semanticSearchMode: "lexical",
    embeddingModelId: "hcb-local-hash-384",
    semanticSearchModels: defaultSemanticSearchModels,
    agentActionTrayEnabled: true,
    webhooksEnabled: false,
    ...overrides
  };
}

function createContractService(adapter = createElectronLinuxNativeAdapter()): NativeShellService {
  return new NativeShellService({
    adapter,
    planner: {
      listTasks: () => ({ items: [] }),
      listCalendarEvents: () => ({ items: [] })
    },
    settings: {
      get: () => defaultSettings()
    },
    windows: {
      showMainWindow: vi.fn(),
      hideMainWindow: vi.fn(),
      showOrHideMainWindow: vi.fn(),
      quit: vi.fn(),
      dispatchAction: vi.fn()
    },
    sync: {
      runNow: vi.fn()
    }
  });
}

describe("native adapter factory", () => {
  it("selects the expected adapter kind for each supported platform family", () => {
    expect(nativePlatformFromNodePlatform("darwin")).toBe("darwin");
    expect(nativePlatformFromNodePlatform("linux")).toBe("linux");
    expect(nativePlatformFromNodePlatform("win32")).toBe("win32");
    expect(nativePlatformFromNodePlatform("freebsd")).toBe("unknown");

    expect(nativeAdapterKindForPlatform("darwin")).toBe("electron-mac");
    expect(nativeAdapterKindForPlatform("linux")).toBe("electron-linux-preview");
    expect(nativeAdapterKindForPlatform("win32")).toBe("noop");
    expect(nativeAdapterKindForPlatform("freebsd")).toBe("noop");
  });
});

describe("native adapter contract", () => {
  it("reports schema-valid Linux preview capabilities", () => {
    const adapter = createElectronLinuxNativeAdapter();
    const service = createContractService(adapter);
    const response = service.capabilities();
    const report = response.capabilityReport;
    const parsed = nativeCapabilitiesResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    expect(response.platform).toBe("linux");
    expect(report.platform).toBe("linux");
    expect(report.adapterId).toBe("electron-linux-preview");
    expect(report.adapterId).not.toContain("mac");
    expect(response).toMatchObject({
      notifications: true,
      globalShortcuts: true,
      tray: false,
      deepLinks: false
    });
    expect(report.flags).toMatchObject({
      supportsAppPaths: true,
      supportsExternalUrlOpen: true,
      supportsDiagnosticsCollection: true,
      supportsCredentialStorage: true,
      supportsTray: false,
      supportsGlobalShortcut: true,
      supportsNotifications: true,
      supportsProtocolRegistration: false,
      supportsAutostart: false,
      supportsInPlaceAutoUpdate: false
    });
    expect(report.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "credentialStorage",
          supported: true,
          state: "ready"
        }),
        expect.objectContaining({
          key: "tray",
          supported: false,
          state: "unsupported"
        }),
        expect.objectContaining({
          key: "globalShortcuts",
          supported: true,
          state: "pending"
        }),
        expect.objectContaining({
          key: "notifications",
          supported: true,
          state: "ready"
        }),
        expect.objectContaining({
          key: "updater",
          supported: false,
          state: "ready"
        })
      ])
    );
    expect(adapter.credentialStorageStatus()).toMatchObject({
      ok: true,
      state: "ready"
    });
  });

  it("reports Linux notifications unsupported when Electron cannot deliver them", () => {
    electronMock.Notification.isSupported.mockReturnValue(false);

    const adapter = createElectronLinuxNativeAdapter();
    const response = createContractService(adapter).capabilities();
    const notificationCapability = response.capabilityReport.capabilities.find(
      (capability) => capability.key === "notifications"
    );

    expect(response.notifications).toBe(false);
    expect(response.capabilityReport.flags.supportsNotifications).toBe(false);
    expect(notificationCapability).toMatchObject({
      supported: false,
      state: "unsupported"
    });
  });

  it("gates Linux Wayland shortcuts behind XDG Desktop Portal support", () => {
    process.env.XDG_SESSION_TYPE = "wayland";
    delete process.env.DISPLAY;
    process.env.HCB_LINUX_GLOBAL_SHORTCUTS_PORTAL = "0";

    const missingPortal = createElectronLinuxNativeAdapter();
    const missingPortalReport = missingPortal.capabilities().capabilityReport;

    expect(missingPortal.capabilities().globalShortcuts).toBe(false);
    expect(missingPortalReport.flags).toMatchObject({
      hasWaylandSession: true,
      hasPortalShortcutSupport: false,
      supportsGlobalShortcut: false
    });
    expect(missingPortal.registerGlobalShortcut("CommandOrControl+Shift+Space", vi.fn())).toMatchObject({
      ok: false,
      state: "unsupported"
    });

    process.env.HCB_LINUX_GLOBAL_SHORTCUTS_PORTAL = "1";

    const portalReady = createElectronLinuxNativeAdapter();

    expect(portalReady.capabilities().globalShortcuts).toBe(true);
    expect(portalReady.capabilities().capabilityReport.flags).toMatchObject({
      hasWaylandSession: true,
      hasPortalShortcutSupport: true,
      supportsGlobalShortcut: true
    });
  });

  it("maps Linux app path roles through Electron path APIs", () => {
    const adapter = createElectronLinuxNativeAdapter();

    expect(adapter.appPaths()).toEqual({
      configDirectory: "/home/test/.config/Hot Cross Buns 2",
      dataDirectory: "/home/test/.config/Hot Cross Buns 2/data",
      cacheDirectory: "/home/test/.cache/Hot Cross Buns 2",
      logsDirectory: "/home/test/.local/state/Hot Cross Buns 2/logs",
      diagnosticsDirectory: "/home/test/.config/Hot Cross Buns 2/diagnostics",
      tempDirectory: "/tmp/hot-cross-buns-2"
    });
    expect(electronMock.app.getPath).toHaveBeenCalledWith("userData");
    expect(electronMock.app.getPath).toHaveBeenCalledWith("sessionData");
    expect(electronMock.app.getPath).toHaveBeenCalledWith("logs");
    expect(electronMock.app.getPath).toHaveBeenCalledWith("temp");
  });

  it("keeps Linux unsupported native features recoverable", () => {
    const adapter = createElectronLinuxNativeAdapter();

    electronMock.safeStorage.getSelectedStorageBackend.mockReturnValueOnce("basic_text");
    expect(adapter.credentialStorageStatus()).toMatchObject({
      ok: false,
      state: "unsupported"
    });
    expect(adapter.createTray({} as never)).toMatchObject({
      ok: false,
      state: "unsupported",
      message: expect.stringContaining("explicitly unsupported")
    });
    expect(adapter.registerProtocolClient("hotcrossbuns")).toMatchObject({
      ok: false,
      state: "unsupported",
      message: expect.stringContaining("explicitly unsupported")
    });
    expect(adapter.setAutostart(true)).toMatchObject({
      ok: false,
      state: "unsupported",
      message: expect.stringContaining("explicitly unsupported")
    });
    expect(adapter.requestNotificationPermission()).toEqual({
      state: "unsupported"
    });
    expect(adapter.collectDiagnostics()).toMatchObject({
      ok: true,
      state: "ready"
    });
  });

  it("registers Linux global shortcuts through Electron on supported sessions", () => {
    const adapter = createElectronLinuxNativeAdapter();
    const action = vi.fn();

    expect(adapter.registerGlobalShortcut("CommandOrControl+Shift+Space", action)).toMatchObject({
      ok: true,
      state: "ready"
    });
    expect(electronMock.globalShortcut.register).toHaveBeenCalledWith(
      "CommandOrControl+Shift+Space",
      action
    );

    adapter.unregisterGlobalShortcut("CommandOrControl+Shift+Space");

    expect(electronMock.globalShortcut.unregister).toHaveBeenCalledWith(
      "CommandOrControl+Shift+Space"
    );
  });

  it("reports Linux global shortcut registration conflicts with recovery guidance", () => {
    electronMock.globalShortcut.register.mockReturnValueOnce(false);

    const adapter = createElectronLinuxNativeAdapter();

    expect(adapter.registerGlobalShortcut("CommandOrControl+Shift+Space", vi.fn())).toMatchObject({
      ok: false,
      state: "conflict",
      message: expect.stringContaining("Use in-app quick add")
    });
  });

  it("schedules Linux notifications through Electron and routes notification clicks", () => {
    vi.useFakeTimers();
    const adapter = createElectronLinuxNativeAdapter();
    const onClick = vi.fn();
    const onFailure = vi.fn();

    const scheduled = adapter.scheduleNotification({
      id: "task:task-1",
      title: "Task due",
      body: "Pay invoice",
      deliveryDate: new Date(Date.now() + 1_000),
      action: {
        type: "openRoute",
        route: {
          kind: "task",
          id: "task-1"
        }
      }
    }, onClick, onFailure);

    expect(scheduled).toMatchObject({ id: "task:task-1" });
    vi.advanceTimersByTime(1_000);

    expect(electronMock.notificationInstances).toHaveLength(1);
    expect(electronMock.notificationInstances[0].options).toMatchObject({
      title: "Task due",
      body: "Pay invoice",
      timeoutType: "default",
      urgency: "normal"
    });

    electronMock.notificationInstances[0].emit("click");

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports Linux notification display failures to the caller", () => {
    vi.useFakeTimers();
    const adapter = createElectronLinuxNativeAdapter();
    const onFailure = vi.fn();

    adapter.scheduleNotification({
      id: "event:event-1",
      title: "Upcoming event",
      body: "Standup",
      deliveryDate: new Date(Date.now())
    }, vi.fn(), onFailure);
    vi.advanceTimersByTime(0);
    electronMock.notificationInstances[0].emit("failed", "libnotify service unavailable");

    expect(onFailure).toHaveBeenCalledWith(
      "Native notification failed: libnotify service unavailable"
    );
  });

  it("sanitizes Linux shell open failures", async () => {
    const adapter = createElectronLinuxNativeAdapter();

    electronMock.shell.openExternal.mockRejectedValueOnce(
      new Error("failed to open https://example.test/?token=secret-value from /home/test/.config")
    );
    await expect(adapter.openExternalUrl("https://example.test/?token=secret-value")).resolves.toEqual({
      ok: false,
      state: "error",
      message: "External URL could not be opened by the operating system."
    });

    electronMock.shell.openPath.mockResolvedValueOnce(
      "failed to open /home/test/.config/Hot Cross Buns 2/token-file"
    );
    await expect(adapter.openPath("/home/test/.config/Hot Cross Buns 2/token-file")).resolves.toEqual({
      ok: false,
      state: "error",
      message: "Path could not be opened by the operating system."
    });
  });

  it("reports every required capability through the noop adapter without claiming Linux support", () => {
    const adapter = createNoopNativeAdapter("linux");
    const report = adapter.capabilities().capabilityReport;

    expect(report.platform).toBe("linux");
    expect(report.flags).toMatchObject({
      supportsAppPaths: true,
      supportsTray: false,
      supportsGlobalShortcut: false,
      supportsNotifications: false,
      supportsCredentialStorage: false,
      supportsInPlaceAutoUpdate: false
    });
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        key: "packaging",
        severity: "blocker"
      })
    );
    expect(report.capabilities.map((capability) => capability.key)).toEqual(
      expect.arrayContaining([
        "appPaths",
        "credentialStorage",
        "tray",
        "appMenu",
        "globalShortcuts",
        "notifications",
        "customProtocol",
        "autostart",
        "updater",
        "installerMetadata",
        "externalOpen",
        "diagnostics",
        "oauthLoopback",
        "mcpLoopback",
        "packaging"
      ])
    );
  });

  it("keeps unsupported platform operations recoverable and schema-valid", () => {
    const adapter = createNoopNativeAdapter("win32");
    const service = new NativeShellService({
      adapter,
      planner: {
        listTasks: () => ({ items: [] }),
        listCalendarEvents: () => ({ items: [] })
      },
      settings: {
        get: () => defaultSettings()
      },
      windows: {
        showMainWindow: vi.fn(),
        hideMainWindow: vi.fn(),
        showOrHideMainWindow: vi.fn(),
        quit: vi.fn(),
        dispatchAction: vi.fn()
      },
      sync: {
        runNow: vi.fn()
      }
    });

    const parsed = nativeCapabilitiesResponseSchema.safeParse(service.capabilities());

    expect(parsed.success).toBe(true);
    expect(adapter.setAutostart(true)).toMatchObject({
      ok: false,
      state: "unsupported"
    });
    expect(adapter.credentialStorageStatus()).toMatchObject({
      ok: false,
      state: "unsupported"
    });
    expect(adapter.openExternalUrl("https://accounts.google.com")).toMatchObject({
      ok: false,
      state: "unsupported"
    });
  });
});
