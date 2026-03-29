## MODIFIED Requirements

### Requirement: Plugin reconciles each task note with Google Tasks
For each `#task`-tagged note, the plugin SHALL determine the correct action using the following logic:
- No `gtask-id` and note status is active: create a new task
- No `gtask-id` and note status is done or cancelled: skip
- `gtask-id` found in active tasks map:
  - If `gtask-status` is `completed` (Google un-completed the task since last sync):
    - Note status is active: update `gtask-status` to `needsAction` only (both sides agree — neither needs a write)
    - Note status is done or cancelled: write `status: open` and `gtask-status: needsAction` to the note's frontmatter (status un-done sync back); do not push to Google Tasks
  - Otherwise (no last-synced state, or last-synced state matches Google):
    - Local payload matches remote task: skip
    - Local payload differs from remote task: update the existing task
- `gtask-id` found in completed tasks map:
  - If `gtask-status` is `needsAction` (Google completed the task since last sync) and note status is done or cancelled: update `gtask-status` to `completed` only (both sides agree — neither needs a write)
  - Note status is active: write `status: done` to the note's frontmatter (status sync back); do not push to Google Tasks
  - Note status is done or cancelled: skip
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
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map and at least one field of the local payload differs from the remote task and `gtask-status` is not `completed`
- **THEN** the Google Task is updated with current frontmatter values and `gtask-status` is updated

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
- **THEN** a new task is recreated in Google Tasks and `gtask-id`, `gtask-list`, and `gtask-status` are updated in the note

#### Scenario: Note and task are both done
- **WHEN** a `#task` note is done or cancelled and its `gtask-id` is in the completed tasks map or not found in either map
- **THEN** the note is skipped without any API calls or frontmatter changes

#### Scenario: Matched task IDs are tracked for orphan detection
- **WHEN** a `#task` note's `gtask-id` is found in the active tasks map
- **THEN** that task ID is added to the seen set regardless of whether the note is updated or skipped
