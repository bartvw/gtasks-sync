## Why

Users with existing vaults need a way to sync all task notes to Google Tasks at once, and to keep them in sync as tasks evolve on either side. The current single-note push command doesn't scale to onboarding or ongoing reconciliation.

## What Changes

- New command: "Global Sync" that reconciles all `#task`-tagged notes with Google Tasks
- Full resync logic: create (active notes only), update, recreate deleted tasks, and sync completed status back to notes
- New `gtask-status` frontmatter field to track last known Google Tasks status per note
- Dry-run mode to preview what would change before committing
- Progress modal with cancellation support and failure summary
- Single-note sync command updated to use `#task` tag as the task note signal (replacing `status` field check) and to perform status sync back using `gtask-status`

## Capabilities

### New Capabilities
- `global-sync`: Vault-wide reconciliation command that finds all `#task`-tagged notes and syncs them with Google Tasks, including create (skipped if note is already done/cancelled), update, recreate, and status sync back

### Modified Capabilities
- `task-push`: Discovery signal changes from `status` frontmatter field to `#task` tag; adds status sync back using `gtask-status` field
- `list-management`: Pull-then-compare strategy introduced for global sync (fetch all active tasks at once before processing)

## Impact

- `src/sync/sync-command.ts`: Update task note detection to use `#task` tag; add GET-then-push flow with `gtask-status` comparison
- `src/sync/frontmatter.ts`: Add `gtask-status` to sync meta read/write
- New `src/sync/global-sync-command.ts`: Global sync orchestration, progress modal, dry-run mode
- Google Tasks API: `tasks.list` with `showCompleted` + `showHidden` for full task set; 429 handling with `Retry-After` backoff
