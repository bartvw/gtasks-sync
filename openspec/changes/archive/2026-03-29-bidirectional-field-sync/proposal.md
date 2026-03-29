## Why

The plugin currently treats Obsidian as the single source of truth for `title` and `due`: any edits made in Google Tasks are silently overwritten on the next sync. Users who update tasks on mobile or via Google's interfaces lose those changes.

## What Changes

- Add `gtask-title` and `gtask-due` frontmatter sentinels to track the last-synced value for each field, mirroring the existing `gtask-status` pattern
- The `update` sync path resolves each field independently: push to Google if local changed, pull to note if Google changed, apply conflict strategy if both changed
- Add a single `conflictResolution` setting (`google-wins` | `local-wins`, default `google-wins`) that applies to all fields
- **BREAKING**: Remove all notes/URI machinery — the plugin no longer writes an Obsidian URI to Google Tasks `notes`, nor reads or syncs note body content in any direction

## Capabilities

### New Capabilities
- `bidirectional-field-sync`: Per-field conflict detection and resolution for `title` and `due` using frontmatter sentinels; configurable conflict resolution strategy

### Modified Capabilities
- `task-push`: Payload no longer includes `notes` field; `title` and `due` are now conditionally included based on per-field resolution rather than always taken from local frontmatter
- `global-sync`: Update path restructured to handle per-field pull-backs (writing Google values to note frontmatter) in addition to push

## Impact

- `src/google-tasks/field-mapper.ts` — remove `buildObsidianUri`, `extractBodyFromGoogleNotes`; rewrite `buildTaskPayload` and `taskMatchesPayload`
- `src/sync/frontmatter.ts` — extend `SyncMeta` and `writeSyncMeta` with `gtask-title` and `gtask-due`; add `writeTitleSyncBack` and `writeDueSyncBack`
- `src/sync/global-sync-command.ts` — restructure `update` action to use per-field resolution; remove `readNoteBody` usage and remote-body-preservation logic
- `src/types.ts` — add `conflictResolution` to `PluginSettings`
- `src/settings.ts` — add conflict resolution UI setting
