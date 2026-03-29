## MODIFIED Requirements

### Requirement: Plugin maps TaskNotes frontmatter to Google Tasks fields
When syncing, the plugin SHALL construct a Google Tasks task body using the following field mapping:

- `title`: the `title` frontmatter field; falls back to the note filename (without extension) if absent
- `due`: the `due` frontmatter field (YYYY-MM-DD) converted to an RFC 3339 datetime string at midnight UTC; omitted if the field is absent
- `status`: `needsAction` if the `status` frontmatter field is any value other than `done` or `cancelled`; `completed` if the value is `done` or `cancelled`
- `notes`: if the note has body content (text below the frontmatter block), the field SHALL be set to `<body content>\n\nobsidian://open?vault=<vault-name>&file=<url-encoded-path>`; if the note has no body content, the field SHALL be set to just the Obsidian URI

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

#### Scenario: Note has body content
- **WHEN** syncing a note that has text below the frontmatter block
- **THEN** the Google Tasks `notes` field is set to the body text followed by a blank line and the Obsidian URI

#### Scenario: Note has no body content
- **WHEN** syncing a note with no text below the frontmatter block
- **THEN** the Google Tasks `notes` field is set to just the Obsidian URI
