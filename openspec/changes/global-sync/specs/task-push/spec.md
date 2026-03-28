## MODIFIED Requirements

### Requirement: User can push the current note to Google Tasks
The plugin SHALL register a command "Sync current note to Google Tasks" in the command palette. The command SHALL only be available when the active file is a markdown note tagged with `#task`.

#### Scenario: Command is available on a task note
- **WHEN** a markdown file with a `#task` tag is the active file
- **THEN** the command "Sync current note to Google Tasks" is available in the command palette

#### Scenario: Command is not available on a non-task note
- **WHEN** the active file has no `#task` tag, or no file is open
- **THEN** the command "Sync current note to Google Tasks" is not available in the command palette

---

### Requirement: Plugin updates an existing Google Task on subsequent pushes
If the note has a `gtask-id` frontmatter field and `gtask-list` matches the configured default list, the plugin SHALL first fetch the current state of the task from Google Tasks, compare its status against the stored `gtask-status` field, and either sync the remote completion back to the note or push the local state to Google Tasks.

#### Scenario: Task was completed in Google Tasks since last sync
- **WHEN** syncing a note that has a `gtask-id` and the fetched Google Task status is `completed` and `gtask-status` is `needsAction`
- **THEN** `status: done` is written to the note's frontmatter, `gtask-status` is updated to `completed`, and no push is made to Google Tasks

#### Scenario: Task was already completed before last sync
- **WHEN** syncing a note that has a `gtask-id` and the fetched Google Task status is `completed` and `gtask-status` is `completed`
- **THEN** the local state is pushed to Google Tasks and `gtask-status` is updated accordingly

#### Scenario: Task is active in Google Tasks
- **WHEN** syncing a note that has a `gtask-id` and the fetched Google Task status is `needsAction`
- **THEN** the existing Google Task is updated with the current frontmatter values and `gtask-status` is updated

#### Scenario: Subsequent push fails due to API error
- **WHEN** the Google Tasks API returns an error during task fetch or update
- **THEN** the plugin displays an error notice and leaves frontmatter unchanged

## ADDED Requirements

### Requirement: Plugin tracks last known Google Tasks status in frontmatter
After every successful create, update, or recreate, the plugin SHALL write the resulting Google Tasks status value (`needsAction` or `completed`) to the note's frontmatter as `gtask-status`.

#### Scenario: Task is created or updated as active
- **WHEN** a task is successfully created or updated in Google Tasks with status `needsAction`
- **THEN** `gtask-status: needsAction` is written to the note's frontmatter

#### Scenario: Task is created or updated as completed
- **WHEN** a task is successfully created or updated in Google Tasks with status `completed`
- **THEN** `gtask-status: completed` is written to the note's frontmatter
