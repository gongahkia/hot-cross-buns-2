# Release Candidate Checklist - Mac v1

Date: 2026-05-22
Result: Not release-ready.

## Summary

Automated unit, typecheck, production build, Electron smoke, performance smoke, bundle review, macOS packaging, and checksum verification all completed. The RC is blocked by product and integration gaps rather than failing tests: Google OAuth/Keychain wiring, real Google sync/mutation replay, live MCP server lifecycle, performance budget misses, and native manual verification.

## Command Results

| Command | Status | Evidence |
|---|---|---|
| `pnpm test` | PASS | 24 Vitest files, 115 tests passed in 16.93s. |
| `pnpm typecheck` | PASS | `tsc --noEmit` completed. |
| `pnpm build` | PASS | Main 381.93 kB, preload 154.64 kB, renderer JS 424.13 kB. |
| `pnpm test:smoke` | PASS | 1 Playwright Electron smoke passed in 9.0s. |
| `pnpm test:perf` | PASS | Report-only perf smoke wrote `artifacts/perf/latest.json` and `.md`. |
| `pnpm release:review-bundle` | PASS | No issues; no external main/preload requires; renderer 436.6 KiB. |
| `pnpm release:mac:preview` | PASS | Tests, release build, bundle review, unsigned DMG/zip, and checksums completed. |
| `shasum -a 256 -c SHASUMS256.txt` | PASS | DMG and zip checksums verified. |
| `git diff --check` | PASS | No whitespace errors. |
| `rg` secret-pattern scans over source and diff | PASS | Only fake test fixtures and documentation references found. |
| `git ls-files \| rg` and `git diff \| rg` Swift/Xcode scans | PASS | No Swift source, Xcode project, or runtime dependency found. |
| `rg` renderer/preload privileged-import scans | PASS | Only test-only boundary checks import Node modules; bundle review found no issues. |
| `git status`, `git diff --stat`, and focused `git diff` inspections | PASS | Current tracked changes are docs/report/ignore-rule only. |
| `plutil -p release/mac-arm64/Hot\ Cross\ Buns\ 2.app/Contents/Info.plist` | PASS | Bundle id, version, and `hotcrossbuns` protocol entry inspected. |
| `codesign -dv --verbose=4 ...` | PASS | Signature metadata inspected; app is ad-hoc/linker-signed with no TeamIdentifier. |
| `.gitignore` audit for report visibility | PASS | Root release artifact ignore is anchored as `/release/` so `docs/release/` reports are trackable. |
| `codesign --verify --deep --strict --verbose=2 release/mac-arm64/Hot\ Cross\ Buns\ 2.app` | FAIL EXPECTED | Unsigned preview/ad-hoc app is not notarization-ready. |
| `spctl --assess --type execute --verbose=4 release/mac-arm64/Hot\ Cross\ Buns\ 2.app` | FAIL EXPECTED | Gatekeeper rejects the unsigned preview app. |

Packaging artifacts:

| Artifact | Size | Checksum |
|---|---:|---|
| `release/Hot-Cross-Buns-2-0.0.0-mac-arm64.dmg` | 94 MiB | `66b9b2eede067d3d6d4efd56847a182c2340db50f08e713e1bdc6994cc468a96` |
| `release/Hot-Cross-Buns-2-0.0.0-mac-arm64.zip` | 91 MiB | `e0582c817916494344302a568438680044f4ef0c6ba612b537565e23f179b91c` |

Packaging caveats: `electron-builder` reported missing `package.json` author, default Electron icon, skipped signing because `mac.identity: null`, and generated blockmap/latest metadata that must not be uploaded for the unsigned preview flow.

## Performance Smoke

Mode: report-only. Fixture data was generated locally and used a temporary app data path.

| Flow | Target | Cold | Warm | Status |
|---|---:|---:|---:|---|
| Shell visible | cold <1500ms, warm <700ms | 2952ms | 2901ms | BLOCKED |
| Cached data rendered | <300ms after database open | 4469ms total | 4481ms total | BLOCKED |
| Command palette open | <100ms | 16.2ms | 10.52ms | PASS |
| Quick capture open | <150ms | 38.03ms | 40.34ms | PASS |
| Local search service | <100ms | 77.8ms | 76ms | PASS |
| Search UI update | <100ms user-perceived | 270.68ms | 263.84ms | BLOCKED |
| Task scrolling | 16ms target, 32ms sustained max | 14.9ms | 13.87ms | PASS |
| Calendar month navigation | reviewed against frame budget | 37.63ms | 35.15ms | WATCH |
| Task completion optimistic feedback | <100ms | 239.17ms | 251.62ms | BLOCKED |

