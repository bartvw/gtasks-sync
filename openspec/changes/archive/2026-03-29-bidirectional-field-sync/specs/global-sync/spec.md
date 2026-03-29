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
