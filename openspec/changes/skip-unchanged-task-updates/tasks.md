## 1. Comparison Helper

- [ ] 1.1 Add `taskMatchesPayload(task: GoogleTask, payload: Omit<GoogleTask, 'id'>): boolean` to `field-mapper.ts` — compare `title`, `status`, `notes`, and date portion of `due`
- [ ] 1.2 Add unit tests for `taskMatchesPayload` covering: all fields match, title differs, status differs, notes differs, due differs, one side missing due

## 2. Reconciliation Logic

- [ ] 2.1 Update `determineAction` in `global-sync-command.ts` to accept the pre-built payload as a parameter and the fetched `GoogleTask` from the active map
- [ ] 2.2 In the `activeTasks.has(taskId)` branch, call `taskMatchesPayload` — return `'skip'` if match, `'update'` if not
- [ ] 2.3 Update all call sites of `determineAction` to pass the payload (build payload before calling `determineAction`)

## 3. Tests

- [ ] 3.1 Update `global-sync-command.test.ts` — add test: task in active map with matching payload → `'skip'`
- [ ] 3.2 Add test: task in active map with differing title → `'update'`
- [ ] 3.3 Add test: task in active map with differing status → `'update'`
- [ ] 3.4 Add test: task in active map with differing due date → `'update'`
- [ ] 3.5 Ensure existing `'update'` scenario tests still pass (they should now pass a differing payload)
