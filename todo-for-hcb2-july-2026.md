# TODO for HCB2 - July 2026

Consolidated from:

- `stuff-missing-from-hcb2-to-add-july-2026.md`
- `prompts-to-run-july-2026-to-port-to-diff-devices.md`
- `proposed-optimisations-for-hcb2-july-2026.md`

This is the single July 2026 planning todo. Ports stay last.

Last repo audit for this file: 2026-06-06.

Status key:

- `Done`: static repo evidence found.
- `Partial`: implemented enough to use, but named hardening/depth remains.
- `Missing`: no static repo evidence found during this audit.
- `Verify`: likely present or adjacent code exists, but needs a feature-specific audit before code.
- `Deferred`: intentionally parked.

## Current status snapshot

### Done / verified present

- Task-backed notes are the current app/MCP/CLI model. Old local-only SQLite note tables are dropped by migration evidence, and docs/specs say notes sync through Google Tasks.
- MCP/CLI v1 exists with Git-like reads and writes:
  - reads: `doctor`, `status`, `log`, `diff`, `show`, `search`, `today`, `week`, list/get commands, undo status, pending mutations
  - writes: sync/retry/cancel queue, create/update/delete task/event/note/list, rename lists, complete/reopen task/event, move task, schedule task block, settings/OAuth/MCP admin, undo/redo, convert
  - dry-run/confirmation behavior exists for writes, destructive tools are guarded, and CLI docs exist.
- CRUD coverage for tasks, events, notes, task lists, and note lists exists through the shared domain services used by UI and MCP/CLI.
- Event completion exists as local HCB state for calendar events, including renderer behavior and MCP/CLI complete/reopen tools.
- Convert flows exist for task/event/note primitives; birthdays are explicitly excluded from conversion.
- Duplicate controls exist for task/event/note/birthday inspector flows; copies use `(copy)` naming and open as editable drafts.
- Birthday events are first-class HCB calendar events with `hcbKind: "birthday"`, strict UI fields, Google `eventType`/birthday metadata read mapping, strict birthday create/update payload tests, and birthday-safe mutation worker handling.
- Google Calendar event `colorId` is cached, written, theme-mapped, and user-overridable in Appearance settings.
- Rule-based auto-tagging/color assignment exists for tasks/events/notes with settings toggle, validation, preview, conflict visibility, reorder controls, invalid-regex auto-disable, and tests.
- Calendar has Agenda/Day/Multi-Day/Week/Month modes, overflow popovers titled `Items for <date>`, all-item overflow contents, completed-first ordering in overflow, and task-linked Google Calendar projection cleanup on task deletion.
- Google account disconnected state is surfaced as a user-visible issue while cached SQLite data can still render.
- Sidebar task/note counts use HCB-visible task-backed counts instead of raw Google/cache totals.
- Full unit suite was previously green after the latest auto-tag/settings hardening pass.

### Partial / still worth drilling down

- Tags exist as string metadata and auto-tag outputs, but there is no first-class tag repository, many-to-many table, tag CRUD UI, saved tag views, or tag analytics.
- Auto-tagging lacks inspector-level "why was this tagged?" audit detail and bulk backfill/reapply controls.
- Duplicate controls exist, but duplicate detection/review UI is still missing.
- Conversion works, but should get one live/manual QA pass against real Google sync for replace-original cleanup and queued mutation replay.
- MCP/CLI is featureful, but advanced agent-native surfaces like `hcb_brief`, prompt registry, `hcb tail`, `hcb plan`, webhooks, and pending agent action tray are still missing.
- Birthday Google payload shape is unit-tested, but live Google API smoke for birthday create/update/delete is still the main external-risk test.
- Quick-add/NL parsing has meaningful code and tests, including recurrence handling, but not the full chrono-style parser depth listed below.
- Calendar recurrence UI exists, but full Google-safe recurring edit scope and RRULE depth still need audit/finish work.

### Missing / not implemented yet

