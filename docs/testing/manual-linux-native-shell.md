# Manual Linux Native Shell Checklist

Use this checklist before publishing a Linux AppImage technical preview. It
records desktop-environment behavior that the automated Linux gates cannot prove
by themselves.

## Scope

Supported preview target:

- Ubuntu LTS on GNOME.
- AppImage package.
- Fresh app data path via `HCB_USER_DATA_DIR` for at least one pass.

Secondary checks:

- Fedora Workstation GNOME.
- KDE Plasma.
- One Wayland session.
- One X11 session.

Do not upgrade Linux copy from "technical preview" to general support unless the
primary target and the secondary session checks are recorded.

## Automated Evidence

Confirm the current release candidate already passed:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm release:review-bundle`
- `(cd release && sha256sum -c SHASUMS256.txt)`
- `pnpm release:smoke-appimage`
- `HCB_APPIMAGE_SMOKE_LAUNCH=1 pnpm release:smoke-appimage`
- `pnpm test:smoke`
- `pnpm test:perf`

## AppImage Launch

- Verify the published AppImage checksum against `SHASUMS256.txt`.
- Run `chmod +x` on the AppImage.
- Launch from a terminal and record stdout/stderr.
- Launch from the file manager.
- Launch once with `HCB_USER_DATA_DIR` set to an empty temporary directory.
- Confirm the main window opens, closes, hides/shows, and quits cleanly.
- Confirm icon and taskbar/window grouping behavior.
- Open Settings and Diagnostics.
- Generate or copy a support bundle and confirm local paths and secrets are
  redacted.

## Credentials And OAuth

- Start with Secret Service ready, such as an unlocked GNOME Keyring or KWallet.
- Save a Desktop OAuth client ID and optional client secret.
- Complete the browser OAuth round trip.
- Quit and relaunch, then confirm token refresh and sync still work.
- Disconnect and reconnect the Google account.
- Repeat the startup check with Secret Service missing.
- Repeat the startup check with Secret Service locked before app launch.
- Confirm credential-dependent features fail recoverably when the provider is
  missing or locked.
- Inspect diagnostics and logs for raw OAuth tokens, client secrets, bearer
  tokens, Google payloads, and unredacted home-directory paths.

## MCP

- Enable the local MCP server.
- Confirm the listener binds to `127.0.0.1` only.
- Confirm the runtime discovery file is under the app config path.
- Confirm the runtime discovery file does not contain the raw bearer token.
- Run the CLI smoke path against the packaged AppImage.
- Reset the MCP bearer token and confirm the revision changes after relaunch.
- Confirm unauthorized, non-local, oversized, and browser-origin requests are
  rejected without leaking secrets.
- Disable MCP and confirm the listener stops.

## Notifications

- On GNOME, create a local reminder and confirm notification delivery.
- On KDE, create a local reminder and confirm notification delivery.
- Click the notification and confirm the app focuses or records a recoverable
  unsupported state.
- Disable notifications and confirm pending local notifications are cleared.
- Confirm Diagnostics reports notification support accurately for the session.

## Global Shortcuts

- On X11, register the quick-capture shortcut and confirm it opens capture while
  the app is unfocused.
- On X11, test a shortcut conflict and confirm the app reports the conflict
  without breaking in-app capture.
- On Wayland with the GlobalShortcuts portal available, register quick capture
  and confirm the portal-mediated shortcut works.
- On Wayland without portal support or after denial, confirm global capture is
  marked unsupported and in-app capture remains available.
- Confirm shortcut diagnostics identify the session type without exposing raw
  environment details.

## Explicitly Unsupported Preview Features

The Linux technical preview intentionally does not support:

- tray/status-area surfaces
- `hotcrossbuns://` deep links
- open-at-login/autostart
- automatic in-place AppImage updates

For each unsupported feature:

- Confirm Settings and Diagnostics report the unsupported state.
- Confirm the main window remains the supported control surface.
- Confirm the unsupported feature does not block startup, sync, tasks, calendar,
  notes, export, or diagnostics.

## Updates

- Open the in-app update check.
- Confirm it points users to GitHub Releases.
- Confirm it prefers the AppImage asset when one exists.
- Confirm it does not download, replace, or install the AppImage automatically.

## Removal And Data Policy

- Delete the AppImage and confirm the app binary is removed.
- Confirm user data remains under the documented app data/config/cache paths.
- Remove the documented data directories only during an explicit clean-removal
  check.
- Confirm Google remains the source of truth for synced tasks and events.

## Results

| Date | Build | Distro | Desktop | Session | Tester | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |

