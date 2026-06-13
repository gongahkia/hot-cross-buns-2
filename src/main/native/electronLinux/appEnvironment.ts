import { Notification, app, safeStorage, shell } from "electron";
import { join } from "node:path";
import { linuxSecretServiceStatus } from "../../credentials/secretStore";
import { detectLinuxGlobalShortcutSupport } from "./globalShortcuts";
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
  const credentialStatus = credentialStorageStatus();
  const notifications = Notification.isSupported();
  const globalShortcutSupport = detectLinuxGlobalShortcutSupport();
  const flags = {
    supportsAppPaths: true,
    supportsTray: false,
    supportsAppMenu: false,
    supportsGlobalShortcut: globalShortcutSupport.supported,
    supportsNotifications: notifications,
    supportsNotificationPermissionQuery: false,
    supportsProtocolRegistration: false,
    supportsProtocolRegistrationCheck: false,
    supportsAutostart: false,
    supportsInPlaceAutoUpdate: false,
    supportsInstallerMetadata: Boolean(process.env.APPIMAGE),
    supportsExternalUrlOpen: true,
    supportsDiagnosticsCollection: true,
    supportsCredentialStorage: credentialStatus.ok,
    supportsOAuthLoopback: true,
    supportsMcpLoopback: true,
    requiresSignedBuildForNotifications: false,
    hasWaylandSession: globalShortcutSupport.hasWaylandSession,
    hasPortalShortcutSupport: globalShortcutSupport.hasPortalShortcutSupport
  };

  return {
    platform: "linux",
    adapterId: "electron-linux-preview",
    notifications,
    globalShortcuts: globalShortcutSupport.supported,
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
          state: credentialStatus.state ?? "error",
          message: credentialStatus.message
        },
        tray: {
          state: "unsupported",
          message: "Linux tray/status-area support is explicitly unsupported in this technical preview until GNOME and KDE status-icon behavior is manually validated."
        },
        appMenu: {
          state: "unsupported",
          message: "A Linux application menu has not been enabled for the technical preview scaffold."
        },
        globalShortcuts: {
          state: globalShortcutSupport.state,
          message: globalShortcutSupport.message
        },
        notifications: {
          state: notifications ? "ready" : "unsupported",
          message: notifications
            ? "Electron reports Linux desktop notifications are available through the current session."
            : "Electron reports Linux desktop notifications are unavailable in the current session."
        },
        customProtocol: {
          state: "unsupported",
          message: "hotcrossbuns:// registration is explicitly unsupported on Linux until installed AppImage desktop integration is validated."
        },
        autostart: {
          state: "unsupported",
          message: "Linux open-at-login is explicitly unsupported in this technical preview until a user-level autostart desktop-entry flow is validated."
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
        credentialStatus.ok
          ? capabilityDiagnostic(
              "credentialStorage",
              "info",
              "Linux Secret Service credential storage is available through Electron safeStorage."
            )
          : capabilityDiagnostic(
              "credentialStorage",
              "blocker",
              credentialStatus.message ??
                "Linux Secret Service credential storage is unavailable; credential-dependent features must stay blocked."
            ),
        capabilityDiagnostic(
          "tray",
          "warning",
          `Linux tray/status-area support is disabled for this preview; use the main window controls. Desktop session: ${linuxDesktopLabel()}.`
        ),
        capabilityDiagnostic(
          "globalShortcuts",
          globalShortcutSupport.supported ? "info" : "warning",
          globalShortcutSupport.message
        ),
        capabilityDiagnostic(
          "notifications",
          notifications ? "info" : "warning",
          notifications
            ? "Linux notification scheduling is enabled; delivery still requires GNOME/KDE manual release validation."
            : "Electron Notification.isSupported() returned false for this Linux session."
        ),
        capabilityDiagnostic(
          "customProtocol",
          "warning",
          "Linux hotcrossbuns:// registration is disabled and AppImage desktop metadata intentionally omits the scheme until installed-app validation passes."
        ),
        capabilityDiagnostic(
          "autostart",
          "warning",
          "Linux open-at-login is disabled for this preview; no autostart .desktop entry is created or removed."
        )
      ]
    })
  };
}

export function credentialStorageStatus(): NativeOperationResult {
  return linuxSecretServiceStatus(safeStorage);
}

export function installAppMenu(): NativeOperationResult {
  return unsupported("Linux application menu support is not enabled in the technical preview scaffold.");
}

export function registerProtocolClient(_scheme: typeof HCB_DEEP_LINK_SCHEME): NativeOperationResult {
  return unsupported(
    "Linux hotcrossbuns:// registration is explicitly unsupported until installed AppImage desktop integration is validated."
  );
}

export function setAutostart(_enabled: boolean): NativeOperationResult {
  return unsupported(
    "Linux open-at-login is explicitly unsupported until a user-level autostart desktop-entry flow is validated."
  );
}

export function autostartStatus(): NativeOperationResult {
  return unsupported("Linux open-at-login is explicitly unsupported in this technical preview.");
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

function linuxDesktopLabel(): string {
  const raw = process.env.XDG_CURRENT_DESKTOP ?? process.env.DESKTOP_SESSION ?? "unknown";
  const normalized = raw
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");

  return normalized.slice(0, 80) || "unknown";
}

function safeAppPath(name: Parameters<typeof app.getPath>[0], fallback: string): string {
  try {
    return app.getPath(name);
  } catch {
    return fallback;
  }
}