- Startup bootstrap snapshot and schedule-suggestion deferral.
- Near-immediate pending queue drain after CRUD.
- First-class multi-account isolation and merged multi-account Today.
- Hierarchical Areas.
- Bulk operations with coalesced undo/mutation entries.
- Year view.
- Advanced search operators, custom-filter DSL, pinned filters.
- Semantic search, local LLM provider, and conversational planning sidebar.
- CSS snippets, JSON config/keymaps, and sandboxed user extensions.
- Portable export/import, attachments, ICS import/subscriptions.
- Cache encryption, sync mode selector, retention/cleanup settings.
- Spotlight/Raycast/Alfred/App Intents/Shortcuts/Share Extension.
- Rich notification actions.
- Renderer History / Sync Issues window.
- Linux/Windows ports.

## Recommended next implementation order

1. Startup/sync snappiness:
   - defer `calendar.scheduleSuggest`
   - add one bootstrap IPC snapshot
   - trigger debounced queue drains after CRUD
   - reason: highest direct UX payoff with no new product concept.
2. Duplicate detection/review:
   - find probable duplicate tasks/events/notes
   - review, dismiss, merge/delete flows
   - reason: duplicate controls now exist; detection is the matching cleanup surface.
3. First-class tags:
   - tag table/repository, tag CRUD, tag colors, filters, saved views
   - auto-tag audit detail: "why was this tagged?"
   - reason: auto-tagging currently creates tag value, but tags are not yet a durable product primitive.
4. Recurrence correctness:
   - recurring edit scope, deeper RRULE editor, round-trip tests
   - reason: high-risk calendar behavior; better before broad calendar automation.
5. Search/filter depth:
   - advanced operators, custom DSL, saved queries, pinned filters
   - reason: pays off after tags/areas exist.
6. Agent-native MCP/CLI v2:
   - `hcb_brief`, prompt registry, `hcb tail`, `hcb plan`, pending action tray
   - reason: v1 CRUD/read surface is done; v2 should focus on planner-level summaries and safe proposed writes.
7. Import/export and data safety:
   - deterministic `.hcb2export`, dry-run import diff, backups
   - reason: needed before real-user beta and before risky migrations/encryption.
8. Release hardening:
   - live Google smoke, external MCP client QA, notification actions, updater, packaging/signing checks
   - reason: product-readiness work after feature slices stabilize.

## 0. Planning gate

- 2026-06-06: this file was re-audited against the current repo. Repeat before any implementation slice.
- Re-audit current repo and `../hot-cross-buns` before implementation.
- For each item below, classify as `Present`, `Partial`, `Missing`, or `Deferred-with-reason` before code.
- Inspect at minimum:
  - `src/main/mcp/toolRegistry.ts`
  - `src/renderer/src/features/core/inspectors/TaskInspectorBody.tsx`
  - `src/renderer/src/features/core/screens/settings/AdvancedSettingsTab.tsx`
  - `src/renderer/src/features/core/screens/calendar/CalendarEventForm.tsx`
  - `src/main/sync/readSyncRepository/recurrence.ts`
  - `src/main/native/notificationScheduling.ts`
  - `src/renderer/src/features/core/viewModelSource/loader.ts`
  - `src/renderer/src/features/core/viewModelSource/provider.tsx`
- Interview user before coding: priorities, acceptable slices, UX expectations, migration tolerance, security expectations, platform scope, test depth, and explicit deferrals.
- Produce a dependency-aware implementation plan with migrations, UI surfaces, IPC/contracts, tests, manual QA, and rollback/data-safety notes.
- Keep each slice scoped; update this todo when an item is implemented, verified present, or deferred.

## 1. Startup and sync optimisations

- Status: `Missing`; recommended next slice.
- Defer `calendar.scheduleSuggest` until after first useful render.
  - Initial snapshot should render tasks, calendar, notes, settings, sync status, Google status, and native status without waiting for suggestions.
  - Today/schedule UI needs stable pending and empty states.
  - Update tests that assume startup waits on `scheduleSuggest`.
- Add one bootstrap IPC snapshot for initial app load.
  - Replace startup IPC fan-out with one typed bootstrap endpoint where safe.
  - Keep paging and lazy calendar range loading separate.
  - Treat bootstrap contract changes as high blast-radius.
- Trigger near-immediate pending-mutation queue drain after CRUD.
  - Debounce and batch drains.
  - Respect offline mode, disconnected accounts, sync-paused state, and app quit/startup sync.

## 2. Core planner feature gaps

### Accounts and sync scope

