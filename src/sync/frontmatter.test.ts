import { describe, it, expect, vi } from 'vitest';
import { readSyncMeta, writeSyncMeta, writeStatusSyncBack } from './frontmatter';
import { App, TFile } from 'obsidian';

vi.mock('obsidian');

function makeFile(): TFile {
	return {} as unknown as TFile;
}

function makeApp(frontmatter: Record<string, unknown> = {}): App {
	const fm = { ...frontmatter };
	return {
		metadataCache: {
			getFileCache: vi.fn(() => ({ frontmatter: fm })),
		},
		fileManager: {
			processFrontMatter: vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
				fn(fm);
			}),
		},
	} as unknown as App;
}

describe('readSyncMeta', () => {
	it('reads gtask-id, gtask-list, and gtask-status from frontmatter', () => {
		const app = makeApp({ 'gtask-id': 'task-1', 'gtask-list': 'My Tasks', 'gtask-status': 'needsAction' });
		const meta = readSyncMeta(makeFile(), app);
		expect(meta).toEqual({ taskId: 'task-1', listName: 'My Tasks', gtaskStatus: 'needsAction' });
	});

	it('returns nulls when fields are absent', () => {
		const app = makeApp({});
		const meta = readSyncMeta(makeFile(), app);
		expect(meta).toEqual({ taskId: null, listName: null, gtaskStatus: null });
	});

	it('returns nulls when cache has no frontmatter', () => {
		const app = {
			metadataCache: { getFileCache: vi.fn(() => null) },
			fileManager: {},
		} as unknown as App;
		const meta = readSyncMeta(makeFile(), app);
		expect(meta).toEqual({ taskId: null, listName: null, gtaskStatus: null });
	});

	it('returns null gtaskStatus for invalid status values', () => {
		const app = makeApp({ 'gtask-status': 'invalid' });
		const meta = readSyncMeta(makeFile(), app);
		expect(meta.gtaskStatus).toBeNull();
	});

	it('reads completed gtaskStatus', () => {
		const app = makeApp({ 'gtask-status': 'completed' });
		const meta = readSyncMeta(makeFile(), app);
		expect(meta.gtaskStatus).toBe('completed');
	});
});

describe('writeSyncMeta', () => {
	it('calls processFrontMatter with correct values', async () => {
		const app = makeApp({});
		const file = makeFile();
		await writeSyncMeta(file, app, 'task-abc', 'Work', 'needsAction');
		expect(app.fileManager.processFrontMatter).toHaveBeenCalledWith(file, expect.any(Function));
	});

	it('sets gtask-id, gtask-list, and gtask-status in frontmatter', async () => {
		const fm: Record<string, unknown> = {};
		const app = {
			metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: fm })) },
			fileManager: {
				processFrontMatter: vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					fn(fm);
				}),
			},
		} as unknown as App;

		await writeSyncMeta(makeFile(), app, 'task-xyz', 'Personal', 'needsAction');
		expect(fm['gtask-id']).toBe('task-xyz');
		expect(fm['gtask-list']).toBe('Personal');
		expect(fm['gtask-status']).toBe('needsAction');
	});
});

describe('writeStatusSyncBack', () => {
	it('sets status to done and gtask-status to completed', async () => {
		const fm: Record<string, unknown> = { status: 'todo', 'gtask-status': 'needsAction' };
		const app = {
			metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: fm })) },
			fileManager: {
				processFrontMatter: vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					fn(fm);
				}),
			},
		} as unknown as App;

		await writeStatusSyncBack(makeFile(), app);
		expect(fm['status']).toBe('done');
		expect(fm['gtask-status']).toBe('completed');
	});
});
