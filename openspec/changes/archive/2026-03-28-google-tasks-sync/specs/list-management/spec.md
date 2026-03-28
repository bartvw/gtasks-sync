## ADDED Requirements

### Requirement: User configures a default Google Tasks list
The plugin settings tab SHALL allow the user to select or enter the name of the Google Tasks list to use as the default sync target. The list name SHALL be stored via `plugin.saveData()`.

#### Scenario: User sets a default list
- **WHEN** the user enters a Google Tasks list name in plugin settings and saves
- **THEN** subsequent syncs use that list as the target

---

### Requirement: Plugin moves a task when the configured list changes
If the note has a `gtask-id` and a `gtask-list` in its frontmatter that differs from the currently configured default list, the plugin SHALL move the task to the new list. Moving is implemented as: create task in new list → delete task from old list → update `gtask-id` and `gtask-list` in frontmatter.

#### Scenario: Configured list has changed since last sync
- **WHEN** syncing a note whose `gtask-list` frontmatter field differs from the configured default list
- **THEN** the task is created in the new list, deleted from the old list, and `gtask-id` and `gtask-list` in the frontmatter are updated to reflect the new location

#### Scenario: Create in new list fails during move
- **WHEN** the create-in-new-list step fails during a move
- **THEN** the plugin aborts the move, displays an error notice, and leaves the note frontmatter and the original task unchanged

#### Scenario: Delete from old list fails during move
- **WHEN** the delete-from-old-list step fails after a successful create in the new list
- **THEN** the plugin updates the frontmatter with the new `gtask-id` and `gtask-list` (the task now lives in the new list), displays a warning notice that the old task may still exist, and does not retry the delete

---

### Requirement: Plugin resolves the Google Tasks list by name
The plugin SHALL resolve the user-configured list name to a Google Tasks list ID at sync time by querying the Google Tasks API tasklists endpoint. The resolved list ID SHALL be used for all API calls but SHALL NOT be persisted.

#### Scenario: List name resolves successfully
- **WHEN** the configured list name matches an existing Google Tasks list
- **THEN** the plugin uses that list's ID for the sync operation

#### Scenario: List name does not match any list
- **WHEN** the configured list name does not match any list returned by the tasklists endpoint
- **THEN** the plugin displays an error notice and aborts the sync
