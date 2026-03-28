## Context

`determineAction` in `global-sync-command.ts` classifies each note into one of five actions: `create`, `update`, `recreate`, `mark-done`, or `skip`. Currently, any note whose `gtask-id` is found in the active tasks map unconditionally returns `'update'`. The full `GoogleTask` objects are already in memory from the upfront `fetchAllTasks` call, so a field comparison costs nothing extra.

## Goals / Non-Goals

**Goals:**
- Return `'skip'` instead of `'update'` when the local payload is identical to the remote task
- Compare `title`, `status`, `notes`, and the date portion of `due`
- Keep the change self-contained within the reconciliation logic

**Non-Goals:**
- Detecting changes to fields not currently synced (e.g. `position`, `parent`)
- Caching task state between plugin sessions
- Changing any API call structure or response handling

## Decisions

### Where to place the comparison

**Decision**: Add a `taskMatchesPayload(task, payload)` function in `field-mapper.ts` and call it from `determineAction`.

**Rationale**: `field-mapper.ts` already owns the field mapping logic (`buildTaskPayload`, `mapStatusToGoogle`, `mapDueToGoogle`). Keeping the inverse comparison there avoids scattering field knowledge. `determineAction` passes in the pre-built payload and the fetched task, keeping it pure and testable.

**Alternative considered**: Inline the comparison in `determineAction` — rejected because it mixes field mapping concerns with reconciliation logic.

### Due date comparison

**Decision**: Compare only the date portion (`YYYY-MM-DD`) — take the first 10 characters of the remote `due` field.

**Rationale**: The Google Tasks API may normalize the time component of the stored due date. Comparing only the date portion avoids false positives from time-zone or precision differences, and the local source (`due` frontmatter) is always a plain date anyway.

### Payload building

**Decision**: Build the payload before calling `determineAction`, pass it in as a parameter.

**Rationale**: The payload is needed for both the comparison and the actual update call. Building it once avoids redundancy and keeps `determineAction` free of side effects.

## Risks / Trade-offs

- **Risk**: Google Tasks modifies a field we don't track (e.g. normalizes the title) → the comparison would see a difference and push an update. This is acceptable — the update is harmless and idempotent.
- **Risk**: `notes` field was manually edited in Google Tasks → comparison will detect a mismatch and correctly push an update (restoring the Obsidian URI). Intended behavior.
- **Trade-off**: Dry-run "would update" count now reflects only genuine changes, which may be surprising to users who expected to see all previously-synced tasks listed. This is a strict improvement in accuracy.
