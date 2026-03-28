# Google Tasks Sync

An Obsidian plugin that syncs [TaskNotes](https://obsidian.md/plugins?id=obsidian-task-notes) task notes to Google Tasks.

## Features

- **Command: Sync current note to Google Tasks** — available on any note with a `status` frontmatter field.
- First push creates a new Google Task; subsequent pushes update it in place.
- Changing the default list moves the task to the new list automatically.
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
