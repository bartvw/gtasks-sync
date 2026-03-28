# Capability: task-push

## Purpose

Handles pushing a TaskNotes note to Google Tasks, including field mapping, create/update logic, and user notifications.

## Requirements

### Requirement: User can push the current note to Google Tasks
The plugin SHALL register a command "Sync current note to Google Tasks" in the command palette. The command SHALL only be available when the active file is a markdown note with a `status` frontmatter field (indicating it is a TaskNotes task note).

#### Scenario: Command is available on a task note
- **WHEN** a markdown file with a `status` frontmatter field is the active file
- **THEN** the command "Sync current note to Google Tasks" is available in the command palette

#### Scenario: Command is not available on a non-task note
- **WHEN** the active file has no `status` frontmatter field, or no file is open
- **THEN** the command "Sync current note to Google Tasks" is not available in the command palette

---

### Requirement: Plugin maps TaskNotes frontmatter to Google Tasks fields
When syncing, the plugin SHALL construct a Google Tasks task body using the following field mapping:

- `title`: the `title` frontmatter field; falls back to the note filename (without extension) if absent
- `due`: the `due` frontmatter field (YYYY-MM-DD) converted to an RFC 3339 datetime string at midnight UTC; omitted if the field is absent
- `status`: `needsAction` if the `status` frontmatter field is any value other than `done` or `cancelled`; `completed` if the value is `done` or `cancelled`
- `notes`: an Obsidian deep-link URI of the form `obsidian://open?vault=<vault-name>&file=<url-encoded-path>`

#### Scenario: Note has all standard fields
- **WHEN** syncing a note with `title`, `due`, and `status` frontmatter fields
- **THEN** the Google Tasks payload contains the mapped title, RFC 3339 due date, correct status, and the Obsidian URI in the notes field

#### Scenario: Note has no title field
- **WHEN** syncing a note without a `title` frontmatter field
- **THEN** the note filename (without `.md` extension) is used as the task title

#### Scenario: Note status is "done"
- **WHEN** syncing a note whose `status` frontmatter field is `done`
- **THEN** the Google Tasks payload has `"status": "completed"`

#### Scenario: Note status is "cancelled"
- **WHEN** syncing a note whose `status` frontmatter field is `cancelled`
- **THEN** the Google Tasks payload has `"status": "completed"`

#### Scenario: Note status is any other value
- **WHEN** syncing a note whose `status` frontmatter field is not `done` or `cancelled`
- **THEN** the Google Tasks payload has `"status": "needsAction"`

#### Scenario: Note has no due date
- **WHEN** syncing a note without a `due` frontmatter field
- **THEN** the Google Tasks payload omits the `due` field

---

### Requirement: Plugin creates a new Google Task on first push
If the note has no `gtask-id` frontmatter field, the plugin SHALL create a new task in the configured default Google Tasks list and write the returned task ID and list name back to the note's frontmatter as `gtask-id` and `gtask-list`.

#### Scenario: First push succeeds
- **WHEN** syncing a note with no `gtask-id` frontmatter field
- **THEN** a new task is created in the configured list, and `gtask-id` and `gtask-list` are written to the note's frontmatter

#### Scenario: First push fails due to API error
- **WHEN** the Google Tasks API returns an error during task creation
- **THEN** the plugin displays an error notice, and the note's frontmatter is not modified

---

### Requirement: Plugin updates an existing Google Task on subsequent pushes
If the note has a `gtask-id` frontmatter field and `gtask-list` matches the configured default list, the plugin SHALL update the existing task in Google Tasks using the stored ID.

#### Scenario: Subsequent push succeeds
- **WHEN** syncing a note that has a `gtask-id` and `gtask-list` matching the configured list
- **THEN** the existing Google Task is updated with the current frontmatter values

#### Scenario: Subsequent push fails due to API error
- **WHEN** the Google Tasks API returns an error during task update
- **THEN** the plugin displays an error notice and leaves frontmatter unchanged

---

### Requirement: Plugin notifies the user of sync outcome
After every sync attempt the plugin SHALL display an Obsidian notice indicating success or failure.

#### Scenario: Sync succeeds
- **WHEN** a task is successfully created or updated in Google Tasks
- **THEN** the plugin displays a success notice

#### Scenario: Sync fails
- **WHEN** any step of the sync fails (authentication, API call, frontmatter write)
- **THEN** the plugin displays an error notice describing the failure
