## Why

When a Google Task's completion status is changed on the Google side after a sync, the next sync incorrectly pushes the local (stale) status back to Google instead of pulling the new Google state into Obsidian. The `gtask-status` frontmatter field — which records the last synced state — exists precisely to detect this, but is not consulted during conflict resolution.

## What Changes

- `determineAction()` now uses `gtask-status` as a three-way merge anchor for the status field
- If only Google changed (local matches `gtask-status`, Google doesn't) → pull Google → update local note
- If only local changed (Google matches `gtask-status`, local doesn't) → push local → update Google (existing behavior)
- If both changed (binary field, so they agree) → update `gtask-status` only, no remote/local write needed
- If neither changed → skip (existing behavior)

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `global-sync`: The conflict resolution logic for task completion status changes to use `gtask-status` as a last-synced anchor for three-way merge decisions.

## Impact

- `src/sync/global-sync-command.ts` — `determineAction()` needs access to `gtask-status` from frontmatter and must implement the new decision table
- `src/sync/frontmatter.ts` — `gtask-status` is already read; no schema changes needed
- No API changes, no new dependencies
