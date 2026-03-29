# Capability: global-sync

## Purpose

Reconciles all `#task`-tagged notes in the vault with Google Tasks in a single operation, including discovery, reconciliation logic, progress feedback, dry-run mode, and failure reporting.

## Requirements

### Requirement: User can trigger a global sync command
The plugin SHALL register a command "Global Sync to Google Tasks" in the command palette that reconciles all `#task`-tagged notes in the vault with Google Tasks.

#### Scenario: Command is available
- **WHEN** the user opens the command palette
- **THEN** the command "Global Sync to Google Tasks" is available regardless of which file is active

---

### Requirement: Plugin discovers all task notes in the vault
The plugin SHALL use the Obsidian metadata cache to find all markdown notes tagged with `#task` as the set of notes to reconcile.

#### Scenario: Vault contains task notes
- **WHEN** the global sync command is triggered
- **THEN** all markdown notes with a `#task` tag are included in the sync set

#### Scenario: Vault contains no task notes
- **WHEN** the global sync command is triggered and no notes have a `#task` tag
- **THEN** the plugin displays a notice that no task notes were found and exits

---

### Requirement: Plugin fetches all Google Tasks for reconciliation
Before processing any notes, the plugin SHALL fetch all tasks (active, completed, and hidden) from the configured Google Tasks list using `tasks.list` with `showCompleted=true` and `showHidden=true`, building a map of task IDs to task objects.

#### Scenario: Tasks are fetched successfully
- **WHEN** global sync begins
- **THEN** the plugin fetches all tasks from the configured list and builds an in-memory map of task IDs before processing any notes

#### Scenario: Fetch spans multiple pages
- **WHEN** the Google Tasks list returns a `nextPageToken`
- **THEN** the plugin fetches all subsequent pages until the full task set is loaded

#### Scenario: List fetch fails
- **WHEN** the Google Tasks API returns an error during the initial fetch
- **THEN** the plugin aborts the sync, displays an error notice, and does not modify any notes

---

### Requirement: Plugin reconciles each task note with Google Tasks
For each `#task`-tagged note, the plugin SHALL determine the correct action using the following logic:
- No `gtask-id` and note status is active: create a new task
- No `gtask-id` and note status is done or cancelled: skip
- `gtask-id` found in active tasks map:
  - If `gtask-status` is `completed` (Google un-completed the task since last sync):
    - Note status is active: update `gtask-status` to `needsAction` only (both sides agree — neither needs a write)
    - Note status is done or cancelled: write `status: open` and `gtask-status: needsAction` to the note's frontmatter (status un-done sync back); do not push to Google Tasks
  - Otherwise (no last-synced state, or last-synced state matches Google):
    - Apply per-field resolution for `title` and `due` using sentinel values
    - If all fields resolve to `skip` and status is unchanged: skip (no API call)
    - If any field resolves to `push` or status differs: update the existing task with the push-resolved fields
    - If any field resolves to `pull`: write those field values back to the note's frontmatter
- `gtask-id` found in completed tasks map:
  - If `gtask-status` is `needsAction` (Google completed the task since last sync) and note status is done or cancelled: update `gtask-status` to `completed` only (both sides agree — neither needs a write)
  - Note status is active: write `status: done` to the note's frontmatter (status sync back); do not push to Google Tasks
  - Note status is done or cancelled: skip
- `gtask-id` not found in either map and note status is active: recreate (create new task, update `gtask-id`, `gtask-list`, `gtask-title`, `gtask-due`)
- `gtask-id` not found in either map and note status is done or cancelled: skip

The payload comparison for skip/update decisions SHALL compare `title`, `status`, and the date portion (first 10 characters) of `due`. The `notes` field is no longer included in comparison or payloads.

During the loop, the plugin SHALL record the `gtask-id` of every task successfully matched to a vault note in a "seen" set. This set is used by the subsequent import pass to identify orphan tasks.

After each successful create, update, or recreate, the plugin SHALL write `gtask-status`, `gtask-title`, and `gtask-due` to the note's frontmatter.

#### Scenario: Note has never been synced and is active
- **WHEN** a `#task` note has no `gtask-id` frontmatter field and its status is not done or cancelled
- **THEN** a new task is created in Google Tasks and `gtask-id`, `gtask-list`, `gtask-status`, `gtask-title`, and `gtask-due` are written to the note

#### Scenario: Note has never been synced and is already completed
- **WHEN** a `#task` note has no `gtask-id` frontmatter field and its status is done or cancelled
- **THEN** the note is skipped without any API calls or frontmatter changes

#### Scenario: Note is already synced and all fields are unchanged
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map and per-field resolution returns skip for all tracked fields and status is unchanged
- **THEN** the note is skipped without any API calls or frontmatter changes

#### Scenario: Google changed the title since last sync
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map and the Google Task title differs from `gtask-title` and the local title matches `gtask-title`
- **THEN** the Google title is written to the note's `title` frontmatter, `gtask-title` is updated, and no title is included in the push payload

#### Scenario: Google changed the due date since last sync
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map and the Google Task due date differs from `gtask-due` and the local due date matches `gtask-due`
- **THEN** the Google due date is written to the note's `due` frontmatter, `gtask-due` is updated, and no due date is included in the push payload

#### Scenario: Local changed title and Google did not
- **WHEN** a `#task` note's local title differs from `gtask-title` and the Google Task title matches `gtask-title`
- **THEN** the local title is pushed to Google Tasks and `gtask-title` is updated

#### Scenario: Both sides changed title — google-wins
- **WHEN** both local and Google titles differ from `gtask-title`, they are not equal, and `conflictResolution` is `google-wins`
- **THEN** the Google title is written to the note; the local title is not pushed to Google

