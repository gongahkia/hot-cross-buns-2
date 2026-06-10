import { Notification, app, shell } from "electron";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  buildNativeCapabilityReport,
  capabilityDiagnostic,
  nativePlatform
} from "../capabilityReport";
import {
  HCB_DEEP_LINK_SCHEME,
  type NativeAppPaths,
  type NativeOperationResult,
  type NativePlatformCapabilities
} from "../types";
import { unsupported } from "./operationResults";

const execFileAsync = promisify(execFile);
const macFontFamiliesScript = `
ObjC.import("AppKit");
const fonts = $.NSFontManager.sharedFontManager.availableFontFamilies;
const families = [];
for (let index = 0; index < fonts.count; index += 1) {
  families.push(ObjC.unwrap(fonts.objectAtIndex(index)));
}
JSON.stringify(families);
`;

export function appPaths(): NativeAppPaths {
  const userData = app.getPath("userData");
  const logs = safeAppPath("logs", join(userData, "logs"));
  const temp = safeAppPath("temp", join(userData, "tmp"));

  return {
    configDirectory: join(userData, "config"),
    dataDirectory: join(userData, "data"),
    cacheDirectory: join(userData, "cache"),
    logsDirectory: logs,
    diagnosticsDirectory: join(userData, "diagnostics"),
    tempDirectory: join(temp, "hot-cross-buns-2")
  };
}

export function capabilities(): NativePlatformCapabilities {
  const isMac = process.platform === "darwin";
  const paths = appPaths();
  const notifications = isMac && Notification.isSupported();
  const flags = {
    supportsAppPaths: true,
    supportsTray: isMac,
    supportsAppMenu: isMac,
    supportsGlobalShortcut: isMac,
    supportsNotifications: notifications,
    supportsNotificationPermissionQuery: false,
    supportsProtocolRegistration: isMac,
    supportsProtocolRegistrationCheck: isMac,
    supportsAutostart: isMac && app.isPackaged,
    supportsInPlaceAutoUpdate: false,
    supportsInstallerMetadata: isMac,
    supportsExternalUrlOpen: true,
    supportsDiagnosticsCollection: true,
    supportsCredentialStorage: isMac,
    supportsOAuthLoopback: true,
    supportsMcpLoopback: true,
    requiresSignedBuildForNotifications: false
  };

  return {
    platform: isMac ? "darwin" : nativePlatform(),
    adapterId: "electron-mac",
    notifications,
    globalShortcuts: isMac,
    tray: isMac,
    deepLinks: isMac,
    updaterChecks: true,
    capabilityReport: buildNativeCapabilityReport({
      platform: isMac ? "darwin" : nativePlatform(),
      adapterId: "electron-mac",
      appPaths: paths,
      packageFormat: app.isPackaged ? "unknown" : "development",
      flags,
      capabilityOverrides: {
        credentialStorage: {
          state: isMac ? "ready" : "unsupported",
          message: isMac
            ? "macOS Keychain storage is wired for main-process Google and MCP secrets."
            : "Keychain-backed credential storage is unavailable outside macOS."
        },
        notifications: {
          state: notifications ? "ready" : "unsupported",
          message: notifications
            ? "Electron notifications are available; exact OS permission state is inferred through delivery."
            : "Electron notifications are unavailable for this runtime."
        },
        updater: {
          state: "ready",
          message: "GitHub release checks are available; in-place auto-update remains disabled."
        },
        oauthLoopback: {
          state: "ready",
          message: "OAuth loopback is wired through the main process and macOS browser handoff."
        },
        mcpLoopback: {
          state: "ready",
          message: "MCP loopback is wired with Keychain-backed bearer-token storage."
        },
        packaging: {
          state: app.isPackaged ? "ready" : "pending",
          message: app.isPackaged
            ? "Packaged macOS artifact metadata is available."
            : "Development runtime has no installed package metadata."
        }
      },
      diagnostics: [
        capabilityDiagnostic(
          "updater",
          "warning",
          "In-place auto-update is intentionally disabled for unsigned preview builds."
        )
      ]
    })
  };
}

export function credentialStorageStatus(): NativeOperationResult {
  if (process.platform !== "darwin") {
    return unsupported("Keychain-backed credential storage is unavailable outside macOS.");
  }

  return {
    ok: true,
    state: "ready",
    message: "macOS Keychain storage is available for main-process secrets."
  };
}

export function registerProtocolClient(scheme: typeof HCB_DEEP_LINK_SCHEME): NativeOperationResult {
  if (process.platform !== "darwin") {
    return unsupported("Protocol registration is not handled by this platform adapter.");
  }

  const defaultApp = (process as NodeJS.Process & { defaultApp?: boolean }).defaultApp;
  const ok = defaultApp && process.argv.length >= 2
    ? app.setAsDefaultProtocolClient(scheme, process.execPath, [process.argv[1]])
    : app.setAsDefaultProtocolClient(scheme);

  return {
    ok,
    state: ok ? "ready" : "error",
    message: ok
      ? `${scheme}:// links are registered for this app.`
      : `${scheme}:// links could not be registered for this app.`
  };
}

export function requestNotificationPermission() {
  if (process.platform !== "darwin" || !Notification.isSupported()) {
    return {
      state: "unsupported" as const
    };
  }

  const notification = new Notification({
    title: "Notifications enabled",
    body: "Due tasks and upcoming events can appear here."
  });
  notification.show();

  return {
    state: "prompt" as const
  };
}

