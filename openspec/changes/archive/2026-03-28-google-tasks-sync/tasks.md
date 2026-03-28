## 1. Project Setup

- [x] 1.1 Update `manifest.json`: set `isDesktopOnly: true` and `minAppVersion` to `1.11.4`
- [x] 1.2 Update `versions.json` to map `1.0.0` → `1.11.4`
- [x] 1.3 Create `src/types.ts` with shared interfaces (`PluginSettings`, `GoogleTask`, `TokenData`, `SyncResult`)
- [x] 1.4 Remove all sample boilerplate from `src/main.ts` and `src/settings.ts`

## 2. Settings

- [x] 2.1 Define `PluginSettings` interface and `DEFAULT_SETTINGS` in `src/settings.ts` (Client ID, default list name)
- [x] 2.2 Build the settings tab UI skeleton with sections for Google credentials, tasklist, and connection status
- [x] 2.3 Add `SecretComponent` input for Client Secret (stored via `app.secretStorage`)
- [x] 2.4 Add plain text input for Client ID (stored via `plugin.saveData()`)
- [x] 2.5 Add plain text input for default Google Tasks list name
- [x] 2.6 Add "Connect Google Account" button and "Disconnect" button with connected/disconnected state display

## 3. Token Storage

- [x] 3.1 Create `src/auth/token-store.ts` with `saveTokens(app, tokens)`, `loadTokens(app)`, and `clearTokens(app)` using `app.secretStorage`
- [x] 3.2 Write unit tests for token store (mock `app.secretStorage`)

## 4. OAuth Flow

- [x] 4.1 Create `src/auth/oauth.ts` with `buildAuthUrl(clientId, redirectUri)` that constructs the Google OAuth consent URL with the Tasks read/write scope
- [x] 4.2 Implement `startLoopbackServer()`: bind an HTTP server to port 0, return the assigned port and a promise that resolves with the authorization code
- [x] 4.3 Implement `exchangeCodeForTokens(code, clientId, clientSecret, redirectUri)`: POST to Google token endpoint, return access token, refresh token, and expiry
- [x] 4.4 Implement `refreshAccessToken(refreshToken, clientId, clientSecret)`: POST to token endpoint with `grant_type=refresh_token`
- [x] 4.5 Wire "Connect Google Account" button to: start loopback server → open browser → await code → exchange for tokens → save via token store → update UI
- [x] 4.6 Wire "Disconnect" button to `clearTokens()`
- [x] 4.7 Write unit tests for `buildAuthUrl`, `exchangeCodeForTokens`, and `refreshAccessToken` (mock fetch)

## 5. Google Tasks API Client

- [x] 5.1 Create `src/google-tasks/client.ts` with `getAccessToken(app, settings)` that loads tokens and refreshes if expired (using `refreshAccessToken`)
- [x] 5.2 Implement `listTasklists(accessToken)`: GET `/tasks/v1/users/@me/lists`
- [x] 5.3 Implement `resolveListId(accessToken, listName)`: calls `listTasklists` and returns the matching list ID, throws if not found
- [x] 5.4 Implement `createTask(accessToken, listId, task)`: POST `/tasks/v1/lists/{listId}/tasks`
- [x] 5.5 Implement `updateTask(accessToken, listId, taskId, task)`: PUT `/tasks/v1/lists/{listId}/tasks/{taskId}`
- [x] 5.6 Implement `deleteTask(accessToken, listId, taskId)`: DELETE `/tasks/v1/lists/{listId}/tasks/{taskId}`
- [x] 5.7 Write unit tests for each client method (mock fetch)

## 6. Field Mapper

- [x] 6.1 Create `src/google-tasks/field-mapper.ts` with `buildObsidianUri(vaultName, filePath)` that returns a properly URL-encoded `obsidian://open` URI
- [x] 6.2 Implement `mapStatusToGoogle(status)`: returns `"completed"` for `done`/`cancelled`, `"needsAction"` otherwise
- [x] 6.3 Implement `mapDueToGoogle(due)`: converts YYYY-MM-DD to RFC 3339 midnight UTC string; returns `undefined` if input is absent
- [x] 6.4 Implement `buildTaskPayload(frontmatter, file, vaultName)`: assembles the full Google Tasks task body from a note's frontmatter and file metadata
- [x] 6.5 Write unit tests for all mapper functions

## 7. Frontmatter Read/Write

- [x] 7.1 Create `src/sync/frontmatter.ts` with `readSyncMeta(file, app)`: reads `gtask-id` and `gtask-list` from a note's frontmatter via `MetadataCache`
- [x] 7.2 Implement `writeSyncMeta(file, app, taskId, listName)`: writes `gtask-id` and `gtask-list` to frontmatter via `app.fileManager.processFrontMatter()`
- [x] 7.3 Write unit tests for frontmatter read/write (mock Obsidian APIs)

## 8. Sync Command

- [x] 8.1 Create `src/sync/sync-command.ts` with `runSyncCommand(plugin)` orchestrating the full sync flow:
  1. Get active file; abort with notice if none or no `status` frontmatter field
  2. Ensure authenticated (get/refresh access token); abort with notice if not
  3. Resolve list ID from configured list name; abort with notice if not found
  4. Read `gtask-id` and `gtask-list` from frontmatter
  5. Build task payload from frontmatter + field mapper
  6. If no `gtask-id`: create task → write `gtask-id` and `gtask-list` to frontmatter
  7. If `gtask-list` differs from configured list: move (create in new → delete from old → update frontmatter)
  8. Otherwise: update existing task
  9. Display success or error notice
- [x] 8.2 Write unit tests for `runSyncCommand` covering first push, update, move, and error scenarios

## 9. Wiring

- [x] 9.1 Register the "Sync current note to Google Tasks" command in `src/main.ts` with a `checkCallback` that checks for an active markdown file with a `status` frontmatter field
- [x] 9.2 Wire settings tab into `main.ts` via `addSettingTab`
- [x] 9.3 Load settings and tokens on plugin load; verify `app.secretStorage` availability and show a warning notice if unavailable

## 10. Integration Tests

- [x] 10.1 Set up integration test infrastructure: a test vault directory and a minimal Obsidian `App` stub that uses the real file system
- [x] 10.2 Write integration test for frontmatter read/write: create a real `.md` file, call `writeSyncMeta`, then read back with `readSyncMeta` and assert values match
- [x] 10.3 Write integration test for the Google Tasks API client against the live API (requires test credentials in environment variables): create a task, update it, delete it, assert responses
- [x] 10.4 Write integration test for the full sync command flow against the live Google Tasks API: push a note, verify the task appears in Google Tasks, re-push, verify it is updated
- [x] 10.5 Ensure integration tests are excluded from the default test run and documented in README (require `GTASKS_CLIENT_ID`, `GTASKS_CLIENT_SECRET`, `GTASKS_REFRESH_TOKEN` env vars)

## 11. Build & Manual Testing

- [x] 11.1 Run `npm run build` and resolve any TypeScript errors
- [x] 11.2 Install plugin in a dedicated development vault and test first push (new task created, frontmatter updated)
- [x] 11.3 Test subsequent push (existing task updated)
- [x] 11.4 Test list move (change default list, re-sync, verify task moved)
- [x] 11.5 Test OAuth error path (invalid credentials)
- [x] 11.6 Test with a note that has no `title` field (filename fallback)
- [x] 11.7 Test with a note that has no `due` field (field omitted)

