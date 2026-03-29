# Roadmap

## Shipped

### Global sync command
A command that finds all task notes in the vault and syncs them to Google Tasks in one go. Includes a dry-run preview mode and a progress modal. Skips unchanged tasks to avoid redundant API calls.

### Change log
After each sync run, appends a human-readable Markdown log of every operation (creates, updates, skips) to a configurable vault file.

### Status sync back
When a task is marked as done in Google Tasks, reflect that change back in the Obsidian note's status frontmatter field. 

## Planned

### Configurable completed statuses
Currently the plugin hardcodes `done` and `cancelled` as the TaskNotes statuses that map to Google Tasks' `completed` state. This should be configurable in plugin settings.

### Per-note Google Tasks list override
A frontmatter field (e.g. `gtask-list`) that overrides the global default tasklist for a specific note. When this field changes, the task should be moved to the new list (delete from old list + create in new list + update `gtask-id`).

### Deleted task handling - Google Tasks side
Detect when a Google Task has been deleted and handle it gracefully — either by flagging the note or offering to re-create the task.

### Deleted task handling - Obsidian side
Detect when a note that has a google task connected to it is deleted and delete the google task (not sure if possible)

### Sync new tasks from Google Tasks
Detect tasks in Google Tasks which aren't in Obsidian yet and add them under a configurable heading in the daily note of the day the task was created. 