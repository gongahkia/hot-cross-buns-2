## July 2026 Frontend Reference Prompts

Run these before the platform port prompts. Each visual prompt should be run with screenshots attached in the chat or placed under the suggested local folders:

- `artifacts/reference-screenshots/apple-calendar/`
- `artifacts/reference-screenshots/notion-calendar/`
- optional current Hot Cross Buns 2 before screenshots: `artifacts/reference-screenshots/hcb-before/`

Use Apple Calendar and Notion Calendar as reference products only. Extract layout, density, navigation, interaction, and performance lessons. Do not copy protected branding, exact icons, exact copy, product names in UI, or proprietary artwork. Do not add other reference products unless they are explicitly re-added later.

## P0 User-Facing Customization DSL

Run alone before any Linux or Windows port work. This establishes a scriptable shell language and theming/customization DSL that lets end users reconfigure the look, layout, and behavior of the app, similar in spirit to Discord's BetterDiscord/Vencord-style theme and plugin model (without copying their branding, code, or APIs).

```text
You are Codex 5.5 running with extra-high reasoning in /Users/gongahkia/Desktop/coding/projects/hot-cross-buns-2.

Goal: design and implement a user-facing customization DSL and scriptable shell language that allows end users to reconfigure how the entire app looks and behaves (themes, layout density, panel arrangement, keybindings, and scriptable hooks), inspired by the customization surface area exposed by Discord-style clients but without reusing their branding, copy, APIs, or proprietary assets.

Read first:
- docs/README.md
- docs/agents/workflow.md
- docs/specs/platforms.md
- docs/security/privacy-and-threat-model.md
- docs/performance/performance-strategy.md
- docs/testing/qa-plan.md
- docs/improvements/01-user-facing-feature-parity.md
- docs/improvements/06-frontend-ux-ui-competitive-improvements.md

Implement:
- A declarative theme DSL (tokens, palettes, typography, spacing, radii, density) loadable from a user config file with hot-reload in dev and explicit reload in production.
- A layout/config DSL covering panel visibility, ordering, default views, sidebar contents, and keybinding overrides.
- A sandboxed scripting surface (no arbitrary Node/Electron access) with a narrow, documented API for: registering commands, observing app events, transforming visible data structures, and contributing UI affordances through approved extension points.
- A user config directory under the platform-appropriate app data path, with example starter configs and a schema (JSON Schema or equivalent) for editor tooling.
- Settings UI entry points for enabling/disabling user themes and scripts, viewing load errors, and resetting to defaults.
- Capability gating so user scripts cannot read credentials, exfiltrate data, or bypass MCP local-only guarantees.
- Automated tests for: DSL parsing, schema validation, theme token resolution, sandbox isolation, and reload behavior.
- Documentation under docs/customization/ describing the DSL surface, stability guarantees, and security model.

Do not:
- Expose Node, Electron, fs, net, or child_process to user scripts.
- Allow user themes/scripts to silently override security-relevant UI (permission prompts, credential dialogs, update prompts).
- Copy Discord (or any other product's) branding, copy, icons, API shapes, or proprietary asset names into the DSL.
- Ship a plugin marketplace, remote fetch of scripts, or auto-update of user scripts in this prompt.
- Break existing default look and feel for users who do not opt in.

Acceptance checks:
- Run typecheck/build.
- Run unit tests for DSL parser, schema validation, and sandbox.
- Manually load a sample theme and a sample script; confirm hot-reload, error surfacing, and reset-to-default all work.
- Summarize the DSL surface, extension points exposed, sandbox boundaries, and follow-up work deferred to later prompts.
```

## Future Platform Prompts

Run these only after Mac v1 is stable and after P0 has landed. Do not run Linux and Windows port work in parallel for the first pass. Linux is the first non-Mac port; Windows follows after the Linux adapter lessons are incorporated.

### P8A Cross-Platform Adapter Audit

Run alone after Mac v1.