export async function listFontFamilies(): Promise<string[]> {
  if (process.platform !== "darwin") {
    return [];
  }

  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/osascript",
      ["-l", "JavaScript", "-e", macFontFamiliesScript],
      {
        maxBuffer: 512 * 1024,
        timeout: 2_000
      }
    );
    const parsed = JSON.parse(String(stdout).trim()) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((family): family is string => typeof family === "string")
      : [];
  } catch {
    return [];
  }
}

export function setAutostart(enabled: boolean): NativeOperationResult {
  if (process.platform !== "darwin") {
    return unsupported("Open-at-login is not handled by this platform adapter.");
  }

  if (!app.isPackaged) {
    return developmentAutostartResult(enabled);
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enabled
    });
    const status = app.getLoginItemSettings();

    return {
      ok: status.openAtLogin === enabled,
      state: status.openAtLogin === enabled ? "ready" : "error",
      message:
        status.openAtLogin === enabled
          ? enabled
            ? "Open-at-login is enabled."
            : "Open-at-login is disabled."
          : "Open-at-login did not match the requested setting."
    };
  } catch (error) {
    return {
      ok: false,
      state: "error",
      message: error instanceof Error ? error.message : "Open-at-login could not be updated."
    };
  }
}

export function autostartStatus(): NativeOperationResult {
  if (process.platform !== "darwin") {
    return unsupported("Open-at-login is not handled by this platform adapter.");
  }

  if (!app.isPackaged) {
    return developmentAutostartResult(false);
  }

  try {
    const status = app.getLoginItemSettings();

    return {
      ok: true,
      state: status.openAtLogin ? "ready" : "disabled",
      message: status.openAtLogin ? "Open-at-login is enabled." : "Open-at-login is disabled."
    };
  } catch (error) {
    return {
      ok: false,
      state: "error",
      message: error instanceof Error ? error.message : "Open-at-login status could not be read."
    };
  }
}

export async function checkForUpdates(): Promise<NativeOperationResult> {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch("https://api.github.com/repos/gongahkia/hot-cross-buns-2/releases/latest", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `HotCrossBuns2/${app.getVersion()}`
      },
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new Error(`GitHub Releases returned HTTP ${response.status}.`);
    }

    const release = parseGitHubRelease(await response.json());
    const latestVersion = normalizedVersionString(release.tagName);
    const currentVersion = normalizedVersionString(app.getVersion());
    const updateAvailable = compareReleaseVersions(latestVersion, currentVersion) > 0;
    const downloadUrl = release.assets.find((asset) => /\.dmg(?:$|\?)/i.test(asset.name) || /\.dmg(?:$|\?)/i.test(asset.browserDownloadUrl))?.browserDownloadUrl;

    return {
      checkedAt,
      downloadUrl,
      latestVersion,
      ok: true,
      releaseName: release.name || release.tagName,
      releaseUrl: release.htmlUrl,
      state: "ready",
      updateAvailable,
      message: updateAvailable
        ? `Hot Cross Buns ${latestVersion} is available from GitHub Releases.`
        : "Hot Cross Buns is up to date."
    };
  } catch (error) {
    return {
      checkedAt,
      ok: false,
      state: "error",
      message: error instanceof Error ? error.message : "GitHub release check failed."
    };
  }
}

interface GitHubReleaseAsset {
  browserDownloadUrl: string;
  name: string;
}

interface GitHubRelease {
  assets: GitHubReleaseAsset[];
  htmlUrl: string;
  name: string;
  tagName: string;
}

function parseGitHubRelease(value: unknown): GitHubRelease {
  const release = value as {
    assets?: Array<{ browser_download_url?: unknown; name?: unknown }>;
    html_url?: unknown;
    name?: unknown;
    tag_name?: unknown;
  };

  if (typeof release.tag_name !== "string" || typeof release.html_url !== "string") {
    throw new Error("GitHub release metadata was incomplete.");
  }

  return {
    assets: Array.isArray(release.assets)
      ? release.assets
        .filter((asset) => typeof asset.name === "string" && typeof asset.browser_download_url === "string")
        .map((asset) => ({
          browserDownloadUrl: asset.browser_download_url as string,
          name: asset.name as string
        }))
      : [],
    htmlUrl: release.html_url,
    name: typeof release.name === "string" ? release.name : release.tag_name,
    tagName: release.tag_name
  };
}

function normalizedVersionString(value: string): string {
  return value.trim().replace(/^v/i, "") || "0";
}

function compareReleaseVersions(left: string, right: string): number {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);

    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function versionParts(value: string): number[] {
  return normalizedVersionString(value)
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

export async function openExternalUrl(url: string): Promise<NativeOperationResult> {
  try {
    await shell.openExternal(url);

    return {
      ok: true,
      state: "ready",
      message: "External URL was opened by the operating system."
    };
  } catch (error) {
    return {
      ok: false,
      state: "error",
      message: error instanceof Error ? error.message : "External URL could not be opened."
    };
  }
}

export async function openPath(path: string): Promise<NativeOperationResult> {
  const result = await shell.openPath(path);

  return result
    ? {
        ok: false,
        state: "error",
        message: result
      }
    : {
        ok: true,
        state: "ready",
        message: "Path was opened by the operating system."
      };
}

export function collectDiagnostics(): NativeOperationResult {
  return {
    ok: true,
    state: "ready",
    message: "macOS native adapter diagnostics are available through the capability report."
  };
}

function developmentAutostartResult(enabled: boolean): NativeOperationResult {
  return {
    ok: !enabled,
    state: enabled ? "unsupported" : "disabled",
    message: enabled
      ? "Open-at-login is only applied from a packaged macOS app."
      : "Open-at-login is not modified during development runs."
  };
}

function safeAppPath(name: Parameters<typeof app.getPath>[0], fallback: string): string {
  try {
    return app.getPath(name);
  } catch {
    return fallback;
  }
}