SQLite query plans were indexed for task, event, note, search, checkpoint, and pending-mutation paths. Slow IPC outliers in the perf report: `diagnostics.summary` around 757ms and `settings.get` around 376ms.

## PRD Success Criteria

| Criterion | RC status | Owner |
|---|---|---|
| User can connect Google through desktop OAuth. | BLOCKED: OAuth service classes exist, but production IPC/UI/client config and Keychain-backed token storage are not wired. | Google Sync / Settings |
| User can view selected task lists and calendars from local cache after sync. | PARTIAL: local SQLite cache renders in tests; selected resource setup and real account sync wiring are not complete. | Google Sync / Local Data |
| User can create, edit, complete/reopen, move, and delete tasks. | PARTIAL: local optimistic SQLite flows work; Google mutation replay/reconciliation is deferred. | Core UI / Sync |
| User can create, edit, and delete calendar events. | PARTIAL: local optimistic SQLite flows work; Google mutation replay/reconciliation is deferred. | Core UI / Sync |
| User can create and search local notes. | IMPLEMENTED. | Core UI / Local Data |
| User can open command palette and quick capture without leaving the keyboard. | IMPLEMENTED for in-app keyboard path; global hotkey path still needs manual verification. | Renderer / Native Shell |
| Tray/menu bar and global hotkey flows work on macOS. | BLOCKED pending installed-app manual verification; code paths exist. | Native Shell |
| Local MCP read tools work behind bearer-token authentication. | BLOCKED: MCP server contracts pass, but live listener and Keychain-backed token lifecycle are not wired into app startup. | MCP / Native Shell |
| MCP write tools support dry-run and confirmation. | BLOCKED for release use because the live server is not wired; contract tests cover the tool behavior. | MCP |
| Tests cover domain logic, SQLite migrations, IPC contracts, Google transport mocks, MCP contracts, and launch smoke flows. | IMPLEMENTED for current covered surfaces. | QA |

## Blockers

| Owner | Blocker | Required resolution |
|---|---|---|
| Google Sync / Settings | No user-facing desktop OAuth flow or Keychain-backed Google credential adapter is wired into production IPC/UI. | Add OAuth IPC/UI, bring-your-own-client configuration, OS credential storage, and sanitized status persistence. |
| Sync / Data | Real Google sync scheduling, account selection, and pending-mutation replay/reconciliation remain deferred; service container uses noop Google transports by default. | Wire authenticated transports, sync scheduler, mutation worker, retry/conflict handling, and diagnostics. |
| MCP / Native Shell | MCP status/settings are stateful, but no live local listener starts from app settings, and MCP bearer token storage is not Keychain-backed. | Start/stop `LocalMcpServer` safely after app interactive, persist bearer token in OS credentials, and expose usable connection details. |
| Performance / Main / Renderer | Startup shell-visible, cached render, search UI, and task-complete feedback miss `docs/performance/performance-strategy.md` budgets. | Profile startup staging and renderer/data IPC paths; record accepted baseline or fix before RC sign-off. |
| Native Shell / Release QA | Tray/menu bar, global hotkey, notifications, and `hotcrossbuns://` protocol behavior were not manually verified on the packaged app. | Run `docs/testing/manual-macos-native-shell.md` against the packaged app and record results. |
| Release Packaging | Unsigned preview artifacts build, but package metadata still uses default Electron icon, missing author metadata, and is not notarization-ready. | Add product icon/author metadata for preview polish; signing/notarization remains required before broad distribution. |

## Diff Audit

Git diff audit covered the current tracked changes and the packaging/bundle-review changes observed at the start of QA:

- No accidental secret exposure found in the diff.
- No old Swift/Xcode runtime dependency found.
- No renderer privilege leak found; renderer source remains covered by static boundary tests and bundle review.
- No unrelated churn identified.

Docs updated during this QA pass:

- `.gitignore`: anchored generated release artifacts as `/release/` so `docs/release/` reports are not ignored.
- `docs/release/distribution.md`: clarified generated `app-update.yml` does not mean updater support.
- `docs/specs/native-parity.md`: documented current Keychain/MCP listener blockers.
- `docs/release/release-candidate-checklist.md`: added this RC report.