```text
You are Codex 5.5 running with extra-high reasoning in /Users/gongahkia/Desktop/coding/projects/hot-cross-buns-2.

Goal: audit and prepare the shared platform adapter layer before Linux and Windows port work begins.

Read first:
- docs/README.md
- docs/agents/workflow.md
- docs/specs/platforms.md
- docs/ports/cross-platform-porting.md
- docs/ports/linux-port.md
- docs/ports/windows-port.md
- docs/release/distribution.md
- docs/security/privacy-and-threat-model.md
- docs/performance/performance-strategy.md
- docs/performance/build-and-test-performance.md
- docs/testing/qa-plan.md
- docs/improvements/01-user-facing-feature-parity.md
- docs/improvements/02-backend-optimizations.md
- docs/improvements/03-database-optimizations.md
- docs/improvements/04-test-coverage-parity.md
- docs/improvements/05-general-parity-and-release-polish.md
- docs/improvements/06-frontend-ux-ui-competitive-improvements.md

Implement:
- Identify current Mac-only assumptions in platform paths, credentials, tray, menu, shortcuts, notifications, custom protocol, autostart, updater, diagnostics, OAuth, MCP, packaging, and tests.
- Create or refine shared adapter interfaces for the platform capabilities listed in docs/ports/cross-platform-porting.md.
- Add capability-report DTOs exposed through preload/settings where appropriate.
- Add adapter contract tests that can run without Linux or Windows.
- Use docs/improvements/ to classify parity items as platform implementation, shared backend/database work, tests, release docs, manual QA, or backlog.
- Update docs if the adapter contract changes.

Do not:
- Break macOS behavior.
- Implement Linux or Windows packaging in this prompt.
- Claim non-Mac platform support.
- Put platform-specific logic directly into renderer components.

Acceptance checks:
- Run shared tests.
- Run typecheck/build.
- Summarize Mac-only assumptions found, adapter contracts added, and blockers for Linux.
```

### P8B Linux Port Foundation

Run alone after P8A.

```text
You are Codex 5.5 running with extra-high reasoning in /Users/gongahkia/Desktop/coding/projects/hot-cross-buns-2.

Goal: implement the Linux platform foundation without claiming broad Linux release readiness.

Read first:
- docs/README.md
- docs/agents/workflow.md
- docs/specs/platforms.md
- docs/ports/cross-platform-porting.md
- docs/ports/linux-port.md
- docs/release/distribution.md
- docs/security/privacy-and-threat-model.md
- docs/performance/performance-strategy.md
- docs/performance/build-and-test-performance.md
- docs/testing/qa-plan.md
- docs/improvements/01-user-facing-feature-parity.md
- docs/improvements/02-backend-optimizations.md
- docs/improvements/04-test-coverage-parity.md
- docs/improvements/05-general-parity-and-release-polish.md
- docs/improvements/06-frontend-ux-ui-competitive-improvements.md

Implement:
- Linux adapter implementations or stubs for app paths, credentials, tray/status area, global shortcuts, notifications, custom protocol, autostart, updater metadata, external open behavior, and diagnostics.
- Capability detection for Secret Service/libsecret availability, tray support, X11 vs Wayland, portal global shortcut availability where feasible, notification support, and protocol registration status.
- Linux settings/diagnostics surfaces that show capability status and caveats.
- Linux-specific automated tests that can run on non-Linux via adapter mocks, plus Linux-only tests where appropriate.
- Use the improvement docs to keep feature parity Electron-native and to separate platform blockers from shared backend blockers.
- Documentation updates for any implementation choices that differ from docs/ports/linux-port.md.

Do not:
- Break macOS behavior.
- Claim universal Linux parity.
- Enable plaintext credential fallback.
- Enable in-place auto-update before package behavior is verified.

Acceptance checks:
- Run shared tests.
- Run typecheck/build.
- Run Linux adapter tests.
- Summarize Linux capabilities, unsupported features, manual checks required, and remaining packaging blockers.
```

### P8C Linux Packaging And Desktop QA

Run alone after P8B. Run on Linux if possible; otherwise produce config/docs and mark runtime checks as blocked.

