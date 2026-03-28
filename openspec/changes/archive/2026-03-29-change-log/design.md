## Context

The plugin currently shows transient `Notice` toasts after each sync operation but writes nothing durable. Users have no way to audit what changed, when, or why. Both sync paths (per-note `sync-command.ts` and vault-wide `global-sync-command.ts`) perform create/update/delete operations independently, so the logger must be usable from both.

The vault is the natural home for persistent data — it is already versioned (if the user uses git), searchable in Obsidian, and writable via `app.vault`.

## Goals / Non-Goals

**Goals:**
- Append a human-readable Markdown log entry to a vault file after every sync run (single-note or global).
- Record per entry: timestamp, direction (Obsidian→Google or Google→Obsidian), operation, wikilink to the synced note, list name.
- For **update** operations, record the specific fields that changed (title, due date, status, notes) with old → new values.
- Allow users to enable/disable logging and configure the log file path.

**Non-Goals:**
- Log file rotation, size limits, or archival.
- Structured/machine-readable formats (JSON, CSV).
- Logging authentication or configuration events.
- Real-time streaming — one append per sync run is sufficient.

## Decisions

### 1. Log format: Markdown bullet list, grouped by run

Each sync run appends a heading with a timestamp and a bulleted list of changes beneath it. Each entry links to the relevant note via Obsidian wikilink syntax. Update entries include an indented sub-list of changed fields.

```
### 2024-03-15 14:32:01

- ✅ Created in Google Tasks | [[Buy milk]] | list: My Tasks
- 🔄 Updated in Google Tasks | [[Doctor appointment]] | list: Work
  - title: "Doctor" → "Doctor appointment"
  - due: — → 2024-03-20
- ⬇️ Updated from Google Tasks | [[Weekly review]] | list: My Tasks
  - status: needsAction → completed
- 🗑️ Deleted from Google Tasks | [[Old task]] | list: My Tasks
```

**Why**: Sub-bullets for field-level changes keep the entry scannable at a glance while still providing detail on demand. Wikilinks make each entry clickable so users can jump to the task note.

**Alternatives considered**:
- *Inline diff string*: hard to read for multiple changed fields.
- *Markdown table*: harder to append line-by-line; cell escaping issues with arrow characters.

### 2. Change detection for updates

Before writing a log entry for an update, the logger compares the before/after values of: `title`, `due`, `status`, `notes`. Only fields that actually differ are listed. If no fields differ (e.g. the skip-unchanged guard already filtered it), no entry is written.

**Why**: "Updated — (nothing changed)" would be confusing; skipping empty diffs keeps the log meaningful.

### 3. Integration point: `ChangeLogger` service class

A new `src/sync/change-logger.ts` module exports a `ChangeLogger` class. Both `sync-command.ts` and `global-sync-command.ts` instantiate (or receive) a logger, call `logger.record(entry)` for each operation, then call `logger.flush(app)` once at the end of the run to append all entries atomically.

**Why**: Collecting entries in memory and writing once avoids repeated vault I/O and keeps each sync command's logic unchanged except for the record/flush calls.

### 4. Settings: `changeLog.enabled` and `changeLog.path`

Added to `PluginSettings` in `types.ts`. Default: enabled, path `gtasks-sync-log.md` (vault root).

**Why**: Some users may not want a log file, or may want it inside a folder (e.g., `_meta/gtasks-log.md`).

### 5. Append-only writes via `app.vault`

Use `app.vault.adapter.read` + `app.vault.adapter.write` to append. If the file does not exist, create it with a Markdown header comment.

**Why**: Obsidian's `vault.append` API does not exist in older API versions; read-append-write is more portable and safe.

## Risks / Trade-offs

- [Race condition on concurrent syncs] → Mitigated by flush-at-end pattern (single write per run) and the fact that Obsidian is single-user.
- [Log file grows unbounded] → Accepted for now; out of scope to add rotation. Users can delete or archive manually.
- [Log file path conflicts] → If the user sets a path that matches an existing note, the log will be appended to it. Document this in settings UI.
- [Wikilink target ambiguity] → Links use the note's base filename (no path). Obsidian resolves shortest unambiguous path, which matches its default link behaviour.
- [Before-state availability] → For per-note sync, the before-state must be captured before the API call. For global sync, the fetched remote task serves as before-state.

## Migration Plan

- No migration needed: feature is additive. Defaults to **enabled** so users immediately benefit.
- Existing users see a new `gtasks-sync-log.md` appear in their vault root after first sync.
- No breaking changes to existing settings shape — new keys are added with defaults.
