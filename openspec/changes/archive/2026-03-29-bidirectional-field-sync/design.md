## Context

The plugin syncs Obsidian `#task` notes to Google Tasks. Currently, `title`, `due`, and `notes` are pushed one-way: local frontmatter is always authoritative. The `status` field already supports bidirectional sync via a `gtask-status` sentinel in frontmatter that records the last-known Google value, allowing change detection per side.

This change extends that sentinel pattern to `title` and `due`, removes the `notes`/URI machinery entirely, and introduces a conflict resolution setting for when both sides change a field between syncs.

## Goals / Non-Goals

**Goals:**
- Detect per-field changes on both sides using frontmatter sentinels
- Pull Google changes into the note for `title` and `due`
- Push local changes to Google for `title` and `due`
- Apply a user-configurable conflict resolution strategy when both sides changed a field
- Remove the Obsidian URI append / notes sync entirely

**Non-Goals:**
- Bidirectional sync for `notes` / note body content
- Per-field conflict resolution strategies (one strategy applies to all fields)
- Sync of other Google Task fields (e.g., `parent`, `position`, subtasks)

## Decisions

### 1. Sentinel pattern for `title` and `due`

**Decision**: Add `gtask-title` and `gtask-due` frontmatter fields, written after every sync alongside the existing `gtask-status`.

**Rationale**: Mirrors the proven `gtask-status` pattern. Keeps all sync state co-located in the note's frontmatter. No external store needed.

**Alternative considered**: Timestamp-based last-write-wins (compare modification times). Rejected because Google Tasks API timestamps are not granular enough to reliably distinguish sync-triggered writes from user edits, and Obsidian file modification times are updated by the plugin itself during sync.

---

### 2. Per-field `resolveField` utility

**Decision**: Introduce a single generic `resolveField<T>(local, google, lastSynced, strategy)` function that returns `{ action: 'push' | 'pull' | 'skip', value: T }`.

Resolution matrix:

| local vs lastSynced | google vs lastSynced | action |
|---|---|---|
| same | same | skip |
| changed | same | push |
| same | changed | pull |
| changed (same new value) | changed (same new value) | pull (agree) |
| changed | changed (different) | apply strategy → push or pull |

**Rationale**: Eliminates repeated field-specific logic. Easily testable in isolation. Adding a new tracked field in the future is a one-line call.

---

### 3. Payload built field-by-field, not from full local frontmatter

**Decision**: The `update` path no longer calls `buildTaskPayload` (which takes everything from local). Instead, for each field it calls `resolveField` and only includes fields with action `push` in the Google API payload. Fields with action `pull` are written back to the note.

**Rationale**: Prevents local values from overwriting Google changes. `buildTaskPayload` is still used for `create` and `recreate` actions (where there is no prior sync state to compare against).

---

### 4. Single global conflict resolution setting

**Decision**: One `conflictResolution: 'google-wins' | 'local-wins'` setting in `PluginSettings`, applied uniformly to `title` and `due`.

**Rationale**: Per-field settings were considered during exploration but rejected: the user confirmed a single strategy suffices and avoids settings surface complexity.

---

### 5. Remove notes/URI machinery entirely

**Decision**: Delete `buildObsidianUri`, `extractBodyFromGoogleNotes`, and `readNoteBody`. Remove `notes` from push payloads. The Google Tasks `notes` field becomes unmanaged by the plugin.

**Rationale**: The URI was a convenience for jumping from Google Tasks to Obsidian, but it creates coupling and complicates sync logic. Removing it simplifies the payload, eliminates the note-body read on every sync, and removes a class of edge cases (e.g., preserving remote body when local body is empty).

**Trade-off**: Users who relied on the Obsidian URI in Google Tasks lose that link. This is a breaking change documented in the proposal.

## Risks / Trade-offs

**Existing notes have stale sentinels** → On first sync after upgrade, `gtask-title` and `gtask-due` will be absent. The `resolveField` function treats a missing sentinel (null/undefined) as "no prior sync", which causes both local and Google values to be treated as potentially changed. Mitigation: treat null `lastSynced` as "same as local" so the first sync after upgrade pushes local values to Google (preserving current behavior for the first run).

**Partial payload update** → If only `due` changed on Google, only `due` is pulled back; `title` is untouched. This is correct but requires that the Google API accepts partial payloads on update. It does — the Tasks API PATCH endpoint merges fields.

**Breaking change for notes** → Any existing Obsidian URI links in Google Tasks `notes` will no longer be maintained. Noted in proposal.

## Migration Plan

No data migration required. The new `gtask-title` and `gtask-due` fields are written on the next sync. Until then, their absence is handled gracefully by treating null sentinel as "same as local" (see Risks above).

The `conflictResolution` setting defaults to `google-wins` and requires no user action.
