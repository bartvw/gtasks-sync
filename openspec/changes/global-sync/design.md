## Context

The plugin currently syncs one note at a time via a command palette action. Users with existing vaults need a way to bring all task notes into sync at once, and to keep them reconciled as tasks are completed or deleted on either side. The sync architecture must handle a potentially large number of notes efficiently without hammering the Google Tasks API.

Task notes are identified by the `#task` tag. Synced notes carry `gtask-id` and `gtask-list` frontmatter fields.

## Goals / Non-Goals

**Goals:**
- Vault-wide reconciliation: create (active notes only), update, recreate, and sync status back for all `#task` notes
- Dry-run mode to preview changes before executing
- Progress modal with cancellation and failure summary
- Status sync back on single-note push as well as global sync
- Align single-note sync discovery to `#task` tag

**Non-Goals:**
- Pulling new tasks created in Google Tasks into the vault (separate roadmap item)
- Conflict resolution beyond the completed-status case (e.g., title edited on both sides)
- Syncing notes that are not tagged `#task`

## Decisions

### Pull-then-compare for global sync
**Decision**: Fetch all tasks from Google Tasks up front into two maps (active, completed), then iterate vault notes against those maps.

**Alternatives considered**:
- *Per-note GET*: One API call per synced note to check existence. Simple but expensive — 500 notes = 500 GETs before any updates.
- *Optimistic update (PATCH, handle 404)*: Try update, treat 404 as deleted. Cheaper on happy path but can't distinguish deleted from completed without a second call.

**Why pull-then-compare**: Reduces API calls from O(N) checks + O(N) updates to O(pages) + O(changes). Also gives us the full Google Tasks state in one shot, enabling status sync back without extra calls.

**`showCompleted=true` + `showHidden=true`**: Required to distinguish "task was deleted" from "task was completed". Without this, completed tasks are invisible and look deleted.

---

### `gtask-status` frontmatter field for conflict detection
**Decision**: Write the last known Google Tasks status (`needsAction` or `completed`) to the note frontmatter as `gtask-status` on every sync.

**Alternatives considered**:
- *`gtask-synced-at` timestamp*: Compare note mtime and Google's `updated` field against a sync timestamp. More general, but mtime is unreliable (frontmatter writes touch mtime) and adds complexity.
- *No tracking, always prefer Google*: Simpler, but means a user pushing an active note that was previously completed in Google would have the note silently marked done, ignoring local intent.

**Why `gtask-status`**: Minimal footprint. Exactly encodes what we need: did the Google status change since we last looked? If `gtask-status: needsAction` and Google now returns `completed`, it was completed remotely — sync back. If `gtask-status: completed`, the completion was already known — local state wins.

---

### Single-note sync: GET before push
**Decision**: For notes with an existing `gtask-id`, fetch the current task from Google before pushing, compare status against `gtask-status`.

**Why**: Without checking first, a user running single-note sync on an active note would overwrite a remotely-completed task. The `gtask-status` field makes the check cheap (one GET, one compare).

---

### Rate limiting: 429 + Retry-After + exponential backoff
**Decision**: On 429 responses, read the `Retry-After` header and wait that duration before retrying. If no header, use exponential backoff starting at 1s.

**Why**: Google Tasks API quota is 500 req/100s. A large vault sync can approach this. Handling 429s correctly ensures the sync completes rather than failing halfway.

---

### Modal UX with dry-run
**Decision**: Global sync runs in a modal showing a live progress bar, note count, and a cancel button. Dry-run skips all writes and shows a plan summary with a "Run sync" button to execute immediately.

**Why dry-run**: Large vaults may have unexpected notes tagged `#task`. Previewing the plan before committing prevents unwanted creates or status overwrites.

---

### Skip create for completed notes with no gtask-id
**Decision**: If a note has no `gtask-id` and its status is done or cancelled, skip it — do not create a task in Google Tasks.

**Why**: Creating a task only to immediately mark it completed serves no purpose. These are notes that were completed entirely within Obsidian before ever being synced. Silently skipping them keeps Google Tasks clean.

## Risks / Trade-offs

- **Completed task volume**: `showCompleted=true` may return a large number of tasks for long-time users. Memory usage is bounded by the task list size, not the vault size. Accepted trade-off for correctness.
- **`gtask-status` field proliferation**: Every synced note gets an extra frontmatter field. Minor vault noise; no functional impact.
- **Single-note sync latency**: Adding a GET before push adds one round-trip. Noticeable on slow connections but necessary for correct conflict detection.
- **Cancellation mid-sync**: Partially synced vaults are valid states — already-processed notes are synced, remaining notes are not. No rollback mechanism; user can re-run to finish.
