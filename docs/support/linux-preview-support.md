# Linux Preview Support

Hot Cross Buns 2 Linux support is a technical preview for Ubuntu LTS on GNOME.
The first preview artifact is an AppImage. Other distributions and desktop
environments are secondary validation targets until the Linux QA matrix is
complete.

## Install And Run

1. Download `Hot-Cross-Buns-2-<version>-linux-x86_64.AppImage`,
   `SHASUMS256.txt`, and the matching `.sha256` file from the release.
2. Verify checksums:

   ```sh
   sha256sum -c SHASUMS256.txt
   ```

3. Make the AppImage executable:

   ```sh
   chmod +x Hot-Cross-Buns-2-<version>-linux-x86_64.AppImage
   ```

4. Launch it:

   ```sh
   ./Hot-Cross-Buns-2-<version>-linux-x86_64.AppImage
   ```

Use a terminal launch for first-run support reports so startup errors are
visible.

## Known Preview Limits

- AppImage is the only Linux package format.
- In-place automatic Linux updates are not enabled.
- `hotcrossbuns://` deep links are not registered for Linux yet.
- Tray/status area and autostart remain disabled until their dedicated Linux
  validation phases are complete.
- Global shortcuts are adapter-gated: X11 can attempt Electron registration,
  while Wayland requires the XDG Desktop Portal GlobalShortcuts interface.
  Desktop-matrix validation is still required before claiming reliable global
  hotkey support.
- Local notifications are enabled only when Electron reports desktop
  notification support. GNOME/KDE delivery and notification click-through still
  require release validation.
- Credential storage requires an OS-backed Electron `safeStorage` provider such
  as GNOME Keyring/libsecret or KWallet. The app refuses Electron's
  `basic_text` plaintext fallback.

## Diagnostics

Open Settings > Diagnostics and export a support bundle when reporting preview
issues. Diagnostics are designed to redact raw tokens, raw Google payloads,
bearer tokens, and local paths. Do not paste terminal output that includes
secrets.

Useful checks for support reports:

```sh
echo "$XDG_SESSION_TYPE"
echo "$XDG_CURRENT_DESKTOP"
./Hot-Cross-Buns-2-<version>-linux-x86_64.AppImage --appimage-extract
```

The extracted `squashfs-root/*.desktop` file should identify the app as
`Hot Cross Buns 2`, category `Office`, and `StartupWMClass=hot-cross-buns-2`.

## Data And Removal

The AppImage is portable. Removing the AppImage file removes the application
binary, but it does not remove user data.

Electron stores app data using the platform app paths exposed in Diagnostics.
For a clean smoke run, launch with an isolated user data directory:

```sh
HCB_USER_DATA_DIR="$(mktemp -d)" ./Hot-Cross-Buns-2-<version>-linux-x86_64.AppImage
```

Before deleting data directories, export any local data you need to keep and
confirm Google sync is healthy.
