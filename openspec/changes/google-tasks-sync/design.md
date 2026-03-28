## Context

This is a greenfield Obsidian plugin (gtasks-sync) built on top of the Obsidian sample plugin scaffold. The plugin integrates with the Google Tasks REST API to push task notes — managed by the TaskNotes community plugin — to Google Tasks.

TaskNotes stores task metadata in note frontmatter (title, due, status, etc.). Google Tasks has a limited data model: title, notes, due (date-only), and a binary status (needsAction/completed). The plugin maps between these two schemas and owns the sync lifecycle.

## Goals / Non-Goals

**Goals:**
- Push a single TaskNotes note to Google Tasks on demand via command palette
- Create a new Google Task on first push; update in place on subsequent pushes
- Move the task to a different list if the configured default list changes
- Authenticate with Google using the user's own OAuth 2.0 credentials (Client ID + Secret)
- Persist OAuth tokens securely using Obsidian's native `SecretStorage` API
- Store `gtask-id` and `gtask-list` in the note's frontmatter after a successful push

**Non-Goals:**
- Status sync back from Google Tasks to Obsidian (future)
- Bulk / global sync of all unsynced notes (future)
- Per-note list override via frontmatter (future)
- Deleted task handling (future)
- Mobile support — OAuth loopback requires a local HTTP server; desktop only

## Decisions

### D1: OAuth flow — loopback redirect with user-supplied credentials

**Decision:** Use Google's OAuth 2.0 "installed application" flow with a localhost redirect URI. Users supply their own Client ID and Client Secret from a Google Cloud project they create.

**Alternatives considered:**
- *Ship plugin credentials*: Credentials would be visible in source. Risky for abuse and against Google's terms for apps with broad user bases.
- *Hosted middleman service*: Adds infrastructure dependency, conflicts with offline-first design.

**Rationale:** Loopback redirect is the standard approach for installed desktop apps. A temporary `http.createServer()` listener on a random port (bound to 0) handles the OAuth callback, exchanges the code for tokens, then shuts down. Users follow a one-time setup in Google Cloud Console.

---

### D2: Token storage — Obsidian SecretStorage API

**Decision:** All sensitive values (Client Secret, access token, refresh token) are stored and retrieved via `this.app.secretStorage`, which delegates to the OS-level keychain (macOS Keychain, Windows Credential Manager, Linux libsecret). Non-sensitive values (Client ID, configured list name) are stored as plain JSON via `this.saveData()`.

The settings UI uses Obsidian's `SecretComponent` for secret input fields.

**Requires:** `minAppVersion` ≥ `1.11.4` (when `SecretStorage` was introduced).

**Alternatives considered:**
- *Plain `data.json`*: Tokens stored in cleartext. Unacceptable for OAuth credentials.
- *`electron.safeStorage` + base64 in `data.json`*: Works but bypasses the official API. More fragile and not idiomatic for Obsidian plugins.
- *OS keychain via `keytar`*: Native module, not available in Obsidian's plugin sandbox.

---

### D3: Frontmatter write strategy — Obsidian FileManager API

**Decision:** Use `app.fileManager.processFrontMatter()` to read and write frontmatter fields. This is the canonical Obsidian API for frontmatter mutation.

**Rationale:** Avoids manual YAML parsing/serialisation. Atomic, safe, and preserves existing frontmatter structure.

---

### D4: Field mapping

| TaskNotes frontmatter | Google Tasks field | Notes |
|-----------------------|--------------------|-------|
| `title` (or filename) | `title` | Filename used as fallback if no `title` field |
| `due` (YYYY-MM-DD) | `due` | Converted to RFC 3339 midnight UTC |
| `status` | `status` | `done`/`cancelled` → `completed`; anything else → `needsAction` |
| Obsidian URI | `notes` | `obsidian://open?vault=<name>&file=<path>` deep link |
| ← `id` | `gtask-id` | Written to frontmatter on create/move |
| ← list name | `gtask-list` | Written to frontmatter on create/move |

**Completed statuses (hardcoded):** `done`, `cancelled`

---

### D5: List move strategy — create then delete

**Decision:** Moving a task between lists is implemented as: create in new list → delete from old list → update frontmatter with new `gtask-id` and `gtask-list`.

**Rationale:** Google Tasks API has no native move operation. Creating first ensures the task is never lost if the delete step fails.

**Move trigger:** On sync, if `gtask-list` in the note's frontmatter differs from the plugin's configured default list, a move is performed.

---

### D6: Module structure

```
src/
  main.ts              # Plugin lifecycle, command registration
  settings.ts          # Settings interface, defaults, settings tab UI
  auth/
    oauth.ts           # OAuth flow, token acquisition and refresh
    token-store.ts     # Read/write tokens via app.secretStorage
  google-tasks/
    client.ts          # Google Tasks REST API wrapper (fetch-based)
    field-mapper.ts    # TaskNotes frontmatter ↔ Google Tasks field mapping
  sync/
    sync-command.ts    # "Sync current note" command handler
    frontmatter.ts     # Read/write gtask-id, gtask-list via FileManager API
  types.ts             # Shared TypeScript interfaces
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| OAuth loopback port conflict | Bind to port 0 (OS-assigned random port) and use it in the redirect URI |
| Google Tasks API rate limits | Surface clear error notices; no automatic retry in v1 |
| Frontmatter write race (note modified during sync) | `processFrontMatter` is atomic per Obsidian's guarantees |
| `SecretStorage` unavailable on some Linux setups (no libsecret) | Detect at startup; show a warning in settings and refuse to save credentials if unavailable |
| User loses Client ID/Secret | Tokens cannot be recovered; user must re-authenticate. Documented clearly in settings UI. |