- Promote the account mirror to first-class multi-account:
  - list and manage all connected Google accounts, not only the latest account status
  - keep OAuth tokens, sync checkpoints, mutation queues, task lists, calendars, tasks, and events isolated per account
  - add account badges and per-account filters for task lists, calendars, search, Today, and diagnostics
  - support a merged Today view across Personal + Work while preserving source account identity
  - make create/update flows choose an explicit target account/calendar/list when ambiguity exists
  - verify disconnected/reauth-required accounts do not block healthy accounts
  - add migration tests for existing single-account caches and replay tests for per-account pending mutations

### Tasks and organisation

- Verify/finish Kanban parity beyond the current Google-list board if original `KanbanGrouping` behavior is not covered.
- Add first-class tags:
  - tag repository
  - tag-task many-to-many table
  - tag colors
  - tag CRUD
  - `@tag` extraction
  - tag filters and saved views
- Add rule-based auto-tagging and color assignment:
  - regex/prefix/contains rules over title and body/details
  - examples like title starts with `CODING:` -> tag `coding` and color red
  - apply on create and update for tasks, events, and notes
  - rule priority/order and conflict handling
  - preview/test-rule UI before enabling
  - optional strip/keep matched prefixes
  - "why was this tagged?" inspector/audit detail
- Add hierarchical Areas:
  - area schema
  - area sort order
  - area colors
  - task-list grouping under areas
  - settings/sidebar UI
- Finish bulk operations where current multi-select is incomplete:
  - reschedule
  - tag/untag
  - batched/coalesced undo and mutation entries
- Add duplicate detection and duplicate-review UI for tasks, events, and notes.
- Finish snooze UX:
  - inspector controls for `snoozeUntil`
  - visible snoozed state in task lists/today/search
  - clear/snooze presets
- Finish subtask hierarchy UX:
  - parent/child editing in inspector
  - move/reorder subtasks safely inside Google Tasks list constraints
  - clear visual hierarchy in task views
- Finish task/event template engine if current settings-only templates are not fully instantiated:
  - `{{today}}`
  - `{{+Nd}}`
  - `{{prompt:Label}}`
  - `{{clipboard}}`
  - task/event creation from templates
- Upgrade NL quick-add with chrono-style date parsing and RRULE inference:
  - parse phrases like `every other Tue 9am`, `next Fri 2-4pm`, and `weekly until Jul 30`
  - convert recurring phrases into the existing `CalendarEventRecurrence` shape
  - preserve matched-token chips and remove parsed text from final title/summary
  - keep deterministic fallbacks for ambiguous dates/times
  - add parser tests for time zones, ranges, recurring weekdays, intervals, end dates, and count limits

### Calendar

- Verify/implement Year view if not present in renderer calendar view modes.
  - 4x3 mini-month grid
  - heatmap/count indicators
  - keyboard navigation
- Verify/finish drag-to-create on calendar grids.
- Add month/week day-agenda popover from cell/day click.
- Add smart-reschedule:
  - suggest new slots for overdue, conflicted, or unscheduled tasks
  - respect priority, duration, locked schedules, working hours, visible calendars, and existing events
  - dry-run preview before applying changes
  - batch apply with undo and mutation coalescing
  - explain why each slot was chosen
- Finish recurring-event edit scope:
  - this event
  - this and future
  - all events
  - safe Google mutation semantics
- Finish visual RRULE editor depth if current UI does not cover all supported recurrence fields:
  - frequency, interval, weekdays, month rules, end date, count, and never-ending rules
  - readable summary and raw RRULE preview
  - validation for unsupported Google/RFC combinations
  - round-trip tests against current recurrence sync code
- Add attendee management depth beyond raw guest emails:
  - RSVP/status display
  - invitations
  - attendee validation/errors
- Add Google Meet/Hangouts attach on event create if current conference support is read-only.
- Add event visibility/transparency UI:
  - busy/free
  - public/private/default
- Expand custom reminders beyond one simple reminder field if needed.

### Today and review surfaces

- Verify dedicated Today/Home surface coverage.
- If incomplete, add overdue, due-today, scheduled, next-up, upcoming events, and sidebar-filter-aware sections.
- Add forecast/review summary builders if still missing from original parity.

## 3. Linked markdown and knowledge graph

- Add shared wikilink parser for every markdown surface:
  - `[[note:...]]`
  - `[[task:...]]`
  - `[[event:...]]`
  - list/calendar links
  - aliases where needed
