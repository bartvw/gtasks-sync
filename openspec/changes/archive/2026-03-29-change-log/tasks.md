## 1. Types and Settings

- [x] 1.1 Add `changeLog: { enabled: boolean; path: string }` to `PluginSettings` in `src/types.ts`
- [x] 1.2 Add default values (`enabled: true`, `path: 'gtasks-sync-log.md'`) to `DEFAULT_SETTINGS` in `src/settings.ts`
- [x] 1.3 Add settings UI controls (toggle + text field) for change log in `GTasksSettingTab.display()`

## 2. ChangeLogger Service

- [x] 2.1 Create `src/sync/change-logger.ts` with a `ChangeEntry` type covering: timestamp, direction (`'to-google' | 'from-google'`), operation (`'created' | 'updated' | 'deleted'`), noteWikilink, listName, and optional `fieldChanges` array
- [x] 2.2 Implement `ChangeLogger` class with `record(entry: ChangeEntry): void` and `flush(app: App, path: string): Promise<void>` methods
- [x] 2.3 In `flush`, group all recorded entries under a single `### <timestamp>` heading and format update entries with indented field-change sub-bullets
- [x] 2.4 In `flush`, read existing file content (or empty string if absent) and append the new block, then write back via `app.vault.adapter.write`
- [x] 2.5 Skip `flush` entirely if no entries were recorded (do not create an empty-run heading)

## 3. Integration: Per-Note Sync

- [x] 3.1 In `sync-command.ts`, instantiate a `ChangeLogger` at the start of the sync handler (if logging enabled)
- [x] 3.2 Capture before-state of the task payload before each API call (for update diff)
- [x] 3.3 Call `logger.record(...)` after each successful create, update, or delete operation
- [x] 3.4 Call `logger.flush(app, settings.changeLog.path)` at the end of the handler

## 4. Integration: Global Sync

- [x] 4.1 In `global-sync-command.ts`, instantiate a `ChangeLogger` at the start of the run (if logging enabled)
- [x] 4.2 Record field-level diff for `update` actions using the fetched remote task as before-state
- [x] 4.3 Call `logger.record(...)` for each processed note with a non-skip action
- [x] 4.4 Call `logger.flush(app, settings.changeLog.path)` after `modal.showSummary()`

## 5. Tests

- [x] 5.1 Unit-test `ChangeLogger.record` + `flush`: verify Markdown output format for create, update (with field changes), and delete entries
- [x] 5.2 Test that `flush` skips file write when no entries recorded
- [x] 5.3 Test that `flush` appends to existing file content rather than overwriting
- [x] 5.4 Test that update entries omit field-change sub-bullets when no fields differ
