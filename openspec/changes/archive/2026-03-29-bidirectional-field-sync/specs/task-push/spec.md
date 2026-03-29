## MODIFIED Requirements

### Requirement: Plugin maps TaskNotes frontmatter to Google Tasks fields
When syncing, the plugin SHALL construct a Google Tasks task body using the following field mapping:

- `title`: the `title` frontmatter field; falls back to the note filename (without extension) if absent
- `due`: the `due` frontmatter field (YYYY-MM-DD) converted to an RFC 3339 datetime string at midnight UTC; omitted if the field is absent
- `status`: `needsAction` if the `status` frontmatter field is any value other than `done` or `cancelled`; `completed` if the value is `done` or `cancelled`

The `notes` field SHALL NOT be written by the plugin. Google Tasks `notes` is treated as a free-form field outside the sync scope.

On a **create** or **recreate**, all mapped fields are included in the payload unconditionally.

On an **update**, `title` and `due` are resolved per field using sentinel comparison before being included (see bidirectional-field-sync capability). Only fields resolved as `push` are included in the API payload.

#### Scenario: Note has all standard fields (create)
- **WHEN** creating a task from a note with `title`, `due`, and `status` frontmatter fields
- **THEN** the Google Tasks payload contains the mapped title, RFC 3339 due date, correct status, and no `notes` field

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

### Requirement: Plugin updates an existing Google Task on subsequent pushes
If the note has a `gtask-id` frontmatter field and `gtask-list` matches the configured default list, the plugin SHALL fetch the current state of the task from Google Tasks, apply per-field resolution for `title` and `due` using sentinel values, and either write Google values back to the note or push local values to Google Tasks.

Status sync-back (completion state) is handled separately as before.

#### Scenario: Task was completed in Google Tasks since last sync
- **WHEN** syncing a note that has a `gtask-id` and the fetched Google Task status is `completed` and `gtask-status` is `needsAction`
- **THEN** `status: done` is written to the note's frontmatter, `gtask-status` is updated to `completed`, and no push is made to Google Tasks

#### Scenario: Google changed the title since last sync
- **WHEN** the fetched Google Task title differs from `gtask-title` and the local title matches `gtask-title`
- **THEN** the Google title is written to the note's `title` frontmatter and `gtask-title` is updated; no title push is made

#### Scenario: Google changed the due date since last sync
- **WHEN** the fetched Google Task due date differs from `gtask-due` and the local due date matches `gtask-due`
- **THEN** the Google due date is written to the note's `due` frontmatter and `gtask-due` is updated; no due push is made

#### Scenario: Local changed title and Google did not
- **WHEN** the local title differs from `gtask-title` and the Google title matches `gtask-title`
- **THEN** the local title is pushed to Google Tasks and `gtask-title` is updated to the new value

#### Scenario: Both sides changed title — google-wins
- **WHEN** both local and Google titles differ from `gtask-title` and they are not equal and `conflictResolution` is `google-wins`
- **THEN** the Google title is written to the note's frontmatter; the local title is not pushed

#### Scenario: Subsequent push fails due to API error
- **WHEN** the Google Tasks API returns an error during task fetch or update
- **THEN** the plugin displays an error notice and leaves frontmatter unchanged

---

### Requirement: Plugin tracks last known Google Tasks status in frontmatter
After every successful create, update, or recreate, the plugin SHALL write the resulting Google Tasks status value (`needsAction` or `completed`) to the note's frontmatter as `gtask-status`, and SHALL write the acknowledged `title` and `due` values as `gtask-title` and `gtask-due`.

#### Scenario: Task is created or updated as active
- **WHEN** a task is successfully created or updated in Google Tasks with status `needsAction`
- **THEN** `gtask-status: needsAction`, `gtask-title`, and `gtask-due` are written to the note's frontmatter

#### Scenario: Task is created or updated as completed
- **WHEN** a task is successfully created or updated in Google Tasks with status `completed`
- **THEN** `gtask-status: completed`, `gtask-title`, and `gtask-due` are written to the note's frontmatter

## REMOVED Requirements

### Requirement: Notes field includes Obsidian URI
**Reason**: The plugin no longer manages the Google Tasks `notes` field. Removing the URI coupling simplifies sync logic and lets users freely edit notes in Google Tasks.
**Migration**: Existing Obsidian URIs already present in Google Tasks `notes` will not be removed automatically. Users who relied on those links should note they will no longer be maintained or updated.