- Render clickable wikilinks in note bodies, task notes, event descriptions, and list metadata.
- Add read-only transclusion/live embeds:
  - `![[note:...]]`
  - `![[task:#id]]`
  - event/list/calendar embeds if useful
  - cycle and depth limits
  - loading/error/broken-target states
- Add universal entity-link graph:
  - `src_kind`
  - `src_id`
  - `dst_kind`
  - `dst_id`
  - `link_type`
  - source field/surface metadata where useful
- Re-index links after note/task/event/list/calendar edits and Google read sync.
- Expose graph-backed backlinks and outgoing links for every primitive.
- Make broken links visible and repairable for every primitive, not just notes.

## 4. Search, filters, and command surfaces

- Add advanced search operators:
  - regex mode
  - `attendee:`
  - `duration>30m`
  - `has:notes`
  - `due<+7d`
  - list/tag/calendar/status/priority combinations
- Add custom-filter DSL:
  - `list:`
  - `tag:`
  - `AND` / `OR` / `NOT`
  - relative dates
  - saved queries
  - validation and explain output
- Add local semantic search layered on existing search:
  - evaluate `sqlite-vec` vs SQLite `Vec1` for packaging stability
  - use a worker-backed embedding path, starting with `Xenova/all-MiniLM-L6-v2` / `@huggingface/transformers` if packaging is acceptable
  - store 384-dimensional embeddings with entity kind/id, source text hash, model id, and generated-at metadata
  - store embeddings for tasks, events, notes, lists, and calendars locally
  - background embedding/index refresh after edits and sync
  - hybrid ranking with current FTS/DSL results
  - local/private model and no remote embedding calls by default
  - model download/cache controls, rebuild controls, and disabled-state UI when the model or vector extension is unavailable
  - diagnostics for stale/missing embeddings
- Add opt-in local LLM provider hook:
  - support user-configured Ollama and llama.cpp/OpenAI-compatible local endpoints
  - default disabled; prefer `127.0.0.1` / `localhost` endpoints unless the user explicitly opts into a remote URL
  - summarize long notes, suggest task breakdowns, draft event agendas, and explain plans through existing MCP read/write tools
  - route writes through dry-run previews and confirmation IDs; no silent task/event/note mutations
  - redact tokens/secrets, enforce context budgets, timeouts, cancellation, rate limits, and audit logs
  - show model/provider health, last error, and privacy status in Settings/Diagnostics
- Add in-app conversational planning sidebar:
  - act as an MCP client to HCB's local tools/resources/prompts and a user-configured model
  - answer planning questions like "what should I do next?" using Today/search/calendar/task context
  - surface proposed writes through the Pending agent action tray
  - keep chat history local, exportable, clearable, and excluded from remote services by default
  - include prompt-injection guardrails for note/event/task content used as context
- Add pinned filters in sidebar and menu-bar popover with count badges.
- Split quick switcher and quick-add mental model if current command palette remains one surface:
  - `Cmd+O` for go/open
  - `Shift+Cmd+P` for do/action
  - command IDs remain discoverable
- Add leader-key chord bindings with conflict detection.
- Add which-key HUD overlay for chord discovery.

## 5. User customisation layer

### CSS tokens and snippets

- Audit renderer styles and publish stable CSS custom properties for colors, typography, spacing, radii, shadow, and motion.
- Add user snippets directory under app data, e.g. `<userData>/snippets/*.css`.
- Add snippet loader with enable/disable/reload/error handling.
- Add Settings UI for snippets:
  - detected snippets
  - enable/disable
  - load errors
  - open snippets folder
  - reset defaults
- Add `docs/customization/theming.md` with public tokens, scoping rules, stability guarantees, and sample snippets.
- Add tests for token presence, snippet loading, snippet errors, and CSP regression.

### JSON config and keymaps

- Add app-data `settings.json` for layout, density, panel visibility/order, default view, sidebar contents, and safe feature toggles.
- Add app-data `keymap.json`:
  - keys
  - command id
  - `when` predicate
- Add JSON Schemas under `docs/customization/schemas/`.
- Add a typed settings store with defaults, deep merge, validation errors, and change events.
- Add Settings UI for opening/resetting config files and surfacing validation errors.
- Parse `when` predicates without `eval` or `new Function`.
- Add tests for schemas, merge precedence, predicate parser, and keybinding conflicts.

