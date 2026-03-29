## Context

The plugin's global sync processes vault notes and reconciles them with Google Tasks. It fetches all Google Tasks upfront into an in-memory map (`activeTasks`, `completedTasks`), then iterates over notes. Tasks that were never matched to a note — "orphans" — are currently ignored.

Separately, the `notes` field on Google Tasks has always been used exclusively for the Obsidian deeplink URI. This is a one-way convention that throws away any content a user may have written in the Google Tasks notes field, and also prevents Obsidian note body content from appearing in Google Tasks.

## Goals / Non-Goals

**Goals:**
- After the existing reconciliation loop, detect orphan active Google Tasks and create Obsidian notes for them in a configurable directory.
- Make the `notes` field bidirectional: note body → Google Tasks notes (with deeplink appended); Google Tasks notes → note body (deeplink written on next sync).
- Add three settings: `importFromGoogle.enabled`, `importFromGoogle.folder`, `importFromGoogle.defaultStatus`.
- Include imported-note count in dry-run summary.
- Log imports in the change log.

**Non-Goals:**
- Importing completed Google Tasks.
- Conflict resolution when the same task exists in multiple lists.
- Syncing subtasks (Google Tasks parent/child relationships).
- Immediate deeplink write-back to Google Tasks in the same run as import.

## Decisions

### 1. Orphan detection via a "seen" set

During the existing reconciliation loop, each note that has a `gtask-id` matching a task in the fetched map will mark that task ID as "seen". After the loop, `activeTasks.keys() - seen` = orphan IDs.

**Why this over a two-pass scan:** The task map is already in memory. A seen-set is O(n) with zero extra API calls.

### 2. Lazy deeplink write-back (next sync)

When a note is created from an orphan task, the Obsidian file path isn't known until after the note is written. Rather than immediately calling `updateTask()` to append the deeplink, we let the next global sync handle it — the note is now in the vault, tagged `#task`, and has `gtask-id`, so it will be picked up and the `notes` field updated normally.

**Alternative considered:** Immediately update Google Tasks in the same run. Rejected: adds API calls per imported note, complicates the import path, and the deeplink is available within one sync cycle anyway.

### 3. Notes field is now body + deeplink

`buildTaskPayload()` will be updated to construct the `notes` field as:

```
<note body content>\n\nobsidian://open?vault=...&file=...
```

If the note has no body, the field is just the deeplink (current behavior).

For the import direction: the Google Task's `notes` field content (stripped of any existing Obsidian deeplink suffix) becomes the Obsidian note body. The deeplink is not yet present; it's written on the next sync.

**Why include notes in `taskMatchesPayload()`:** Now that the notes field carries real content, drift between note body and Google Tasks notes needs to be detected and resolved on sync.

### 4. Filename sanitization and collision handling

Task title → filename: strip characters invalid on common filesystems (`/ : * ? " < > | \`), trim whitespace, fall back to `"untitled"` if the result is empty.

Collision: if `<title>.md` already exists in the target folder, try `<title> 2.md`, `<title> 3.md`, etc. The `title` frontmatter field always holds the original task title regardless of the filename chosen.

### 5. Import is gated on settings

`importFromGoogle.enabled` defaults to `false`. The import pass is skipped entirely if disabled or if `importFromGoogle.folder` is empty. The settings UI will show a validation message if the toggle is turned on without a folder configured.

### 6. Default status for imported notes

`importFromGoogle.defaultStatus` (default: `"open"`) is written as the `status` frontmatter field on created notes. This maps to `needsAction` in Google Tasks, keeping the note and task in sync from the first subsequent push.

## Risks / Trade-offs

**Notes field update causes bulk updates on first run after upgrade**
→ All existing synced notes will have their Google Tasks `notes` field updated on the first sync after the upgrade (because `taskMatchesPayload()` now compares notes and the content has changed). This is expected and correct behavior, not data loss, but it will generate many "updated" log entries. Users should be aware.

**Google Tasks notes field character limit (~8192 chars)**
→ Long note bodies will be silently truncated by the API. Accepted trade-off; no mitigation planned for now.

**Import folder may not exist**
→ The plugin will attempt to create the folder using Obsidian's `app.vault.createFolder()` if it doesn't exist.

**Orphan detection requires `gtask-id` to be set**
→ Notes that were synced before `gtask-id` was introduced (or where frontmatter was manually cleared) will cause their Google Task to appear as an orphan and a duplicate note may be created. This is an edge case; no special handling planned.

## Migration Plan

No data migration needed. The change is additive for the import feature. The notes field change is a behavioral upgrade that takes effect automatically on the next sync. No rollback steps required — disabling the plugin restores the previous state of all files.

## Open Questions

- None. All decisions were resolved in the exploration phase.