#### Scenario: Task was completed in Google Tasks but note is still active
- **WHEN** a `#task` note's `gtask-id` is found in the completed tasks map and the note's status is not done or cancelled
- **THEN** `status: done` is written to the note's frontmatter and `gtask-status` is updated to `completed`

#### Scenario: Task was un-completed in Google Tasks but note is still done
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map and `gtask-status` is `completed` and the note's status is done or cancelled
- **THEN** `status: open` is written to the note's frontmatter and `gtask-status` is updated to `needsAction`

#### Scenario: Task and note were both un-completed since last sync
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map and `gtask-status` is `completed` and the note's status is active
- **THEN** only `gtask-status` is updated to `needsAction`; no API call is made and no other frontmatter field is changed

#### Scenario: Task and note were both completed since last sync
- **WHEN** a `#task` note's `gtask-id` is found in the completed tasks map and `gtask-status` is `needsAction` and the note's status is done or cancelled
- **THEN** only `gtask-status` is updated to `completed`; no API call is made and no other frontmatter field is changed

#### Scenario: Task was deleted from Google Tasks and note is still active
- **WHEN** a `#task` note's `gtask-id` is not found in either map and the note's status is not done or cancelled
- **THEN** a new task is recreated in Google Tasks and `gtask-id`, `gtask-list`, `gtask-status`, `gtask-title`, and `gtask-due` are updated in the note

#### Scenario: Note and task are both done
- **WHEN** a `#task` note is done or cancelled and its `gtask-id` is in the completed tasks map or not found in either map
- **THEN** the note is skipped without any API calls or frontmatter changes

#### Scenario: Matched task IDs are tracked for orphan detection
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map
- **THEN** that task ID is added to the seen set regardless of whether the note is updated or skipped

---

### Requirement: Plugin handles API rate limiting during global sync
The plugin SHALL handle HTTP 429 responses from the Google Tasks API by waiting for the duration specified in the `Retry-After` response header (or using exponential backoff starting at 1 second if the header is absent) before retrying the request.

#### Scenario: API returns 429 with Retry-After header
- **WHEN** a Google Tasks API call returns a 429 response with a `Retry-After` header
- **THEN** the plugin pauses for the indicated duration and retries the request

#### Scenario: API returns 429 without Retry-After header
- **WHEN** a Google Tasks API call returns a 429 response without a `Retry-After` header
- **THEN** the plugin retries with exponential backoff starting at 1 second

---

### Requirement: Plugin shows a progress modal during global sync
The plugin SHALL display a modal while global sync is running that shows the number of notes processed, total notes to process, and a cancel button.

#### Scenario: Sync is in progress
- **WHEN** global sync is running
- **THEN** a modal is visible showing current progress (e.g. "23 / 150") and a cancel button

#### Scenario: User cancels mid-sync
- **WHEN** the user clicks the cancel button in the progress modal
- **THEN** the sync stops after completing the current note, and already-processed notes remain synced

---

### Requirement: Plugin supports a dry-run mode for global sync
When dry-run mode is selected, the plugin SHALL execute the full reconciliation logic (including fetching all tasks from Google) but SHALL NOT make any write API calls or modify any note frontmatter. Instead it SHALL display a summary of what would change.

When `importFromGoogle.enabled` is `true`, the dry-run summary SHALL also include the count of orphan active tasks that would be imported as new notes.

#### Scenario: Dry-run shows plan
- **WHEN** the user triggers global sync in dry-run mode
- **THEN** the plugin displays a summary showing counts per action (would create, would update, would recreate, would mark done, would skip) without making any changes

#### Scenario: Dry-run shows import count when import is enabled
- **WHEN** dry-run mode is active and `importFromGoogle.enabled` is `true` and orphan active tasks exist
- **THEN** the summary includes a "would import" count for those tasks

#### Scenario: Dry-run offers immediate execution
- **WHEN** the dry-run summary is shown
- **THEN** a "Run sync" button is available that executes the actual sync immediately without re-scanning

---

### Requirement: Plugin shows a failure summary after global sync
After a global sync completes (or is cancelled), the plugin SHALL display a summary listing any notes that failed to sync, along with the reason for each failure. Notes that were skipped or successfully synced are not included.

#### Scenario: Some notes failed
- **WHEN** global sync completes and one or more notes encountered errors
- **THEN** the modal shows a list of failed notes with their filenames and error reasons

#### Scenario: All notes synced successfully
- **WHEN** global sync completes with no errors
- **THEN** the modal shows a success message with the total count of notes processed

---

### Requirement: Plugin settings include import-from-Google configuration
The plugin settings SHALL include three fields controlling the import feature:
- `importFromGoogle.enabled` (boolean, default `false`): toggles the import pass on/off
- `importFromGoogle.folder` (string, default `""`): vault-relative path to the folder where imported notes are created; required when `enabled` is `true`
- `importFromGoogle.defaultStatus` (string, default `"open"`): the `status` frontmatter value written to newly imported notes

The settings UI SHALL display a validation message if `importFromGoogle.enabled` is `true` and `importFromGoogle.folder` is empty.

#### Scenario: Import is disabled by default
- **WHEN** the plugin is installed without any prior configuration
- **THEN** `importFromGoogle.enabled` is `false`, `importFromGoogle.folder` is `""`, and `importFromGoogle.defaultStatus` is `"open"`

#### Scenario: Import enabled without folder configured
- **WHEN** the user enables `importFromGoogle.enabled` without setting a folder
- **THEN** the settings UI displays a validation message indicating the folder is required

#### Scenario: All import settings are configured
- **WHEN** `importFromGoogle.enabled` is `true`, `importFromGoogle.folder` is a non-empty string, and `importFromGoogle.defaultStatus` is set
- **THEN** the import pass runs during global sync using those values
