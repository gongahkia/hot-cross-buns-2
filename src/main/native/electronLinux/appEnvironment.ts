import { app, shell } from "electron";
import { join } from "node:path";
import {
  buildNativeCapabilityReport,
  capabilityDiagnostic
} from "../capabilityReport";
import {
  HCB_DEEP_LINK_SCHEME,
  type NativeAppPaths,
  type NativeOperationResult,
  type NativePlatformCapabilities
} from "../types";
import { pending, sanitizedFailure, unsupported } from "./operationResults";

export function appPaths(): NativeAppPaths {
  const userData = app.getPath("userData");
  const sessionData = safeAppPath("sessionData", join(userData, "session"));
  const logs = safeAppPath("logs", join(userData, "logs"));
  const temp = safeAppPath("temp", "/tmp");

  return {
    configDirectory: userData,
    dataDirectory: join(userData, "data"),
    cacheDirectory: sessionData,
    logsDirectory: logs,
    diagnosticsDirectory: join(userData, "diagnostics"),
    tempDirectory: join(temp, "hot-cross-buns-2")
  };
}

export function capabilities(): NativePlatformCapabilities {
  const paths = appPaths();
  const flags = {
    supportsAppPaths: true,
    supportsTray: false,
    supportsAppMenu: false,
    supportsGlobalShortcut: false,
    supportsNotifications: false,
    supportsNotificationPermissionQuery: false,
    supportsProtocolRegistration: false,
    supportsProtocolRegistrationCheck: false,
    supportsAutostart: false,
    supportsInPlaceAutoUpdate: false,
    supportsInstallerMetadata: Boolean(process.env.APPIMAGE),
    supportsExternalUrlOpen: true,
    supportsDiagnosticsCollection: true,
    supportsCredentialStorage: false,
    supportsOAuthLoopback: true,
    supportsMcpLoopback: true,
    requiresSignedBuildForNotifications: false,
    hasWaylandSession: process.env.XDG_SESSION_TYPE === "wayland",
    hasPortalShortcutSupport: false
  };

  return {
    platform: "linux",
    adapterId: "electron-linux-preview",
    notifications: false,
    globalShortcuts: false,
    tray: false,
    deepLinks: false,
    updaterChecks: false,
    capabilityReport: buildNativeCapabilityReport({
      platform: "linux",
      adapterId: "electron-linux-preview",
      appPaths: paths,
      packageFormat: packageFormat(),
      flags,
      capabilityOverrides: {
        credentialStorage: {
          state: "pending",
          message: "Secret Service credential storage is planned for the Linux preview but is not wired yet."
        },
        tray: {
          state: "unsupported",
          message: "Linux tray behavior is not claimed; the main window remains the supported control surface."
        },
        appMenu: {
          state: "unsupported",
          message: "A Linux application menu has not been enabled for the technical preview scaffold."
        },
        globalShortcuts: {
          state: "unsupported",
          message: "Linux global shortcuts are disabled until X11, Wayland, and portal behavior is validated."
        },
        notifications: {
          state: "unsupported",
          message: "Linux notifications are disabled until Electron and desktop-environment delivery is validated."
        },
        customProtocol: {
          state: "unsupported",
          message: "hotcrossbuns:// registration is disabled until AppImage desktop integration is validated."
        },
        autostart: {
          state: "unsupported",
          message: "Linux open-at-login is disabled until desktop-entry behavior is validated."
        },
        updater: {
          state: "pending",
          message: "Linux update checks are pending AppImage release-asset selection; in-place auto-update is disabled."
        },
        installerMetadata: {
          state: process.env.APPIMAGE ? "ready" : "pending",
          message: process.env.APPIMAGE
            ? "AppImage runtime metadata was detected."
            : "Linux package metadata will be available from the AppImage preview artifact."
        },
        externalOpen: {
          state: "ready",
          message: "External URL and path opening is delegated to Electron shell APIs."
        },
        diagnostics: {
          state: "ready",
          message: "Linux native adapter diagnostics are available through sanitized capability metadata."
        },
        oauthLoopback: {
          state: "pending",
          message: "OAuth loopback is shared code, but Linux browser handoff and credential storage are not fully validated."
        },
        mcpLoopback: {
          state: "pending",
          message: "MCP loopback is shared code, but Linux bearer-token storage is not fully validated."
        },
        packaging: {
          state: process.env.APPIMAGE ? "ready" : "pending",
          message: process.env.APPIMAGE
            ? "Linux AppImage runtime metadata was detected."
            : "Linux AppImage packaging is not active in this development runtime."
        }
      },
      diagnostics: [
        capabilityDiagnostic(
          "credentialStorage",
          "blocker",
          "Linux Secret Service credential storage is not implemented yet; credential-dependent features must stay blocked."
        ),
        capabilityDiagnostic(
          "tray",
          "info",
          "Linux tray/status-area support is intentionally disabled for the first non-claiming scaffold."
        ),
        capabilityDiagnostic(
          "globalShortcuts",
          "info",
          "Linux global shortcuts require X11, Wayland, and portal validation before support can be claimed."
        ),
        capabilityDiagnostic(
          "notifications",
          "info",
          "Linux notifications require desktop-environment validation before support can be claimed."
        )
      ]
    })
  };
}

export function credentialStorageStatus(): NativeOperationResult {
  return pending("Linux Secret Service credential storage is not implemented yet.");
}

export function installAppMenu(): NativeOperationResult {
  return unsupported("Linux application menu support is not enabled in the technical preview scaffold.");
}

export function registerProtocolClient(_scheme: typeof HCB_DEEP_LINK_SCHEME): NativeOperationResult {
  return unsupported("Linux protocol registration is pending AppImage desktop integration validation.");
}

export function setAutostart(_enabled: boolean): NativeOperationResult {
  return unsupported("Linux open-at-login is pending desktop-entry validation.");
}

export function autostartStatus(): NativeOperationResult {
  return unsupported("Linux open-at-login is not enabled.");
}

export function checkForUpdates(): NativeOperationResult {
  return pending("Linux GitHub release checks are pending AppImage asset selection.");
}

export async function openExternalUrl(url: string): Promise<NativeOperationResult> {
  try {
    await shell.openExternal(url);

    return {
      ok: true,
      state: "ready",
      message: "External URL was opened by the operating system."
    };
  } catch {
    return sanitizedFailure("External URL could not be opened by the operating system.");
  }
}

export async function openPath(path: string): Promise<NativeOperationResult> {
  try {
    const result = await shell.openPath(path);

    return result
      ? sanitizedFailure("Path could not be opened by the operating system.")
      : {
          ok: true,
          state: "ready",
          message: "Path was opened by the operating system."
        };
  } catch {
    return sanitizedFailure("Path could not be opened by the operating system.");
  }
}

export function collectDiagnostics(): NativeOperationResult {
  return {
    ok: true,
    state: "ready",
    message: "Linux native adapter diagnostics are available through the sanitized capability report."
  };
}

function packageFormat(): NativePlatformCapabilities["capabilityReport"]["packageFormat"] {
  if (process.env.APPIMAGE) {
    return "appimage";
  }

  return app.isPackaged ? "unknown" : "development";
}

function safeAppPath(name: Parameters<typeof app.getPath>[0], fallback: string): string {
  try {
    return app.getPath(name);
  } catch {
    return fallback;
  }
}