### Sandboxed extensions

- Add user extension directory: `<userData>/extensions/<id>/{manifest.json,main.js}`.
- Run extension views as sandboxed renderer iframes or equivalent isolated web contents with no Node/Electron/fs/net/child_process access.
- Expose only a versioned, capability-gated bridge.
- Initial host API:
  - `registerCommand`
  - `onEvent`
  - `contributeView`
  - `getSetting` for whitelisted keys
- Make plugin UI communicate only through a reduced preload/host bridge with schema validation, rate limits, and explicit capability grants.
- Block remote code loading by default; require local packaged extension files and a strict extension CSP.
- Add manifest capabilities and first-load user consent.
- Add per-extension enable/disable, logs, requested capabilities, and safe mode.
- Add sandbox escape tests, bridge contract tests, capability tests, and safe-mode tests.
- Add `docs/customization/extensions.md` with security model and sample extension.

## 6. Data, import/export, and local files

- Verify/finish portable `.hcbexport` / `.hcb2export` workflow:
  - manifest
  - state
  - deterministic, stable-key JSON export for tasks, events, notes, lists, calendars, settings, links, and sync metadata
  - sorted arrays and canonical object ordering so repeated exports can be git-diffed
  - one-file-per-entity or domain-sharded layout suitable for `git init` audit trails
  - omit or isolate volatile fields so unchanged planner state does not churn diffs
  - bundled attachments
  - SHA-256 verification
  - dry-run import diff
  - pre-import backup
  - item-level preview
  - path relinking
- Verify/finish local file attachments for notes, tasks, and events:
  - image/file refs
  - app-owned attachment storage
  - download/copy actions
  - portable metadata
- Add local-pointer repair UI for broken attachment paths.
- Add ICS calendar import and watched ICS subscriptions:
  - import local `.ics` files into cached calendar writes or a read-only local calendar source
  - subscribe to user-configured `https://` / `webcal://` ICS URLs with refresh intervals and ETag/Last-Modified caching where available
  - parse RFC 5545 `VEVENT`, `RRULE`, `RDATE`, `EXDATE`, time zones, all-day events, cancellations, and updates
  - keep subscribed calendars read-only unless explicitly copied into HCB/Google
  - show refresh status, parse errors, stale feeds, and last successful sync in Settings/Diagnostics
  - avoid sending subscribed ICS data to Google unless the user explicitly imports/copies it
- Add local export/report flows that are still missing after current print support.

## 7. Security, native Mac integration, and release polish

- Verify/finish local cache encryption as an opt-in, data-safety-gated feature:
  - keep unencrypted SQLite as the default until encrypted-cache migration is proven by tests and manual recovery drills
  - evaluate `better-sqlite3-multiple-ciphers` against current Electron/Node/macOS packaging, maintenance, license, prebuild, and deprecation risk
  - prefer a SQLCipher-compatible cipher mode only if compatibility and long-term support are acceptable
  - store a random database key in macOS Keychain through the existing secret-store layer; keep key material outside SQLite and out of renderer IPC
  - do not encrypt a plaintext database in place; create a backup, checkpoint WAL, copy/export into a new encrypted database, verify, then atomically swap
  - run `PRAGMA integrity_check`, schema checks, row-count/hash checks, and app-level read smoke checks before deleting or archiving the plaintext original
  - retain rollback copies until the encrypted DB has opened successfully across restart and sync replay
  - support explicit decrypt/export recovery while the user still has Keychain access
  - document key-loss behavior clearly: encrypted cache is unrecoverable without the stored key, but Google source data can be re-synced after reconnect
  - do not ship the settings toggle until migration, downgrade, backup restore, corrupt-key, missing-Keychain, and interrupted-write tests pass
- Add sync mode selector:
  - manual
  - balanced
  - near-real-time
- Add past-event retention cutoff where `0` means keep forever.
- Add past-task/overdue cleanup behavior settings.
- Verify/finish in-app GitHub Releases update checker:
  - version compare
  - latest release state
  - recoverable network errors
  - manual download prompt
  - no silent insecure update
