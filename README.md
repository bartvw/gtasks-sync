# Google Tasks Sync

An Obsidian plugin that syncs [TaskNotes](https://obsidian.md/plugins?id=obsidian-task-notes) task notes to Google Tasks.

## Features

- **Command: Sync current note to Google Tasks** — syncs the active note; first push creates a task, subsequent pushes update it in place.
- **Command: Global Sync** — vault-wide reconciliation; discovers all `#task` notes and syncs them to Google Tasks in one run with a progress modal.
- **Command: Dry Run** — previews what Global Sync would do (create / update / mark done / skip) without making any changes.
- Changing the default list moves the task to the new list automatically.
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

Global Sync reconciles each `#task` note against Google Tasks using a simple set of rules. The plugin fetches **all** tasks from Google (active and completed) before processing any notes, then decides what to do for each note based on its current state and the last-known state recorded in frontmatter (`gtask-status`).

### Decision table

| Note state | Google state | Last synced as (`gtask-status`) | Action |
|---|---|---|---|
| No `gtask-id`, active | — | — | **Create** new task in Google |
| No `gtask-id`, done/cancelled | — | — | Skip |
| `gtask-id` in active map | active | `needsAction` (or no prior sync) | **Update** Google if payload changed, otherwise skip |
| `gtask-id` in active map | active | `completed` (Google un-completed it) | Note still done → **mark note undone** (`status: open`) |
| `gtask-id` in active map | active | `completed` (Google un-completed it) | Note already active → **sync meta** (update `gtask-status` only) |
| `gtask-id` in completed map | completed | `needsAction` (both just completed) | **Sync meta** (update `gtask-status` only) |
| `gtask-id` in completed map | completed | `completed` (or no prior sync) | Note still active → **mark note done** (`status: done`) |
| `gtask-id` in completed map | completed | any | Note already done → Skip |
| `gtask-id` not found, active | deleted | — | **Recreate** task in Google |
| `gtask-id` not found, done/cancelled | deleted | — | Skip |

### Key concepts

- **`gtask-status` frontmatter field** — written after every sync to record what Google's status was at the time. This lets the plugin detect *changes on the Google side* between syncs.
- **Mark note undone** — when a task is un-completed in Google (moved back to the active list) but the note is still marked done, the plugin writes `status: open` to the note so both sides agree.
- **Sync meta** — when both sides independently made the same change (e.g. both completed), only `gtask-status` is updated to reflect the new agreed state. No API call to Google is needed.
- **Payload comparison** — before updating Google, the plugin compares `title`, `status`, `notes`, and `due` (date portion only). If nothing changed, the note is skipped to avoid redundant API calls.

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
