## ADDED Requirements

### Requirement: Plugin fetches all tasks from a Google Tasks list
The plugin SHALL support fetching the complete set of tasks from a resolved list ID, including completed and hidden tasks, by paginating through `tasks.list` with `showCompleted=true` and `showHidden=true` until all pages are consumed. The result SHALL be returned as a map of task ID to task object.

#### Scenario: All tasks fetched in one page
- **WHEN** the task list fits in a single API response
- **THEN** the plugin returns a complete map of all tasks in the list

#### Scenario: Tasks span multiple pages
- **WHEN** the API response includes a `nextPageToken`
- **THEN** the plugin fetches subsequent pages using the token until all tasks are collected