- Add native discovery helper for Spotlight, Raycast, and Alfred.
  - tiny Swift/ObjC helper packaged with the Electron app
  - index sanitized task/event/note/list titles into private on-device CoreSpotlight
  - route Spotlight results back through `hcb://task/...`, `hcb://event/...`, `hcb://note/...`, and `hcb://today`
  - keep bodies out of Spotlight by default; expose body indexing only behind an explicit privacy setting
  - add reindex/repair controls and diagnostics
  - add Raycast support via extension or script commands for search, today, quick capture, and open result
  - add Alfred workflow support with script filters/actions for search, today, quick capture, and open result
  - route Raycast/Alfred actions through `hcb://`, the CLI, or authenticated loopback MCP without exposing bearer tokens
- Add App Intents / Shortcuts helper.
  - expose App Shortcuts for Open Today, Quick Capture, What's Next, create task, create event, open task/event/note, and run saved search
  - route helper actions back into Electron through deep links, the CLI, MCP tools, or a hardened local IPC bridge
  - keep helper permissions narrow and avoid direct Google OAuth token access
- Add macOS Share Extension for quick capture.
  - accept selected text and URLs from host apps
  - create task or note drafts
  - prefer App Group drop file / queue if HCB is not running
  - optionally call authenticated loopback MCP only when server is enabled and reachable
  - sanitize shared input and surface failures without leaking source app data
- Verify dock badge behavior end to end if only settings exist.
- Add rich notification actions.
  - actions: Snooze 10m, Complete, Open
  - wire Snooze to `local_snooze_until`
  - wire Complete through existing task/event complete handlers and pending mutation queue
  - keep destructive actions confirmable where needed
  - support background handling when the window is closed
- Finish notification UX:
  - permission primer separate from onboarding if still absent
  - configurable lead times
  - task due-date notification defaults
  - event notification defaults
  - 64-notification cap behavior
  - reschedule diagnostics
- Add renderer History / Sync Issues window if diagnostics history is insufficient.
- Expand agent-native MCP, CLI, and local automation surface:
  - add `hcb_brief` read tool/resource returning one structured today summary with blocking tasks, overdue items, conflicts, suggested reorder, sync risk, and next events
  - populate `promptRegistry.ts` with curated parameterized prompts for day planning, inbox triage, week review, standup-note summaries, reschedule planning, duplicate review, and support/debug
  - add an in-app floating Pending agent action tray for queued `confirmationId`s, with approve/reject/expiry states and sanitized dry-run summaries
  - add `hcb tail` CLI for live sync/log/mutation state, polling first and SSE only if the MCP transport grows stream support
  - add `hcb plan` CLI that reads piped markdown, parses tasks/events/notes through shared NL parsing, previews candidates by default, and applies only with `--apply`
  - add opt-in loopback webhooks for local POSTs on planner events such as task created/completed, event starting, mutation failed, and sync completed
  - restrict webhook URLs to `127.0.0.1` / `localhost`, sign payloads with a local secret, rate-limit delivery, retry safely, and omit private bodies by default
  - keep all agent/CLI/webhook output redacted and context-budgeted
  - add tests for resource discovery, prompt discovery, prompt args, `hcb_brief` schema stability, confirmation tray approvals, `hcb tail`, `hcb plan`, and webhook validation/delivery
- Audit MCP tool catalogue parity with original:
  - exact tool names
  - aliases such as `hcb_today`, `hcb_week`, `hcb_search`, `hcb_create_task`
  - per-tool dry-run / confirm-write / allow-write modes
  - docs and tests

## 8. Performance, tests, and docs

- Add low-power-mode and constrained-network detection feeding sync backoff multipliers.
- Add large-account regression coverage:
  - 15k-event target
  - prepared event indexes/snapshots where still missing
  - startup and calendar navigation timings
- Run frontend reference pass before major visual work:
  - Apple Calendar
  - Notion Calendar
  - current HCB2 before screenshots
  - extract layout/density/navigation lessons only
  - do not copy branding, exact icons, copy, or proprietary artwork
- Maintain security posture:
  - no credential leaks
  - no weakened CSP
  - no remote code loading
  - no unsafe SQL/string query construction
  - no permission bypass
