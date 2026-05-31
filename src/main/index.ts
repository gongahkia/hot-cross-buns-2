import { app, BrowserWindow, session } from "electron";
import { join } from "node:path";
import { IPC_CHANNELS, type NativeAction } from "@shared/ipc/contracts";
import { appLogger } from "./diagnostics/appLogger";
import { registerHcbIpc } from "./ipc";
import { brandAssetPath } from "./native/brandAssets";
import { createElectronMacNativeAdapter } from "./native/electronMacAdapter";
import {
  configureEmbeddedWebContentsLockdown,
  configureEmbeddedWebviewLockdown,
  configureNavigationLockdown,
  configureSessionHardening
} from "./security";
import { createServiceContainer, type ServiceContainer } from "./services/serviceContainer";
import { markStartupTiming } from "./startupTiming";

let mainWindow: BrowserWindow | null = null;
let services: ServiceContainer | null = null;
const nativeAdapter = createElectronMacNativeAdapter();
const pendingDeepLinks: string[] = [];
const pendingNativeActions: NativeAction[] = [];
const rendererReadyFallbackMs = 8_000;
let revealFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let deferredRuntimeStarted = false;
let quittingAfterSync = false;
let syncQuitWindow: BrowserWindow | null = null;
const macAppDisplayName = "Hot Cross Buns";

if (process.env.HCB_USER_DATA_DIR && !app.isPackaged) {
  app.setPath("userData", process.env.HCB_USER_DATA_DIR);
}

app.setName(macAppDisplayName);

markStartupTiming("processStartedMs");
appLogger.info("app launch", "misc", {
  version: app.getVersion(),
  launchMode: app.isPackaged ? "packaged" : "development"
});

app.on("open-url", (event, url) => {
  event.preventDefault();

  if (!services) {
    pendingDeepLinks.push(url);
    return;
  }

  services.nativeShell.handleDeepLink(url);
});

function flushPendingNativeActions(): void {
  const target = mainWindow;

  if (!target || target.webContents.isLoading()) {
    return;
  }

  for (const action of pendingNativeActions.splice(0)) {
    target.webContents.send(IPC_CHANNELS.nativeAction, action);
  }
}

function clearRevealFallbackTimer(): void {
  if (!revealFallbackTimer) {
    return;
  }

  clearTimeout(revealFallbackTimer);
  revealFallbackTimer = null;
}

function startDeferredRuntimeOnce(): void {
  if (deferredRuntimeStarted) {
    return;
  }

  deferredRuntimeStarted = true;
  services?.startDeferredRuntime();
}

function revealMainWindow(window: BrowserWindow | null = mainWindow, focus = false): void {
  if (!window || window.isDestroyed()) {
    return;
  }

  clearRevealFallbackTimer();

  if (!window.isVisible()) {
    window.show();
  }

  if (focus) {
    window.focus();
  }
}

function handleRendererShellVisible(): void {
  revealMainWindow(mainWindow);
  startDeferredRuntimeOnce();
}

function dispatchNativeAction(action: NativeAction): void {
  const target = mainWindow;

  if (!target || target.webContents.isLoading()) {
    pendingNativeActions.push(action);
    return;
  }

  target.webContents.send(IPC_CHANNELS.nativeAction, action);
}

