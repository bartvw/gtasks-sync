## Context

The sync loop in `global-sync-command.ts` reconciles each `#task` note against Google Tasks via `determineAction()`. That function classifies each note into one of: `create`, `update`, `recreate`, `mark-done`, or `skip`.

Currently the function uses two inputs to decide:
1. Whether the Google Task is in `activeTasks` or `completedTasks` (current Google state)
2. Whether the payload (built from local note) matches the remote task

It does not consult `gtask-status` — the last-synced Google status stored in the note's frontmatter. This means when a task was marked complete on Google and then un-completed, the sync sees "active in Google, local says done, payload differs" and pushes local → Google, resetting the task to completed.

`readSyncMeta()` already returns `gtaskStatus` and is called in the sync loop, so the value is available without any new I/O.

## Goals / Non-Goals

**Goals:**
- Use `gtask-status` as a three-way merge anchor to determine which side changed for the completion status field
- Pull from Google when Google changed, push to Google when local changed, no-op when neither or both changed
- Handle the missing `gtask-status` (null) case gracefully — fall back to existing behavior

**Non-Goals:**
- Three-way merge for non-status fields (title, due date, etc.) — those continue to be local-wins
- Conflict UI or user prompts
- Changes to the `gtask-status` schema or storage format

## Decisions

### Extend `determineAction()` with `gtaskStatus` parameter

`determineAction()` currently takes `taskId`, `frontmatter`, `activeTasks`, `completedTasks`, and `payload`. Add `gtaskStatus: 'needsAction' | 'completed' | null` as a parameter.

The decision table for the `activeTasks` branch (where the bug lives) becomes:

```
gtask-status  | Google now  | Local now  | Action
──────────────────────────────────────────────────
null          | needsAction | done       | update (push local → Google, existing fallback)
completed     | needsAction | done       | mark-undone (pull Google → local)  ← NEW
completed     | needsAction | not-done   | update gtask-status only           ← NEW (both changed, agree)
needsAction   | needsAction | done       | update (push local → Google)
needsAction   | needsAction | not-done   | skip
```

The `completedTasks` branch gains the symmetric "both changed" case:

```
gtask-status  | Google now  | Local now  | Action
──────────────────────────────────────────────────
null          | completed   | active     | mark-done (existing fallback)
needsAction   | completed   | active     | mark-done (pull Google → local)
needsAction   | completed   | done       | update gtask-status only           ← NEW (both changed, agree)
completed     | completed   | active     | mark-done (existing — shouldn't normally occur)
completed     | completed   | done       | skip
```

### Add `mark-undone` action

Add `'mark-undone'` to the `ReconcileAction` union. The handler writes `status: open` (or the vault's configured active status) and `gtask-status: needsAction` to the local note.

Alternatively: reuse `writeStatusSyncBack` pattern with a new `writeStatusUndone` helper in `frontmatter.ts`.

### Add `gtask-status-only` action (or inline it)

When both sides changed and agree, no remote or local write is needed — only `gtask-status` needs updating. Rather than a new action type, this can be handled as a `skip` with a `gtask-status` patch, or as a lightweight new action `'sync-meta'`. Using a distinct action keeps the action handler exhaustive and makes logging clearer.

### Fallback when `gtask-status` is null

Old notes may have no `gtask-status`. When `gtaskStatus` is null, treat it as unknown → fall back to existing behavior (local wins for active tasks, Google wins for completed tasks). This preserves backward compatibility.

## Risks / Trade-offs

- **Notes with stale/incorrect `gtask-status`**: If the field was manually edited or corrupted, the three-way merge could make wrong decisions. Mitigation: the field is only written by the sync engine, so manual edits are unlikely; no additional guard needed.
- **`mark-undone` status value**: Writing `status: open` may not match every vault's taxonomy. Mitigation: check what `writeStatusSyncBack` writes for `done` and use the inverse; or read the vault's configured status values. Investigate during implementation.
- **Log entries for new actions**: The change logger must handle `mark-undone` and `sync-meta` action types for accurate history. Add corresponding log entries in the action handlers.
