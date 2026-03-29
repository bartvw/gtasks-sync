## MODIFIED Requirements

### Requirement: Plugin reconciles each task note with Google Tasks
For each `#task`-tagged note, the plugin SHALL determine the correct action using the following logic:
- No `gtask-id` and note status is active: create a new task
- No `gtask-id` and note status is done or cancelled: skip
- `gtask-id` found in active tasks map and local payload matches remote task: skip
- `gtask-id` found in active tasks map and local payload differs from remote task: update the existing task
- `gtask-id` found in completed tasks map and note status is active: write `status: done` to the note's frontmatter (status sync back); do not push to Google Tasks
- `gtask-id` found in completed tasks map and note status is done or cancelled: skip
- `gtask-id` not found in either map and note status is active: recreate (create new task, update `gtask-id` and `gtask-list`)
- `gtask-id` not found in either map and note status is done or cancelled: skip

The payload comparison SHALL compare `title`, `status`, `notes`, and the date portion (first 10 characters) of `due`. If the remote task has no `due` and the local payload has no `due`, they are considered equal on that field.

During the loop, the plugin SHALL record the `gtask-id` of every task successfully matched to a vault note in a "seen" set. This set is used by the subsequent import pass to identify orphan tasks.

After each successful create, update, or recreate, the plugin SHALL write `gtask-status` to the note's frontmatter reflecting the resulting Google Tasks status.

#### Scenario: Note has never been synced and is active
- **WHEN** a `#task` note has no `gtask-id` frontmatter field and its status is not done or cancelled
- **THEN** a new task is created in Google Tasks and `gtask-id`, `gtask-list`, and `gtask-status` are written to the note

#### Scenario: Note has never been synced and is already completed
- **WHEN** a `#task` note has no `gtask-id` frontmatter field and its status is done or cancelled
- **THEN** the note is skipped without any API calls or frontmatter changes

#### Scenario: Note is already synced and task is unchanged
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map and the local payload matches the remote task's `title`, `status`, `notes`, and `due` (date portion)
- **THEN** the note is skipped without any API calls or frontmatter changes

#### Scenario: Note is already synced and task has changed
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map and at least one field of the local payload differs from the remote task
- **THEN** the Google Task is updated with current frontmatter values and `gtask-status` is updated

#### Scenario: Task was completed in Google Tasks but note is still active
- **WHEN** a `#task` note's `gtask-id` is found in the completed tasks map and the note's status is not done or cancelled
- **THEN** `status: done` is written to the note's frontmatter and `gtask-status` is updated to `completed`

#### Scenario: Task was deleted from Google Tasks and note is still active
- **WHEN** a `#task` note's `gtask-id` is not found in either map and the note's status is not done or cancelled
- **THEN** a new task is recreated in Google Tasks and `gtask-id`, `gtask-list`, and `gtask-status` are updated in the note

#### Scenario: Note and task are both done
- **WHEN** a `#task` note is done or cancelled and its `gtask-id` is in the completed tasks map or not found in either map
- **THEN** the note is skipped without any API calls or frontmatter changes

#### Scenario: Matched task IDs are tracked for orphan detection
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map
- **THEN** that task ID is added to the seen set regardless of whether the note is updated or skipped

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

## ADDED Requirements

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