function showMainWindow(): void {
  if (!mainWindow) {
    mainWindow = createMainWindow();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  revealMainWindow(mainWindow, true);
}

function showQuitSyncWindow(): BrowserWindow {
  if (syncQuitWindow && !syncQuitWindow.isDestroyed()) {
    syncQuitWindow.show();
    return syncQuitWindow;
  }

  syncQuitWindow = new BrowserWindow({
    alwaysOnTop: true,
    backgroundColor: "#2b2b2b",
    height: 132,
    maximizable: false,
    minimizable: false,
    modal: Boolean(mainWindow),
    parent: mainWindow ?? undefined,
    resizable: false,
    show: false,
    title: "Syncing...",
    width: 420
  });
  syncQuitWindow.removeMenu();
  syncQuitWindow.on("closed", () => {
    syncQuitWindow = null;
  });
  void syncQuitWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(quitSyncHtml)}`);
  syncQuitWindow.once("ready-to-show", () => {
    syncQuitWindow?.show();
  });
  return syncQuitWindow;
}

async function syncBeforeQuit(): Promise<void> {
  const activeServices = services;

  if (!activeServices) {
    return;
  }

  showQuitSyncWindow();

  try {
    await activeServices.domain.sync.runNow({ resources: ["tasks", "calendar"] });
  } catch (error) {
    appLogger.warn("quit sync failed", "sync", {
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    syncQuitWindow?.close();
  }
}

function hideMainWindow(): void {
  mainWindow?.hide();
}

function showOrHideMainWindow(): void {
  if (!mainWindow || !mainWindow.isVisible()) {
    showMainWindow();
    return;
  }

  hideMainWindow();
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: "Hot Cross Buns 2",
    icon: brandAssetPath("app-icon.png"),
    backgroundColor: "#1e1e2e",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: true
    }
  });

  markStartupTiming("windowCreatedMs");
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  configureNavigationLockdown(window, {
    allowedDevOrigin: rendererUrl,
    externalOpener: nativeAdapter
  });
  configureEmbeddedWebviewLockdown(window);

  window.webContents.once("did-finish-load", () => {
    markStartupTiming("rendererLoadedMs");
    flushPendingNativeActions();
  });

  window.webContents.once("did-fail-load", () => {
    revealMainWindow(window);
    services?.nativeShell.startDeferredStartup();
    startDeferredRuntimeOnce();
  });

  window.once("closed", () => {
    if (mainWindow === window) {
      clearRevealFallbackTimer();
    }
  });

  clearRevealFallbackTimer();
  revealFallbackTimer = setTimeout(() => {
    if (mainWindow !== window) {
      return;
    }

    revealMainWindow(window);
    services?.nativeShell.startDeferredStartup();
    startDeferredRuntimeOnce();
  }, rendererReadyFallbackMs);

  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

app.whenReady().then(() => {
  markStartupTiming("appReadyMs");
  appLogger.configure({ logsDirectory: nativeAdapter.appPaths().logsDirectory });
  appLogger.info("app ready", "misc");
  configureSessionHardening(session.defaultSession, { isPackaged: app.isPackaged });
  configureEmbeddedWebContentsLockdown(app);
  services = createServiceContainer({
    appPaths: nativeAdapter.appPaths(),
    nativeAdapter,
    nativeWindows: {
      showMainWindow,
      hideMainWindow,
      showOrHideMainWindow,
      quit: () => app.quit(),
      dispatchAction: dispatchNativeAction
    }
  });
  services.nativeShell.installAppMenu();
  registerHcbIpc(services, {
    onShellVisible: handleRendererShellVisible
  });
  mainWindow = createMainWindow();

  for (const url of pendingDeepLinks.splice(0)) {
    services.nativeShell.handleDeepLink(url);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      showMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  mainWindow = null;

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (!quittingAfterSync && services) {
    event.preventDefault();
    void syncBeforeQuit().finally(() => {
      quittingAfterSync = true;
      app.quit();
    });
    return;
  }

  services?.close();
  services = null;
});

const quitSyncHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #2b2b2b;
        color: #f2f0df;
        font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .wrap {
        display: grid;
        gap: 8px;
        height: 100vh;
        place-content: center;
        padding: 18px 22px;
        text-align: center;
      }
      .title { font-size: 15px; font-weight: 700; }
      .row { color: #ded9be; line-height: 1.35; }
      .bar {
        height: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: #525252;
      }
      .bar::before {
        display: block;
        width: 55%;
        height: 100%;
        border-radius: inherit;
        background: #3b82f6;
        content: "";
        animation: pulse 1s ease-in-out infinite alternate;
      }
      @keyframes pulse { from { transform: translateX(-18%); } to { transform: translateX(90%); } }
    </style>
  </head>
  <body>
    <main class="wrap" role="status" aria-live="polite">
      <div class="title">Syncing...</div>
      <div class="row">Added/modified: 0 up 1 down<br>Removed: 0 up 0 down</div>
      <div class="bar"></div>
    </main>
  </body>
</html>`;
