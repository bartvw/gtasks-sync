## 1. Settings

- [x] 1.1 Add `importFromGoogle` object to `PluginSettings` interface with `enabled: boolean`, `folder: string`, and `defaultStatus: string` fields, with defaults `false`, `""`, `"open"`
- [x] 1.2 Add settings UI controls: toggle for `enabled`, text input for `folder`, text input for `defaultStatus`, and a validation message shown when enabled but folder is empty

## 2. Field Mapper — notes field and change detection

- [x] 2.1 Update `buildTaskPayload()` to read note body content (text below the frontmatter block) and set the `notes` field to `<body>\n\nobsidian://...` when body is present, or just the URI when absent
- [x] 2.2 Update `taskMatchesPayload()` to include the `notes` field in comparisons (previously excluded)
- [x] 2.3 Add a helper `extractBodyFromGoogleNotes(notes: string): string` that strips a trailing Obsidian URI (and preceding blank line) from a Google Tasks notes string, returning just the user content

## 3. Frontmatter — note body reading

- [x] 3.1 Add a utility `readNoteBody(file: TFile, app: App): Promise<string>` that reads the note file and returns the content below the closing `---` of the frontmatter block (trimmed)

## 4. Note creation utility

- [x] 4.1 Add `sanitizeFilename(title: string): string` that strips `/ : * ? " < > | \` and trims whitespace, falling back to `"untitled"`
- [x] 4.2 Add `findUniqueFilePath(folder: string, baseName: string, app: App): string` that checks for collisions and appends ` 2`, ` 3`, etc. until a unique path is found
- [x] 4.3 Add `createNoteFromGoogleTask(task: GoogleTask, listName: string, settings: PluginSettings, app: App): Promise<TFile>` that creates the note file with correct frontmatter (tags, title, due, status, gtask-id, gtask-list, gtask-status) and body content from `extractBodyFromGoogleNotes`
- [x] 4.4 Ensure the import folder is created (with parents) if it does not exist before writing the first note

## 5. Global sync — orphan detection and import pass

- [x] 5.1 Add a `seenTaskIds: Set<string>` initialized before the reconciliation loop; populate it with each `gtask-id` that is found in `activeTasks` during the loop (regardless of action taken)
- [x] 5.2 After the reconciliation loop, compute orphan IDs: active task IDs not in `seenTaskIds`
- [x] 5.3 Add import pass: when `importFromGoogle.enabled` is `true` and `folder` is non-empty, iterate orphan IDs and call `createNoteFromGoogleTask` for each; collect results for logging and summary
- [x] 5.4 Skip the import pass with a notice if `importFromGoogle.enabled` is `true` but `folder` is empty

## 6. Dry-run — import count

- [x] 6.1 In dry-run mode, compute the orphan set using the same seen-set logic and include a "would import N" count in the dry-run summary when `importFromGoogle.enabled` is `true`

## 7. Change logger — import entries

- [x] 7.1 Add support for `operation: "imported"` with `direction: "from-google"` in the change log entry type
- [x] 7.2 After the import pass, append log entries for all successfully created notes when the change log is enabled

## 8. Tests

- [x] 8.1 Unit tests for `sanitizeFilename`: invalid chars stripped, empty fallback, whitespace trimming
- [x] 8.2 Unit tests for `findUniqueFilePath`: no collision, single collision, multiple collisions
- [x] 8.3 Unit tests for `extractBodyFromGoogleNotes`: notes with URI, without URI, empty
- [x] 8.4 Unit tests for updated `buildTaskPayload()`: note with body, note without body
- [x] 8.5 Unit tests for updated `taskMatchesPayload()`: notes field change detected, notes field match passes
- [x] 8.6 Unit tests for the import pass in global sync: orphan detection, disabled import, missing folder
- [x] 8.7 Unit tests for dry-run import count
