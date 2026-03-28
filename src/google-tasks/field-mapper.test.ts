import { describe, it, expect, vi } from 'vitest';
import {
	buildObsidianUri,
	mapStatusToGoogle,
	mapDueToGoogle,
	buildTaskPayload,
} from './field-mapper';
import { TFile } from 'obsidian';

vi.mock('obsidian');

function makeFile(basename: string, path: string): TFile {
	return { basename, path } as unknown as TFile;
}

describe('buildObsidianUri', () => {
	it('encodes vault name and file path', () => {
		const uri = buildObsidianUri('My Vault', 'Tasks/Buy milk.md');
		expect(uri).toBe('obsidian://open?vault=My%20Vault&file=Tasks%2FBuy%20milk.md');
	});
});

describe('mapStatusToGoogle', () => {
	it.each(['done', 'cancelled'])('maps "%s" to "completed"', status => {
		expect(mapStatusToGoogle(status)).toBe('completed');
	});

	it.each(['todo', 'in-progress', 'waiting', ''])('maps "%s" to "needsAction"', status => {
		expect(mapStatusToGoogle(status)).toBe('needsAction');
	});
});

describe('mapDueToGoogle', () => {
	it('converts YYYY-MM-DD to RFC 3339 midnight UTC', () => {
		expect(mapDueToGoogle('2025-06-15')).toBe('2025-06-15T00:00:00.000Z');
	});

	it('returns undefined when due is undefined', () => {
		expect(mapDueToGoogle(undefined)).toBeUndefined();
	});

	it('returns undefined when due is empty string', () => {
		expect(mapDueToGoogle('')).toBeUndefined();
	});
});

describe('buildTaskPayload', () => {
	it('uses frontmatter title', () => {
		const file = makeFile('my-note', 'Tasks/my-note.md');
		const payload = buildTaskPayload({ title: 'Buy milk', status: 'todo' }, file, 'Vault');
		expect(payload.title).toBe('Buy milk');
	});

	it('falls back to filename when no title in frontmatter', () => {
		const file = makeFile('my-note', 'Tasks/my-note.md');
		const payload = buildTaskPayload({ status: 'todo' }, file, 'Vault');
		expect(payload.title).toBe('my-note');
	});

	it('includes due when present', () => {
		const file = makeFile('note', 'note.md');
		const payload = buildTaskPayload({ status: 'todo', due: '2025-12-01' }, file, 'Vault');
		expect(payload.due).toBe('2025-12-01T00:00:00.000Z');
	});

	it('omits due when absent', () => {
		const file = makeFile('note', 'note.md');
		const payload = buildTaskPayload({ status: 'todo' }, file, 'Vault');
		expect(payload.due).toBeUndefined();
	});

	it('sets notes to Obsidian URI', () => {
		const file = makeFile('note', 'Tasks/note.md');
		const payload = buildTaskPayload({ status: 'todo' }, file, 'My Vault');
		expect(payload.notes).toBe('obsidian://open?vault=My%20Vault&file=Tasks%2Fnote.md');
	});

	it('maps done status to completed', () => {
		const file = makeFile('note', 'note.md');
		const payload = buildTaskPayload({ status: 'done' }, file, 'Vault');
		expect(payload.status).toBe('completed');
	});
});