```text
You are Codex 5.5 running with extra-high reasoning in /Users/gongahkia/Desktop/coding/projects/hot-cross-buns-2.

Goal: create and verify the Linux technical preview packaging path, starting with AppImage.

Read first:
- docs/README.md
- docs/agents/workflow.md
- docs/ports/linux-port.md
- docs/ports/cross-platform-porting.md
- docs/release/distribution.md
- docs/performance/build-and-test-performance.md
- docs/performance/performance-strategy.md
- docs/testing/qa-plan.md
- docs/improvements/02-backend-optimizations.md
- docs/improvements/04-test-coverage-parity.md
- docs/improvements/05-general-parity-and-release-polish.md

Implement:
- electron-builder Linux config for AppImage first.
- Desktop file metadata, icon configuration, categories, keywords, and StartupWMClass where needed.
- Custom protocol registration configuration if supported by the chosen package target.
- Linux install/run/uninstall notes in release docs.
- Linux manual QA checklist document under docs/release or docs/ports if it does not already exist.
- Linux performance smoke instructions for AppImage and installed package paths.
- Reference the improvement docs when adding release, updater, native lifecycle, test, or manual QA instructions.
- Optional DEB/RPM docs only if AppImage baseline is already clear.

Do not:
- Claim automatic Linux updates unless package/update behavior is implemented and tested.
- Claim GNOME/KDE/Wayland/X11 parity without manual evidence.
- Store signing or release secrets in the repo.

Acceptance checks:
- Run typecheck/build.
- Run Linux package command if on a suitable Linux environment.
- Run Playwright launch smoke on Linux if possible.
- Run performance smoke report on Linux if possible.
- Record pass/fail/manual-blocked status for tray, global shortcut, notifications, OAuth, MCP, protocol links, desktop integration, and AppImage launch.
```

### P9A Windows Port Foundation

Run alone after the Linux technical preview work has landed.

```text
You are Codex 5.5 running with extra-high reasoning in /Users/gongahkia/Desktop/coding/projects/hot-cross-buns-2.

Goal: implement the Windows platform foundation without claiming broad Windows release readiness.

Read first:
- docs/README.md
- docs/agents/workflow.md
- docs/specs/platforms.md
- docs/ports/cross-platform-porting.md
- docs/ports/windows-port.md
- docs/release/distribution.md
- docs/security/privacy-and-threat-model.md
- docs/performance/performance-strategy.md
- docs/performance/build-and-test-performance.md
- docs/testing/qa-plan.md
- docs/improvements/01-user-facing-feature-parity.md
- docs/improvements/02-backend-optimizations.md
- docs/improvements/04-test-coverage-parity.md
- docs/improvements/05-general-parity-and-release-polish.md
- docs/improvements/06-frontend-ux-ui-competitive-improvements.md

Implement:
- Windows adapter implementations or stubs for app paths, credential storage, tray, global shortcuts, notifications, custom protocol, autostart, updater metadata, external open behavior, and diagnostics.
- Stable AppUserModelID/app identity wiring early in startup.
- Windows settings/diagnostics surfaces that show tray, shortcut, notifications, protocol, updater, signing, and SmartScreen status where known.
- Windows-specific automated tests that can run on non-Windows via adapter mocks, plus Windows-only tests where appropriate.
- Use the improvement docs to keep feature parity Electron-native and to separate platform blockers from shared backend blockers.
- Documentation updates for any implementation choices that differ from docs/ports/windows-port.md.

Do not:
- Break macOS or Linux behavior.
- Claim Windows release readiness until installer, notification, protocol, OAuth, MCP, and performance checks run on Windows.
- Enable automatic updates before installer identity, signing, and release metadata are tested.
- Store certificates or signing secrets in the repo.

Acceptance checks:
- Run shared tests.
- Run typecheck/build.
- Run Windows adapter tests.
- Summarize Windows capabilities, unsupported features, manual checks required, signing blockers, and packaging blockers.
```

### P9B Windows Packaging And Signing QA

