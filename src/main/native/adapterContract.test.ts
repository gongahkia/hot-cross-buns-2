import { beforeEach, describe, expect, it, vi } from "vitest";
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

  return {
    app: {
      isPackaged: false,
      getName: vi.fn(() => "Hot Cross Buns 2"),
      getPath: vi.fn((name: string) => paths[name] ?? `/tmp/hcb-${name}`)
    },
    shell: {
      openExternal: vi.fn(async () => undefined),
      openPath: vi.fn(async () => "")
    }
  };
});

vi.mock("electron", () => electronMock);

const originalAppImage = process.env.APPIMAGE;

beforeEach(() => {
  electronMock.app.isPackaged = false;
  electronMock.app.getPath.mockClear();
  electronMock.shell.openExternal.mockReset();
  electronMock.shell.openExternal.mockResolvedValue(undefined);
  electronMock.shell.openPath.mockReset();
  electronMock.shell.openPath.mockResolvedValue("");

  if (originalAppImage === undefined) {
    delete process.env.APPIMAGE;
  } else {
    process.env.APPIMAGE = originalAppImage;
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
  it("reports schema-valid non-claiming Linux preview capabilities", () => {
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
      notifications: false,
      globalShortcuts: false,
      tray: false,
      deepLinks: false
    });
    expect(report.flags).toMatchObject({
      supportsAppPaths: true,
      supportsExternalUrlOpen: true,
      supportsDiagnosticsCollection: true,
      supportsCredentialStorage: false,
      supportsTray: false,
      supportsGlobalShortcut: false,
      supportsNotifications: false,
      supportsProtocolRegistration: false,
      supportsAutostart: false,
      supportsInPlaceAutoUpdate: false
    });
    expect(report.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "credentialStorage",
          supported: false,
          state: "pending"
        }),
        expect.objectContaining({
          key: "tray",
          supported: false,
          state: "unsupported"
        }),
        expect.objectContaining({
          key: "globalShortcuts",
          supported: false,
          state: "unsupported"
        }),
        expect.objectContaining({
          key: "notifications",
          supported: false,
          state: "unsupported"
        }),
        expect.objectContaining({
          key: "updater",
          supported: false,
          state: "pending"
        })
      ])
    );
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "credentialStorage",
          severity: "blocker"
        })
      ])
    );
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

    expect(adapter.credentialStorageStatus()).toMatchObject({
      ok: false,
      state: "pending"
    });
    expect(adapter.createTray({} as never)).toMatchObject({
      ok: false,
      state: "unsupported"
    });
    expect(adapter.registerGlobalShortcut("CommandOrControl+Shift+Space", vi.fn())).toMatchObject({
      ok: false,
      state: "unsupported"
    });
    expect(adapter.registerProtocolClient("hotcrossbuns")).toMatchObject({
      ok: false,
      state: "unsupported"
    });
    expect(adapter.setAutostart(true)).toMatchObject({
      ok: false,
      state: "unsupported"
    });
    expect(adapter.requestNotificationPermission()).toEqual({
      state: "unsupported"
    });
    expect(adapter.collectDiagnostics()).toMatchObject({
      ok: true,
      state: "ready"
    });
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
