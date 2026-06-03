# Proposed Optimisations for HCB2 - July 2026

## 1. Defer `scheduleSuggest`

Current flow:

1. App starts.
2. Renderer calls startup IPC reads for tasks, calendars, events, notes, settings, sync status, Google status, and native capabilities.
3. Renderer waits for those reads.
4. Renderer then calls `calendar.scheduleSuggest`.
5. Initial core snapshot resolves.
6. UI renders the main app state.

Proposed flow:

1. App starts.
2. Renderer calls startup IPC reads.
3. Initial core snapshot resolves without waiting for `calendar.scheduleSuggest`.
4. UI renders calendar, tasks, and notes from local/cache data.
5. Renderer calls `calendar.scheduleSuggest` after first paint.
6. Today/schedule suggestion UI updates when the suggestion result returns.

Expected effect:

- Faster perceived startup because schedule suggestions stop blocking the first useful render.
- Calendar/tasks/notes can become usable before suggestions finish.

Tradeoffs:

- Today schedule suggestions may appear slightly later.
- The Today schedule area needs a stable loading/empty state while suggestions are pending.
- Tests that assume startup waits on `scheduleSuggest` would need updating.

## 2. Add one bootstrap IPC snapshot

Current flow:

1. App starts.
2. Renderer fans out multiple startup IPC calls:
   - `tasks.listTaskLists`
   - `tasks.list`
   - `calendar.listCalendars`
   - `calendar.listEvents`
   - `calendar.listScheduledTaskBlocks`
   - `notes.list`
   - `settings.get`
   - `sync.status`
   - `google.status`
   - `native.capabilities`
3. Renderer combines those responses into one frontend view-model source.

Proposed flow:

1. App starts.
2. Renderer calls one bootstrap IPC endpoint.
3. Main process reads the required SQLite/service state.
4. Main process returns one startup snapshot.
5. Renderer builds the view-model source from that snapshot.

Expected effect:

- Less IPC overhead during startup.
- Simpler startup ordering in the renderer.
- Potentially more consistent startup data because the backend can assemble one coherent snapshot.

Tradeoffs:

- Larger backend contract.
- Bigger blast radius if bootstrap snapshot shape changes.
- Paging/lazy range loading still needs to stay separate where full data loads would be too expensive.

## 3. Trigger near-immediate queue drain after CRUD

Current flow:

1. User creates, updates, or deletes a task/calendar item/note.
2. UI updates locally/optimistically.
3. Backend writes to SQLite.
4. Backend records a pending Google mutation.
5. Mutation is cleared later by the existing sync/queue worker timing.

Proposed flow:

1. User creates, updates, or deletes a task/calendar item/note.
2. UI updates locally/optimistically.
3. Backend writes to SQLite.
4. Backend records a pending Google mutation.
5. If Google is connected and sync is allowed, backend schedules a near-immediate queue drain.
6. Queue worker pushes pending mutations to Google sooner.
7. Pending counts clear sooner when the remote write succeeds.

Expected effect:

- Frontend still feels instant because local UI already updates immediately.
- Pending backend queue clears faster.
- Users see fewer long-lived pending sync states.

Tradeoffs:

- Must debounce/batch drains to avoid one Google request burst per click.
- Must respect offline mode, disconnected Google account state, and sync settings.
- Needs care around app quit/startup so queue drain does not fight existing load/exit sync behavior.
