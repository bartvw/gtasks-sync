import { describe, it, expect, vi } from 'vitest';
import {
	mapStatusToGoogle,
	mapDueToGoogle,
	buildTaskPayload,
	taskMatchesPayload,
	resolveField,
} from './field-mapper';
import { TFile } from 'obsidian';

vi.mock('obsidian');

function makeFile(basename: string, path: string): TFile {
	return { basename, path } as unknown as TFile;
}

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
		const payload = buildTaskPayload({ title: 'Buy milk', status: 'todo' }, file);
		expect(payload.title).toBe('Buy milk');
	});

	it('falls back to filename when no title in frontmatter', () => {
		const file = makeFile('my-note', 'Tasks/my-note.md');
		const payload = buildTaskPayload({ status: 'todo' }, file);
		expect(payload.title).toBe('my-note');
	});

	it('includes due when present', () => {
		const file = makeFile('note', 'note.md');
		const payload = buildTaskPayload({ status: 'todo', due: '2025-12-01' }, file);
		expect(payload.due).toBe('2025-12-01T00:00:00.000Z');
	});

	it('omits due when absent', () => {
		const file = makeFile('note', 'note.md');
		const payload = buildTaskPayload({ status: 'todo' }, file);
		expect(payload.due).toBeUndefined();
	});

	it('does not include a notes field', () => {
		const file = makeFile('note', 'Tasks/note.md');
		const payload = buildTaskPayload({ status: 'todo' }, file);
		expect(payload).not.toHaveProperty('notes');
	});

	it('maps done status to completed', () => {
		const file = makeFile('note', 'note.md');
		const payload = buildTaskPayload({ status: 'done' }, file);
		expect(payload.status).toBe('completed');
	});
});

describe('taskMatchesPayload', () => {
	const base = { title: 'Buy milk', status: 'needsAction' as const, due: '2025-06-15T00:00:00.000Z' };

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

	it('returns false when due date differs', () => {
		const task = { id: 't1', ...base };
		expect(taskMatchesPayload(task, { ...base, due: '2025-07-01T00:00:00.000Z' })).toBe(false);
	});

	it('returns true when both sides have no due', () => {
		const task = { id: 't1', title: 'Buy milk', status: 'needsAction' as const };
		const payload = { title: 'Buy milk', status: 'needsAction' as const };
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

// ---------------------------------------------------------------------------
// resolveField — all six resolution cases
// ---------------------------------------------------------------------------

describe('resolveField', () => {
	it('skip: local equals sentinel and Google equals sentinel', () => {
		const result = resolveField('A', 'A', 'A', 'google-wins');
		expect(result).toEqual({ action: 'skip', value: 'A' });
	});

	it('push: local changed, Google did not', () => {
		const result = resolveField('B', 'A', 'A', 'google-wins');
		expect(result).toEqual({ action: 'push', value: 'B' });
	});

	it('pull: Google changed, local did not', () => {
		const result = resolveField('A', 'B', 'A', 'google-wins');
		expect(result).toEqual({ action: 'pull', value: 'B' });
	});

	it('pull (agree): both changed to the same value', () => {
		const result = resolveField('B', 'B', 'A', 'google-wins');
		expect(result).toEqual({ action: 'pull', value: 'B' });
	});

	it('conflict google-wins: both changed to different values, strategy google-wins', () => {
		const result = resolveField('local-new', 'google-new', 'original', 'google-wins');
		expect(result).toEqual({ action: 'pull', value: 'google-new' });
	});

	it('conflict local-wins: both changed to different values, strategy local-wins', () => {
		const result = resolveField('local-new', 'google-new', 'original', 'local-wins');
		expect(result).toEqual({ action: 'push', value: 'local-new' });
	});

	it('null sentinel (first sync): treats sentinel as equal to local → skip', () => {
		// local and google both equal to each other, sentinel null → local treated as sentinel
		const result = resolveField('A', 'A', null, 'google-wins');
		expect(result).toEqual({ action: 'skip', value: 'A' });
	});

	it('null sentinel (first sync): Google differs from local → pull', () => {
		// null sentinel → sentinel = local = 'A'; google = 'B' → pull
		const result = resolveField('A', 'B', null, 'google-wins');
		expect(result).toEqual({ action: 'pull', value: 'B' });
	});

	it('works with null values for due dates', () => {
		const result = resolveField<string | null>(null, null, null, 'google-wins');
		expect(result).toEqual({ action: 'skip', value: null });
	});

	it('pull when Google added a due date and local has none', () => {
		const result = resolveField<string | null>(null, '2025-06-15', null, 'google-wins');
		expect(result).toEqual({ action: 'pull', value: '2025-06-15' });
	});
});
