## Why

The plugin currently syncs Obsidian notes to Google Tasks, but tasks created directly in Google Tasks have no path back into the vault. Users who create or receive tasks in Google Tasks must manually create Obsidian notes for them, breaking the workflow.

## What Changes

- During global sync, Google Tasks not matched to any vault note are identified as "orphans" and imported as new Obsidian notes in a configurable directory.
- Only active (`needsAction`) tasks are imported; completed tasks are ignored.
- Imported notes are tagged with `#task` and populated with title, due date, status, and sync metadata frontmatter so subsequent syncs treat them as normal task notes.
- The Google Tasks `notes` field now carries note body content + the Obsidian deeplink (instead of just the deeplink). **BREAKING**: this changes what the plugin writes to the `notes` field for all synced tasks, and notes is now included in change-detection comparisons.
- Three new settings control the import feature: `importFromGoogle.enabled`, `importFromGoogle.folder`, and `importFromGoogle.defaultStatus`.
- Dry-run mode shows a count of tasks that would be imported.

## Capabilities

### New Capabilities
- `google-task-import`: Discovering orphan Google Tasks and creating corresponding Obsidian notes during global sync, including filename collision handling and configurable destination folder.

### Modified Capabilities
- `task-push`: The `notes` field on Google Tasks now carries note body content + deeplink rather than just the deeplink. Notes is included in `taskMatchesPayload()` comparisons.
- `global-sync`: Orphan detection pass added after the existing reconciliation loop; dry-run includes import counts; new settings added.

## Impact

- `src/sync/global-sync-command.ts`: Orphan detection pass, note creation logic, dry-run count, new settings consumption.
- `src/google-tasks/field-mapper.ts`: `buildTaskPayload()` updated to include note body; `taskMatchesPayload()` now compares notes field.
- `src/settings.ts`: Three new settings fields + UI controls.
- `src/sync/change-logger.ts`: New log entry type for imported notes.
- `src/sync/frontmatter.ts`: Utility to write full frontmatter for a newly created note.
- All existing synced tasks will have their Google Tasks `notes` field updated on first sync after upgrade (expected, not a data-loss risk).
