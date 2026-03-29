import { App } from 'obsidian';
import { GoogleTask } from '../types';

export interface FieldChange {
	field: string;
	oldValue: string;
	newValue: string;
}

export interface ChangeEntry {
	timestamp: string;
	direction: 'to-google' | 'from-google';
	operation: 'created' | 'updated' | 'deleted' | 'imported';
	noteWikilink: string;
	listName: string;
	fieldChanges?: FieldChange[];
}

export function buildFieldChanges(
	before: Pick<GoogleTask, 'title' | 'due' | 'status' | 'notes'>,
	after: Pick<GoogleTask, 'title' | 'due' | 'status' | 'notes'>
): FieldChange[] {
	const changes: FieldChange[] = [];

	if (before.title !== after.title) {
		changes.push({ field: 'title', oldValue: `"${before.title}"`, newValue: `"${after.title}"` });
	}

	const beforeDue = before.due ? before.due.slice(0, 10) : undefined;
	const afterDue = after.due ? after.due.slice(0, 10) : undefined;
	if (beforeDue !== afterDue) {
		changes.push({ field: 'due', oldValue: beforeDue ?? '—', newValue: afterDue ?? '—' });
	}

	if (before.status !== after.status) {
		changes.push({ field: 'status', oldValue: before.status, newValue: after.status });
	}

	if (before.notes !== after.notes) {
		changes.push({ field: 'notes', oldValue: '', newValue: '' });
	}

	return changes;
}

function formatLabel(entry: ChangeEntry): string {
	if (entry.operation === 'created') return '✅ Created in Google Tasks';
	if (entry.operation === 'deleted') return '🗑️ Deleted from Google Tasks';
	if (entry.operation === 'imported') return '⬇️ Imported from Google Tasks';
	return entry.direction === 'to-google'
		? '🔄 Updated in Google Tasks'
		: '⬇️ Updated from Google Tasks';
}

function formatFieldChange(fc: FieldChange): string {
	if (fc.field === 'notes') return '  - notes: changed';
	return `  - ${fc.field}: ${fc.oldValue} → ${fc.newValue}`;
}

export class ChangeLogger {
	private entries: ChangeEntry[] = [];

	record(entry: ChangeEntry): void {
		this.entries.push(entry);
	}

	async flush(app: App, path: string): Promise<void> {
		if (this.entries.length === 0) return;

		const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

		const lines: string[] = [`### ${timestamp}`, ''];
		for (const entry of this.entries) {
			lines.push(`- ${formatLabel(entry)} | [[${entry.noteWikilink}]] | list: ${entry.listName}`);
			if (entry.fieldChanges && entry.fieldChanges.length > 0) {
				for (const fc of entry.fieldChanges) {
					lines.push(formatFieldChange(fc));
				}
			}
		}
		lines.push('');

		const block = lines.join('\n');

		let existing = '';
		try {
			existing = await app.vault.adapter.read(path);
		} catch {
			// File does not exist yet — start fresh
		}

		await app.vault.adapter.write(path, existing + block);
	}
}
