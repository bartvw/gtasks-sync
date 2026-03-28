import { describe, it, expect, vi } from 'vitest';
import {
	buildObsidianUri,
	mapStatusToGoogle,
	mapDueToGoogle,
	buildTaskPayload,
	taskMatchesPayload,
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

describe('taskMatchesPayload', () => {
	const base = { title: 'Buy milk', status: 'needsAction' as const, notes: 'obsidian://note', due: '2025-06-15T00:00:00.000Z' };

	it('returns true when all fields match', () => {
		const task = { id: 't1', ...base };
		const payload = { ...base };
		expect(taskMatchesPayload(task, payload)).toBe(true);
	});

	it('returns false when title differs', () => {
		const task = { id: 't1', ...base };
		expect(taskMatchesPayload(task, { ...base, title: 'Buy bread' })).toBe(false);
	});

	it('returns false when status differs', () => {
		const task = { id: 't1', ...base };
		expect(taskMatchesPayload(task, { ...base, status: 'completed' })).toBe(false);
	});

	it('returns false when notes differs', () => {
		const task = { id: 't1', ...base };
		expect(taskMatchesPayload(task, { ...base, notes: 'obsidian://other' })).toBe(false);
	});

	it('returns false when due date differs', () => {
		const task = { id: 't1', ...base };
		expect(taskMatchesPayload(task, { ...base, due: '2025-07-01T00:00:00.000Z' })).toBe(false);
	});

	it('returns true when both sides have no due', () => {
		const task = { id: 't1', title: 'Buy milk', status: 'needsAction' as const, notes: 'obsidian://note' };
		const payload = { title: 'Buy milk', status: 'needsAction' as const, notes: 'obsidian://note' };
		expect(taskMatchesPayload(task, payload)).toBe(true);
	});

	it('returns false when remote has due but local does not', () => {
		const task = { id: 't1', ...base };
		const { due: _due, ...payloadNoDue } = base;
		expect(taskMatchesPayload(task, payloadNoDue)).toBe(false);
	});

	it('returns false when local has due but remote does not', () => {
		const { due: _due, ...taskNoDue } = base;
		const task = { id: 't1', ...taskNoDue };
		expect(taskMatchesPayload(task, base)).toBe(false);
	});

	it('compares only the date portion of due (ignores time)', () => {
		const task = { id: 't1', ...base, due: '2025-06-15T12:34:56.000Z' };
		expect(taskMatchesPayload(task, base)).toBe(true);
	});
});
