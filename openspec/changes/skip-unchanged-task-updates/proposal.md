## Why

Global sync always pushes an update to Google Tasks for every previously-synced active note, even when nothing has changed. This causes unnecessary API calls, inflates quota usage, and makes dry-run output misleading (everything shows as "would update").

## What Changes

- `determineAction` returns `'skip'` instead of `'update'` when the fetched Google Task already matches the local note's payload
- A comparison function checks `title`, `status`, `notes`, and `due` (date portion only) between the local payload and the remote task

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `global-sync`: The reconciliation logic gains a new skip condition — when a task's `gtask-id` is found in the active tasks map AND the local payload matches the remote task, the note is skipped rather than updated.

## Impact

- `src/sync/global-sync-command.ts`: `determineAction` and the update branch
- `src/google-tasks/field-mapper.ts`: may need a comparison helper
- No API changes, no new dependencies
- Dry-run counts will change: previously-inflated "would update" count will drop to reflect only genuine changes
