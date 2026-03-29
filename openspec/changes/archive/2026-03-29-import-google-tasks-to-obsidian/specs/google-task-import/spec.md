## ADDED Requirements

### Requirement: Plugin imports orphan active Google Tasks as Obsidian notes
After the existing reconciliation loop, the plugin SHALL identify active Google Tasks (`needsAction`) that were not matched to any vault note (orphans) and, when the import feature is enabled, create a new Obsidian note for each orphan in the configured import folder.

#### Scenario: Import is enabled and orphan active tasks exist
- **WHEN** global sync completes the reconciliation loop and `importFromGoogle.enabled` is `true` and at least one active Google Task was not matched to any vault note
- **THEN** a new Obsidian note is created in `importFromGoogle.folder` for each unmatched active task

#### Scenario: Import is disabled
- **WHEN** `importFromGoogle.enabled` is `false`
- **THEN** no notes are created from Google Tasks and the orphan pass is skipped entirely

#### Scenario: Import folder is not configured
- **WHEN** `importFromGoogle.enabled` is `true` and `importFromGoogle.folder` is empty
- **THEN** the import pass is skipped and the plugin displays a notice prompting the user to configure an import folder

#### Scenario: No orphan tasks exist
- **WHEN** all active Google Tasks were matched to vault notes
- **THEN** no notes are created and the import pass completes silently

#### Scenario: Completed Google Tasks are never imported
- **WHEN** a Google Task has status `completed` and no matching vault note exists
- **THEN** no note is created for that task

---

### Requirement: Imported notes are populated with task data from Google Tasks
Each created note SHALL be a valid task note containing: the `#task` tag, `title` frontmatter from the Google Task title, `due` frontmatter (YYYY-MM-DD) if the task has a due date, `status` frontmatter set to `importFromGoogle.defaultStatus`, and sync metadata (`gtask-id`, `gtask-list`, `gtask-status: needsAction`).

#### Scenario: Task has title and due date
- **WHEN** an orphan Google Task has a title and a due date
- **THEN** the created note has `title` set to the task title, `due` set to the YYYY-MM-DD portion of the task's due field, `status` set to the configured default status, and the three `gtask-*` fields set correctly

#### Scenario: Task has title but no due date
- **WHEN** an orphan Google Task has a title but no due date
- **THEN** the created note has `title` set to the task title, no `due` field, and the other fields set correctly

#### Scenario: Task has notes content
- **WHEN** an orphan Google Task has content in its `notes` field
- **THEN** the created Obsidian note body contains that content (the Obsidian deeplink is written to the Google Task's notes field on the next sync)

#### Scenario: Task has no notes content
- **WHEN** an orphan Google Task has an empty or absent `notes` field
- **THEN** the created note has no body content

---

### Requirement: Imported note filenames are sanitized and unique
The plugin SHALL derive the note filename from the Google Task title by stripping filesystem-invalid characters (`/ : * ? " < > | \`), trimming whitespace, and falling back to `"untitled"` if the result is empty. If a file with that name already exists in the import folder, the plugin SHALL append ` 2`, ` 3`, etc. until a unique name is found. The `title` frontmatter field SHALL always hold the original task title regardless of the filename chosen.

#### Scenario: Task title is a valid filename
- **WHEN** an orphan task has a title containing no invalid characters
- **THEN** the note is created as `<title>.md` in the import folder

#### Scenario: Task title contains invalid characters
- **WHEN** an orphan task title contains characters invalid in filenames
- **THEN** those characters are stripped and the resulting sanitized name is used as the filename; the `title` frontmatter field retains the original title

#### Scenario: A file with the same sanitized name already exists
- **WHEN** the sanitized filename already exists in the import folder
- **THEN** the note is created with a sequence suffix (e.g. `Buy milk 2.md`) and the `title` frontmatter field retains the original title

#### Scenario: Task title is empty or all-invalid characters
- **WHEN** the sanitized task title is empty after stripping
- **THEN** the note is created as `untitled.md` (or `untitled 2.md`, etc.) and the `title` frontmatter field is set to the original (possibly empty) task title

---

### Requirement: Import folder is created if it does not exist
If `importFromGoogle.folder` refers to a path that does not exist in the vault, the plugin SHALL create the folder before writing any notes.

#### Scenario: Import folder does not exist
- **WHEN** the import pass runs and the configured folder path does not exist in the vault
- **THEN** the folder (and any necessary parent folders) is created before the first note is written

---

### Requirement: Imported notes appear in the change log
If the change log is enabled, the plugin SHALL append a log entry for each imported note after the import pass completes.

#### Scenario: Change log is enabled and notes are imported
- **WHEN** one or more notes are created during the import pass and the change log is enabled
- **THEN** each imported note is recorded in the change log with operation `imported` and direction `from-google`

---

### Requirement: Dry-run mode shows the count of tasks that would be imported
When dry-run mode is active and the import feature is enabled, the plugin SHALL include the number of orphan active tasks that would be imported in the dry-run summary, without creating any notes.

#### Scenario: Dry-run with import enabled and orphan tasks present
- **WHEN** dry-run global sync is triggered with `importFromGoogle.enabled` true and orphan active tasks exist
- **THEN** the dry-run summary includes a "would import" count for those tasks and no notes are created

#### Scenario: Dry-run with import disabled
- **WHEN** dry-run global sync is triggered with `importFromGoogle.enabled` false
- **THEN** the dry-run summary does not include an import count
