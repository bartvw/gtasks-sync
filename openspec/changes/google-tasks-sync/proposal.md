## Why

Task notes in Obsidian exist in isolation from the tools users actually act on tasks from. Syncing them to Google Tasks makes Obsidian the authoritative place to define and manage tasks while keeping them visible and actionable in Google's ecosystem.

## What Changes

- New command in the command palette: **Sync current note to Google Tasks**
- On first sync, a task is created in Google Tasks and the resulting task ID and list name are written back to the note's frontmatter (`gtask-id`, `gtask-list`)
- On subsequent syncs, the existing task is updated; if the configured default list has changed, the task is moved to the new list
- New plugin settings: Google OAuth credentials (Client ID, Client Secret), default Google Tasks list, and OAuth token storage
- OAuth 2.0 flow using the user's own Google Cloud project credentials (loopback redirect)

## Capabilities

### New Capabilities

- `google-auth`: OAuth 2.0 authentication with Google using user-provided Client ID and Secret; token acquisition, storage, and refresh
- `task-push`: Read a TaskNotes note's frontmatter and push it to Google Tasks (create or update); write `gtask-id` and `gtask-list` back to frontmatter
- `list-management`: Resolve which Google Tasks list to use from the global default setting; move a task between lists when the configured list changes

### Modified Capabilities

## Impact

- New dependency: Google Tasks REST API (via `fetch`)
- New dependency: OAuth 2.0 loopback redirect flow (temporary local HTTP server during auth)
- Reads and writes note frontmatter (requires Obsidian `FileManager` / `MetadataCache` APIs)
- New plugin settings persisted via `this.saveData()`
- No changes to existing Obsidian plugin lifecycle or existing source files beyond `main.ts` wiring
