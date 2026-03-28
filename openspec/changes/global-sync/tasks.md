## 1. Fetch All Tasks Helper

- [x] 1.1 Add `fetchAllTasks(listId)` to the API client that calls `tasks.list` with `showCompleted=true` and `showHidden=true`, paginates via `nextPageToken`, and returns a `Map<string, Task>` of task ID → task object
- [x] 1.2 Add rate-limit handling to all API calls: on 429 response, read `Retry-After` header and wait that duration; if absent, retry with exponential backoff starting at 1 second

## 2. Single-Note Sync: GET Before Push

- [x] 2.1 Update single-note sync to discover the task note via `#task` tag instead of current detection logic
- [x] 2.2 On push when note has a `gtask-id`: fetch the current task from Google Tasks before making any changes
- [x] 2.3 Compare fetched task status against stored `gtask-status` frontmatter field: if task is `completed` and `gtask-status` is `needsAction`, write `status: done` and `gtask-status: completed` to frontmatter and skip the push
- [x] 2.4 Otherwise push local state to Google Tasks as before
- [x] 2.5 After every successful create or update, write `gtask-status` to frontmatter reflecting the resulting Google Tasks status (`needsAction` or `completed`)
- [x] 2.6 Handle API errors during fetch or update: show error notice and leave frontmatter unchanged

## 3. Global Sync: Command and Note Discovery

- [x] 3.1 Register a "Global Sync to Google Tasks" command in the command palette (available regardless of active file)
- [x] 3.2 On command trigger, use the Obsidian metadata cache to collect all markdown notes tagged `#task`
- [x] 3.3 If no task notes are found, show a notice and exit without opening a modal

## 4. Global Sync: Reconciliation Logic

- [x] 4.1 Before processing any notes, call `fetchAllTasks` to build a complete in-memory map of all Google Tasks; abort with an error notice if the fetch fails
- [x] 4.2 Split the task map into an active map and a completed map for reconciliation lookups
- [x] 4.3 Implement reconciliation logic per note:
  - No `gtask-id`, status active → create new task
  - No `gtask-id`, status done/cancelled → skip
  - `gtask-id` in active map → update existing task
  - `gtask-id` in completed map, note active → write `status: done` to frontmatter (status sync back), do not push
  - `gtask-id` in completed map, note done/cancelled → skip
  - `gtask-id` not found in either map, note active → recreate (create new task, update `gtask-id`, `gtask-list`, `gtask-status`)
  - `gtask-id` not found in either map, note done/cancelled → skip
- [x] 4.4 After each successful create, update, or recreate, write `gtask-status` to the note's frontmatter

## 5. Global Sync: Progress Modal

- [x] 5.1 Create a `SyncProgressModal` class that displays current progress ("N / M"), total note count, and a cancel button
- [x] 5.2 Open the modal when global sync starts; update progress count after each note is processed
- [x] 5.3 Implement cancellation: when the user clicks cancel, set a flag that stops processing after the current note completes
- [x] 5.4 After sync completes (or is cancelled), show a failure summary listing failed notes with filenames and error reasons, or a success message with total processed count

## 6. Global Sync: Dry-Run Mode

- [x] 6.1 Add a dry-run option to the global sync command (e.g., a separate "Dry Run: Global Sync to Google Tasks" command or a prompt before executing)
- [x] 6.2 In dry-run mode, execute the full reconciliation logic including fetching all tasks, but skip all write API calls and frontmatter modifications
- [x] 6.3 Display a summary showing per-action counts: would create, would update, would recreate, would mark done, would skip
- [x] 6.4 In the dry-run summary modal, include a "Run sync" button that immediately executes the actual sync without re-scanning the vault
