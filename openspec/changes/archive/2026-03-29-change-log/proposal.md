## Why

Users have no visibility into what the plugin has done — which tasks were created, updated, or deleted, and on which side (Obsidian or Google Tasks). A persistent change log in the vault gives users an auditable history and helps diagnose sync issues.

## What Changes

- New capability: the plugin writes a log file in the vault after every sync run, recording each change made on both sides (Obsidian → Google Tasks and Google Tasks → Obsidian).
- Each log entry captures: timestamp, direction, operation type (created/updated/deleted), task title, and list name.
- Log entries are appended to a single file (configurable path, default `gtasks-sync-log.md`) so the history accumulates across runs.
- A setting controls whether change logging is enabled (default: on).

## Capabilities

### New Capabilities

- `change-log`: Persists a human-readable Markdown log file in the vault recording every task change made during sync, on both sides.

### Modified Capabilities

<!-- No existing spec-level requirements change. -->

## Impact

- New log file written to the vault (configurable path).
- Sync engine must emit change events / records that the logger can consume.
- Settings: new `changeLog.enabled` (boolean) and `changeLog.path` (string) options.
- No breaking changes to existing sync behaviour.
