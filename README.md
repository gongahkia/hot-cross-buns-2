# Hot Cross Buns 2

Electron-first rebuild of Hot Cross Buns.

Start with [docs/README.md](docs/README.md) before changing product, architecture, security, or subsystem behavior.

## Local Development

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm test:smoke
```

The current app scaffold is Electron + React + TypeScript + Vite with an unprivileged renderer and a narrow preload API.

## Preview Release Notes

macOS preview packages are unsigned and unnotarized. They are not public distribution builds and do not enable auto-update.

Useful docs:

- [Contributing](docs/CONTRIBUTING.md)
- [Distribution](docs/release/distribution.md)
- [Mac Preview Support](docs/support/mac-preview-support.md)
- [Privacy And Threat Model](docs/security/privacy-and-threat-model.md)