Run alone after P9A. Run on Windows if possible; otherwise produce config/docs and mark runtime checks as blocked.

```text
You are Codex 5.5 running with extra-high reasoning in /Users/gongahkia/Desktop/coding/projects/hot-cross-buns-2.

Goal: create and verify the Windows technical preview packaging path, starting with NSIS, and document signing/SmartScreen expectations.

Read first:
- docs/README.md
- docs/agents/workflow.md
- docs/ports/windows-port.md
- docs/ports/cross-platform-porting.md
- docs/release/distribution.md
- docs/security/privacy-and-threat-model.md
- docs/performance/build-and-test-performance.md
- docs/performance/performance-strategy.md
- docs/testing/qa-plan.md
- docs/improvements/02-backend-optimizations.md
- docs/improvements/04-test-coverage-parity.md
- docs/improvements/05-general-parity-and-release-polish.md

Implement:
- electron-builder Windows config for NSIS first.
- AppUserModelID, executable name, installer display name, Start Menu shortcut, protocol registration, and icon metadata.
- Windows install/run/uninstall notes in release docs.
- Signing plan documentation covering unsigned internal preview, Microsoft Store MSIX option, Azure Artifact Signing/Trusted Signing, OV certificate, and self-signed dev-only behavior.
- Windows manual QA checklist document under docs/release or docs/ports if it does not already exist.
- Windows performance smoke instructions for installed NSIS builds.
- Reference the improvement docs when adding release, updater, native lifecycle, test, or manual QA instructions.

Do not:
- Commit certificates, passwords, tokens, or signing secrets.
- Claim public Windows distribution readiness without a signing plan.
- Claim SmartScreen will not warn unless the chosen distribution path proves that.
- Enable in-place auto-update before signed installer/update metadata are verified.

Acceptance checks:
- Run typecheck/build.
- Run Windows package command if on a suitable Windows environment.
- Run Playwright launch smoke on Windows if possible.
- Run performance smoke report on Windows if possible.
- Record pass/fail/manual-blocked status for installer, Start Menu launch, taskbar grouping, tray, global shortcut, notifications, OAuth, MCP, protocol links, uninstall, and SmartScreen/signing expectations.
```

### P10 Cross-Platform Release Hardening

Run alone after Linux and Windows technical preview work has landed.

```text
You are Codex 5.5 running with extra-high reasoning in /Users/gongahkia/Desktop/coding/projects/hot-cross-buns-2.

Goal: harden the cross-platform release story after macOS, Linux, and Windows preview paths exist.

Read first:
- docs/README.md
- docs/agents/workflow.md
- docs/ports/cross-platform-porting.md
- docs/ports/linux-port.md
- docs/ports/windows-port.md
- docs/specs/platforms.md
- docs/release/distribution.md
- docs/security/privacy-and-threat-model.md
- docs/performance/performance-strategy.md
- docs/testing/qa-plan.md
- docs/improvements/02-backend-optimizations.md
- docs/improvements/04-test-coverage-parity.md
- docs/improvements/05-general-parity-and-release-polish.md

Tasks:
- Audit platform adapters for duplicated logic, drift, unsafe fallbacks, and renderer platform branching.
- Verify all platform capability reports are exposed consistently in Settings and Diagnostics.
- Verify install/update/uninstall docs match actual package behavior.
- Verify performance smoke reports exist or are explicitly blocked per platform.
- Verify manual QA checklists exist for macOS, Linux, and Windows.
- Use the improvement docs to classify unresolved parity work as shared backend, tests, release polish, platform caveat, or explicit backlog.
- Update roadmap/docs to distinguish supported, technical preview, and unsupported features by platform.

Do not:
- Add new platform scope.
- Claim parity where platform caveats remain unresolved.
- Weaken security, credential storage, or MCP local-only guarantees to simplify a port.

Acceptance checks:
- Run full available test suite.
- Run typecheck/build.
- Run packaging checks available on the current host.
- Produce or update a cross-platform release readiness report with blockers per platform.
```
