## 1. Extend Action Types and Frontmatter

- [x] 1.1 Add `'mark-undone'` and `'sync-meta'` to the `ReconcileAction` union in `global-sync-command.ts`
- [x] 1.2 Add `writeStatusUndone()` to `frontmatter.ts` that writes `status: open` and `gtask-status: needsAction`
- [x] 1.3 Add `writeGtaskStatusOnly()` to `frontmatter.ts` that writes only `gtask-status` (used for the both-sides-changed case)

## 2. Update determineAction()

- [x] 2.1 Add `gtaskStatus: 'needsAction' | 'completed' | null` parameter to `determineAction()`
- [x] 2.2 In the `activeTasks` branch: if `gtaskStatus === 'completed'` and note is done → return `'mark-undone'`
- [x] 2.3 In the `activeTasks` branch: if `gtaskStatus === 'completed'` and note is active → return `'sync-meta'` (both changed, agree on needsAction)
- [x] 2.4 In the `completedTasks` branch: if `gtaskStatus === 'needsAction'` and note is done → return `'sync-meta'` (both changed, agree on completed)
- [x] 2.5 Pass `gtaskStatus` from the call site in the sync loop (already available from `readSyncMeta()`)

## 3. Add Action Handlers in Sync Loop

- [x] 3.1 Add handler for `'mark-undone'`: call `writeStatusUndone()` and log the action
- [x] 3.2 Add handler for `'sync-meta'`: call `writeGtaskStatusOnly()` with the current Google status and log the action
- [x] 3.3 Update the dry-run summary counts to include `mark-undone` and `sync-meta`

## 4. Tests

- [x] 4.1 Add unit test: task un-completed in Google (active), note is done → `mark-undone` action, local note updated
- [x] 4.2 Add unit test: task un-completed in Google (active), note is already active → `sync-meta` action, only `gtask-status` updated
- [x] 4.3 Add unit test: task completed in Google, note is already done, `gtask-status` was `needsAction` → `sync-meta` action, only `gtask-status` updated
- [x] 4.4 Add unit test: `gtask-status` is null, task is active in Google, note is done → falls back to `update` (existing behavior)
