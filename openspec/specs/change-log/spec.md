# Capability: Change Log

## Purpose

The change log capability records every sync operation to a Markdown file in the vault. Each sync run produces a timestamped group of entries describing what was created, updated, or deleted — and for updates, which fields changed. This gives users a human-readable audit trail of all synchronisation activity.

## Requirements

### Requirement: Log file is created on first sync
The plugin SHALL create the change log file in the vault if it does not already exist when a sync run produces at least one loggable event.

#### Scenario: First sync with changes
- **WHEN** a sync run completes and the log file does not yet exist
- **THEN** the plugin creates the file at the configured path and writes the run's entries into it

#### Scenario: First sync with no changes
- **WHEN** a sync run completes and no operations were performed (all skipped)
- **THEN** the plugin does NOT create the log file

### Requirement: Log entry written for every sync operation
The plugin SHALL append a log entry for each create, update, or delete operation performed during a sync run, on either side (Obsidian→Google or Google→Obsidian).

#### Scenario: Task created in Google Tasks
- **WHEN** a note is pushed to Google Tasks for the first time
- **THEN** a "Created in Google Tasks" entry is appended, including a wikilink to the note and the list name

#### Scenario: Task updated in Google Tasks
- **WHEN** an existing Google task is updated with changes from a note
- **THEN** an "Updated in Google Tasks" entry is appended, including a wikilink to the note, the list name, and a sub-list of changed fields with old → new values

#### Scenario: Task status pulled from Google Tasks
- **WHEN** a note is updated because its corresponding Google task changed (e.g. marked complete)
- **THEN** an "Updated from Google Tasks" entry is appended, including a wikilink to the note, the list name, and a sub-list of changed fields with old → new values

#### Scenario: Task deleted
- **WHEN** a task is deleted during sync
- **THEN** a "Deleted" entry is appended, including a wikilink to the note and the list name

### Requirement: Update entries specify changed fields
For any update operation, the log entry SHALL list only the fields that actually changed, with their old and new values.

#### Scenario: Title changed
- **WHEN** the task title differs between local and remote
- **THEN** the entry includes `title: "<old>" → "<new>"`

#### Scenario: Due date changed
- **WHEN** the due date differs between local and remote
- **THEN** the entry includes `due: <old> → <new>` (using ISO date format or `—` for absent)

#### Scenario: Status changed
- **WHEN** the completion status changes
- **THEN** the entry includes `status: <old> → <new>`

#### Scenario: Notes changed
- **WHEN** the task notes/body differs between local and remote
- **THEN** the entry includes `notes: changed`

#### Scenario: No fields changed
- **WHEN** an update operation is triggered but no tracked fields differ
- **THEN** no log entry is written for that operation

### Requirement: Log entries grouped by sync run
All entries from a single sync run SHALL be written under a shared timestamp heading.

#### Scenario: Multiple changes in one run
- **WHEN** a sync run produces multiple loggable operations
- **THEN** all entries appear under a single `### <timestamp>` heading in the log file

### Requirement: Log entries appended, not overwritten
The plugin SHALL append new run entries to the end of the existing log file, preserving all previous entries.

#### Scenario: Subsequent sync run
- **WHEN** a second sync run completes after the log file already exists
- **THEN** the new run's entries are appended below the previous entries

### Requirement: Change logging can be disabled
The plugin SHALL provide a setting to disable change logging entirely.

#### Scenario: Logging disabled
- **WHEN** the `changeLog.enabled` setting is `false`
- **THEN** no log file is created or modified during sync runs

### Requirement: Log file path is configurable
The user SHALL be able to configure the vault-relative path of the log file.

#### Scenario: Custom path configured
- **WHEN** `changeLog.path` is set to a non-default value (e.g., `logs/gtasks.md`)
- **THEN** the plugin writes all log entries to that path

#### Scenario: Default path used
- **WHEN** `changeLog.path` is not customised
- **THEN** the plugin writes to `gtasks-sync-log.md` in the vault root