- Preserve Google Tasks/Calendar sync semantics and offline replay.
- Add focused tests for:
  - parsers
  - migrations
  - reducers/stores
  - IPC contracts
  - search/filter DSL
  - semantic embeddings/vector search
  - local LLM provider adapters
  - MCP conversational sidebar action approvals
  - keybindings
  - import/export verification
  - deterministic portable export diff stability
  - ICS import/subscription parsing and refresh
  - encryption
  - multi-account sync and mutation isolation
  - notification scheduling
  - calendar recurrence
  - extension sandboxing
- Add Playwright/manual QA for:
  - Today
  - Kanban/areas/tags
  - calendar views
  - advanced search/pinned filters
  - semantic search
  - local LLM summaries/plans
  - conversational planning sidebar
  - settings/customisation
  - import/export/attachments
  - git-friendly `.hcb2export` output
  - ICS imports/subscriptions
  - multi-account merged Today and per-account filters
  - update checker
  - Spotlight/Raycast/Alfred discovery
  - App Intents/Shortcuts
  - Share Extension
  - rich notification actions
  - pending agent action tray
  - `hcb tail` and `hcb plan`
  - loopback webhook delivery
  - share/intent flows where locally testable
- Each completed slice must report:
  - implemented items
  - deferred items with approved reason
  - commands run and results
  - manual QA evidence
  - migrations/data-safety notes
  - remaining risk

## 9. Ports last

Run only after Mac v1 work above is stable. Do not run Linux and Windows first-pass port work in parallel.

### Cross-platform adapter audit

- Identify Mac-only assumptions in paths, credentials, tray, menu, shortcuts, notifications, protocol, autostart, updater, diagnostics, OAuth, MCP, packaging, and tests.
- Refine shared adapter interfaces for platform capabilities.
- Expose capability-report DTOs through preload/settings where appropriate.
- Add adapter contract tests runnable without Linux or Windows.
- Keep platform-specific logic out of renderer components.
- Do not claim non-Mac support.

### Linux technical preview

- Implement Linux adapter implementations or stubs for:
  - app paths
  - Secret Service/libsecret credentials
  - tray/status area
  - global shortcuts
  - notifications
  - custom protocol
  - autostart
  - updater metadata
  - external open behavior
  - diagnostics
- Add capability detection for Secret Service, tray support, X11 vs Wayland, portal shortcuts, notifications, and protocol status.
- Add Linux settings/diagnostics status surfaces.
- Add Linux adapter tests, using mocks where not running on Linux.
- Package AppImage first.
- Add desktop metadata, icons, categories, keywords, and StartupWMClass.
- Add Linux install/run/uninstall docs, manual QA checklist, and performance smoke instructions.
- Do not enable plaintext credential fallback.
- Do not claim universal Linux parity.

### Windows technical preview

- Implement Windows adapter implementations or stubs for:
  - app paths
  - credential storage
  - tray
  - global shortcuts
  - notifications
  - custom protocol
  - autostart
  - updater metadata
  - external open behavior
  - diagnostics
- Add stable AppUserModelID/app identity wiring early in startup.
- Add Windows settings/diagnostics status surfaces for tray, shortcuts, notifications, protocol, updater, signing, and SmartScreen where known.
- Add Windows adapter tests, using mocks where not running on Windows.
- Package NSIS first.
- Add executable name, installer display name, Start Menu shortcut, protocol registration, and icon metadata.
- Add signing plan docs:
  - unsigned internal preview
  - Microsoft Store MSIX option
  - Azure Artifact Signing / Trusted Signing
  - OV certificate
  - self-signed dev-only behavior
- Add Windows install/run/uninstall docs, manual QA checklist, and performance smoke instructions.
- Do not claim public Windows readiness without signing and runtime QA.
- Do not commit certificates, passwords, tokens, or signing secrets.

### Cross-platform release hardening

- Audit adapters for duplicated logic, drift, unsafe fallbacks, and renderer platform branching.
- Verify capability reports are consistent in Settings and Diagnostics.
- Verify install/update/uninstall docs match actual package behavior.
- Verify performance smoke reports exist or are explicitly blocked per platform.
- Verify manual QA checklists exist for macOS, Linux, and Windows.
- Update roadmap/docs to distinguish supported, technical preview, and unsupported features by platform.
- Do not add new platform scope.
- Do not weaken security, credential storage, or MCP local-only guarantees to simplify a port.
