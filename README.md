# Google Tasks Sync

An Obsidian plugin that syncs [TaskNotes](https://obsidian.md/plugins?id=obsidian-task-notes) task notes to Google Tasks.

## Features

- **Command: Sync current note to Google Tasks** — syncs the active note; first push creates a task, subsequent pushes update it in place.
- **Command: Global Sync** — vault-wide reconciliation; discovers all `#task` notes and syncs them to Google Tasks in one run with a progress modal.
- **Command: Dry Run** — previews what Global Sync would do (create / update / mark done / skip) without making any changes.
- Changing the default list moves the task to the new list automatically.
- **Bidirectional field sync** — tracks `title` and `due` per-field using sentinel values; pulls Google-side changes back to the note and pushes local changes to Google, with configurable conflict resolution when both sides changed.
- Skips API calls when no tracked fields have changed since the last sync.
- **Change log** — appends a human-readable Markdown log of every sync operation (creates, updates, deletes) to a configurable vault file after each run.
- OAuth 2.0 authentication using your own Google Cloud credentials (desktop only).
- Tokens stored securely in the OS keychain via Obsidian's `SecretStorage` API.

## Requirements

- Obsidian 1.11.4 or later (desktop only)
- A Google Cloud project with the Tasks API enabled

## Setup

1. Create a Google Cloud project and enable the **Google Tasks API**.
2. Create an OAuth 2.0 **Desktop app** client ID and note the Client ID and Client Secret.
3. In Obsidian → Settings → Google Tasks Sync, enter your Client ID and Client Secret.
4. Click **Connect Google Account** and complete the sign-in flow.
5. Enter the name of the Google Tasks list you want to sync to.

## Settings

| Setting | Default | Description |
|---|---|---|
| Client ID | — | OAuth 2.0 Client ID from your Google Cloud project |
| Client Secret | — | OAuth 2.0 Client Secret (stored in OS keychain) |
| Default list name | — | Name of the Google Tasks list to sync to |
| Enable change log | on | Append a log of every sync operation to a vault file |
| Log file path | `gtasks-sync-log.md` | Vault-relative path for the change log |
| Conflict resolution | `google-wins` | When both the note and Google changed the same field since the last sync: `google-wins` uses Google's value, `local-wins` uses the note's value |

### Change log format

Each sync run appends a timestamped block to the log file:

```
### 2024-03-15 14:32:01

- ✅ Created in Google Tasks | [[Buy milk]] | list: My Tasks
- 🔄 Updated in Google Tasks | [[Doctor appointment]] | list: Work
  - title: "Doctor" → "Doctor appointment"
  - due: — → 2024-03-20
- ⬇️ Updated from Google Tasks | [[Weekly review]] | list: My Tasks
  - status: needsAction → completed
```

## How sync works

Global Sync reconciles each `#task` note against Google Tasks using a simple set of rules. The plugin fetches **all** tasks from Google (active and completed) before processing any notes, then decides what to do for each note based on its current state and the last-known state recorded in frontmatter (`gtask-status`, `gtask-title`, `gtask-due`).

### Decision table

| Note state                           | Google state | Last synced as (`gtask-status`)      | Action                                                           |
| ------------------------------------ | ------------ | ------------------------------------ | ---------------------------------------------------------------- |
| No `gtask-id`, active                | —            | —                                    | **Create** new task in Google                                    |
| No `gtask-id`, done/cancelled        | —            | —                                    | Skip                                                             |
| `gtask-id` in active map             | active       | `needsAction` (or no prior sync)     | Apply **per-field resolution** for `title`/`due` (see below); push local changes, pull Google changes, or skip if all unchanged |
| `gtask-id` in active map             | active       | `completed` (Google un-completed it) | Note still done → **mark note undone** (`status: open`)          |
| `gtask-id` in active map             | active       | `completed` (Google un-completed it) | Note already active → **sync meta** (update `gtask-status` only) |
| `gtask-id` in completed map          | completed    | `needsAction` (both just completed)  | **Sync meta** (update `gtask-status` only)                       |
| `gtask-id` in completed map          | completed    | `completed` (or no prior sync)       | Note still active → **mark note done** (`status: done`)          |
| `gtask-id` in completed map          | completed    | any                                  | Note already done → Skip                                         |
| `gtask-id` not found, active         | deleted      | —                                    | **Recreate** task in Google                                      |
| `gtask-id` not found, done/cancelled | deleted      | —                                    | Skip                                                             |

### Key concepts

- **`gtask-status` frontmatter field** — written after every sync to record what Google's status was at the time. This lets the plugin detect *changes on the Google side* between syncs.
- **`gtask-title` / `gtask-due` sentinel fields** — written after every create, update, or recreate to record the `title` and `due` values acknowledged by Google at the time. Used by per-field resolution to detect which side changed each field since the last sync.
- **Mark note undone** — when a task is un-completed in Google (moved back to the active list) but the note is still marked done, the plugin writes `status: open` to the note so both sides agree.
- **Sync meta** — when both sides independently made the same change (e.g. both completed), only `gtask-status` is updated to reflect the new agreed state. No API call to Google is needed.
- **Payload comparison** — before updating Google, the plugin compares `title`, `status`, and `due` (date portion only). If nothing changed, the note is skipped to avoid redundant API calls.

### Per-field bidirectional sync

For each tracked field (`title`, `due`), the plugin compares the local value, the Google value, and the last-synced sentinel to decide what to do:

| Local vs sentinel | Google vs sentinel | Action |
|---|---|---|
| Unchanged | Unchanged | **Skip** — no change on either side |
| Changed | Unchanged | **Push** — include local value in the Google API payload |
| Unchanged | Changed | **Pull** — write Google value to note frontmatter |
| Changed to same value | Changed to same value | **Pull** — both sides agree; write shared value to note, no API call |
| Changed to different value | Changed to different value | **Conflict** — resolved by the `conflictResolution` setting |

When a note has a `gtask-id` but no sentinel (first sync after upgrade), the current local value is treated as the sentinel, so the first sync behaves as a push.

## Development

```sh
npm install
npm run dev       # watch mode
npm run build     # production build
npm test          # unit tests
npm run lint      # lint
```

To install manually in a vault, copy `main.js`, `manifest.json`, and `styles.css` to `<vault>/.obsidian/plugins/gtasks-sync/`.

### Integration Tests

Integration tests require live Google credentials and are excluded from the default test run.

**Required environment variables:**

| Variable | Description |
|---|---|
| `GTASKS_CLIENT_ID` | OAuth 2.0 Client ID |
| `GTASKS_CLIENT_SECRET` | OAuth 2.0 Client Secret |
| `GTASKS_REFRESH_TOKEN` | A valid refresh token |
| `GTASKS_LIST_NAME` | Target list name (default: `My Tasks`) |

**Run integration tests:**

```sh
GTASKS_CLIENT_ID=... GTASKS_CLIENT_SECRET=... GTASKS_REFRESH_TOKEN=... \
  npx vitest run src/integration/ --reporter=verbose
```

### Releasing

1. Update `minAppVersion` in `manifest.json` if needed.
2. Run `npm version patch|minor|major` — bumps versions and stages `manifest.json` and `versions.json`.
3. Create a GitHub release tagged with the version number and attach `main.js`, `manifest.json`, and `styles.css`.
