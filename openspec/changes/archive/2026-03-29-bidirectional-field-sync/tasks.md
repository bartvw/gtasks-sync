## 1. Remove Notes/URI Machinery

- [x] 1.1 Delete `buildObsidianUri` from `src/google-tasks/field-mapper.ts`
- [x] 1.2 Delete `extractBodyFromGoogleNotes` from `src/google-tasks/field-mapper.ts`
- [x] 1.3 Remove `notes` field from `buildTaskPayload` output (delete URI append logic)
- [x] 1.4 Delete `readNoteBody` from `src/sync/frontmatter.ts`
- [x] 1.5 Remove all `readNoteBody` call sites from `src/sync/global-sync-command.ts` (remote-body-preservation logic included)
- [x] 1.6 Remove `notes` from `taskMatchesPayload` comparison in `src/google-tasks/field-mapper.ts`
- [x] 1.7 Update or delete tests that assert on URI / notes field behaviour

## 2. Settings: Add Conflict Resolution

- [x] 2.1 Add `conflictResolution: 'google-wins' | 'local-wins'` to `PluginSettings` in `src/types.ts`, defaulting to `'google-wins'`
- [x] 2.2 Add default value for `conflictResolution` in the settings defaults in `src/settings.ts`
- [x] 2.3 Add a dropdown setting for conflict resolution in the settings UI (`src/settings.ts`)

## 3. Frontmatter: Sentinel Fields

- [x] 3.1 Add `gtaskTitle: string | null` and `gtaskDue: string | null` to the `SyncMeta` interface in `src/sync/frontmatter.ts`
- [x] 3.2 Update `readSyncMeta` to read `gtask-title` and `gtask-due` from frontmatter
- [x] 3.3 Update `writeSyncMeta` to write `gtask-title` and `gtask-due` alongside existing fields
- [x] 3.4 Add `writeTitleSyncBack(file, app, title)` function that writes `title` and `gtask-title` to frontmatter
- [x] 3.5 Add `writeDueSyncBack(file, app, due)` function that writes `due` and `gtask-due` to frontmatter
- [x] 3.6 Update frontmatter tests for the new sentinel fields

## 4. Field Mapper: resolveField Utility

- [x] 4.1 Add `resolveField<T>(local, google, lastSynced, strategy)` to `src/google-tasks/field-mapper.ts`, returning `{ action: 'push' | 'pull' | 'skip', value: T }`
- [x] 4.2 Handle null/absent sentinel case in `resolveField` (treat as equal to local — first-sync behaviour)
- [x] 4.3 Write unit tests for `resolveField` covering all six resolution cases (skip, push, pull, agree, conflict-google-wins, conflict-local-wins)
- [x] 4.4 Update `buildTaskPayload` signature to remove `noteBody` and `vaultName` parameters (no longer needed for create/recreate path)

## 5. Global Sync: Per-Field Update Path

- [x] 5.1 In the `update` action handler in `src/sync/global-sync-command.ts`, call `resolveField` for `title` and `due` using `syncMeta.gtaskTitle` / `syncMeta.gtaskDue` as sentinels
- [x] 5.2 Build the push payload using only fields whose resolution action is `push`; include `status` unconditionally if it differs
- [x] 5.3 Collect pull-back fields and write them to the note using `writeTitleSyncBack` / `writeDueSyncBack` before (or instead of) pushing
- [x] 5.4 Skip the Google API call entirely if the push payload is empty (all fields resolved to `pull` or `skip`) and status is unchanged
- [x] 5.5 Pass `plugin.settings.conflictResolution` to `resolveField` calls
- [x] 5.6 Update `create` and `recreate` paths to pass updated `writeSyncMeta` (which now writes `gtask-title` and `gtask-due`)
- [x] 5.7 Update global sync tests to cover pull-back scenarios, conflict resolution, and the empty-payload skip case

## 6. Single-Note Sync: Per-Field Update Path

- [x] 6.1 In the update branch of `src/sync/sync-command.ts`, apply `resolveField` for `title` and `due` after fetching the current Google Task
- [x] 6.2 Build push payload per-field and write pull-backs to the note
- [x] 6.3 Pass `plugin.settings.conflictResolution` to `resolveField` calls
- [x] 6.4 Update single-note sync tests to cover pull-back and conflict resolution scenarios

## 7. Verification

- [x] 7.1 Run full test suite (`npm test`) and fix any failures
- [x] 7.2 Manually verify: change a task's due date in Google Tasks → run sync → confirm note `due` frontmatter updated
- [x] 7.3 Manually verify: change title in both Obsidian and Google Tasks between syncs → confirm conflict resolution setting is respected
- [x] 7.4 Manually verify: existing notes with no `gtask-title`/`gtask-due` sentinels sync correctly on first run (push local values)
