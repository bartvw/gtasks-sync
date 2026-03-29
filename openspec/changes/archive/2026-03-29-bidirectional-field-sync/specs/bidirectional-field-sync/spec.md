## ADDED Requirements

### Requirement: Plugin tracks last-synced title and due date in frontmatter sentinels
After every successful create, update, or recreate, the plugin SHALL write `gtask-title` and `gtask-due` to the note's frontmatter, recording the values that Google Tasks held at the time of sync.

- `gtask-title`: the title string as acknowledged by Google Tasks
- `gtask-due`: the due date in `YYYY-MM-DD` format as acknowledged by Google Tasks; omitted if no due date

These sentinels are used on subsequent syncs to determine whether a field changed on the local side, the Google side, or both.

#### Scenario: Task is created for the first time
- **WHEN** a new Google Task is created from a note
- **THEN** `gtask-title` is written with the task's title and `gtask-due` is written with the task's due date (or omitted if absent)

#### Scenario: Task is updated
- **WHEN** an existing Google Task is updated
- **THEN** `gtask-title` and `gtask-due` are updated to reflect the values acknowledged by Google after the update

---

### Requirement: Plugin resolves per-field changes using sentinel values
When syncing a note that already has a Google Task, the plugin SHALL compare each tracked field (title, due) between local, Google, and last-synced sentinel values to determine the correct action per field.

Resolution logic for each field:

- Local equals sentinel AND Google equals sentinel → **skip** (no change)
- Local differs from sentinel AND Google equals sentinel → **push** (local changed; include in API payload)
- Local equals sentinel AND Google differs from sentinel → **pull** (Google changed; write Google value to note)
- Both differ from sentinel with the same new value → **pull** (both made same change; agree on Google value)
- Both differ from sentinel with different values → apply conflict resolution strategy

When sentinel is absent (first sync after upgrade), the plugin SHALL treat the sentinel as equal to the current local value, so the first sync behaves as a push.

#### Scenario: Only local changed
- **WHEN** the local title differs from `gtask-title` and the Google title matches `gtask-title`
- **THEN** the new local title is included in the push payload sent to Google

#### Scenario: Only Google changed
- **WHEN** the Google title differs from `gtask-title` and the local title matches `gtask-title`
- **THEN** the Google title is written to the note's `title` frontmatter field; no title is included in the push payload

#### Scenario: Both changed to the same value
- **WHEN** local title and Google title both differ from `gtask-title` and they are equal to each other
- **THEN** the shared value is written to the note's frontmatter; no API update is made for that field

#### Scenario: Both changed to different values — google-wins strategy
- **WHEN** local title and Google title both differ from `gtask-title`, they are not equal, and `conflictResolution` is `google-wins`
- **THEN** the Google title is written to the note's frontmatter; the local title is not pushed to Google

#### Scenario: Both changed to different values — local-wins strategy
- **WHEN** local title and Google title both differ from `gtask-title`, they are not equal, and `conflictResolution` is `local-wins`
- **THEN** the local title is included in the push payload; the Google title is not written to the note

#### Scenario: Sentinel is absent (first sync after upgrade)
- **WHEN** a note has a `gtask-id` but no `gtask-title` sentinel
- **THEN** the current local title is treated as the last-synced value; the field is resolved as if only Google can have changed

---

### Requirement: Plugin provides a conflict resolution setting
The plugin settings SHALL include a `conflictResolution` field with two options:

- `google-wins` (default): when both sides changed a field, Google's value is authoritative
- `local-wins`: when both sides changed a field, the local note's value is authoritative

This setting applies uniformly to all tracked fields (`title`, `due`).

#### Scenario: Default conflict resolution is google-wins
- **WHEN** the plugin is installed without prior configuration
- **THEN** `conflictResolution` defaults to `google-wins`

#### Scenario: User selects local-wins
- **WHEN** the user sets `conflictResolution` to `local-wins` in plugin settings
- **THEN** all per-field conflicts are resolved in favour of the local note value
