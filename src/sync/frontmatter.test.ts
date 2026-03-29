import { describe, it, expect, vi } from 'vitest';
import { readSyncMeta, writeSyncMeta, writeStatusSyncBack, writeTitleSyncBack, writeDueSyncBack } from './frontmatter';
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
	it('reads all sync meta fields from frontmatter', () => {
		const app = makeApp({
			'gtask-id': 'task-1',
			'gtask-list': 'My Tasks',
			'gtask-status': 'needsAction',
			'gtask-title': 'Buy milk',
			'gtask-due': '2025-06-15',
		});
		const meta = readSyncMeta(makeFile(), app);
		expect(meta).toEqual({
			taskId: 'task-1',
			listName: 'My Tasks',
			gtaskStatus: 'needsAction',
			gtaskTitle: 'Buy milk',
			gtaskDue: '2025-06-15',
		});
	});

	it('returns nulls when fields are absent', () => {
		const app = makeApp({});
		const meta = readSyncMeta(makeFile(), app);
		expect(meta).toEqual({ taskId: null, listName: null, gtaskStatus: null, gtaskTitle: null, gtaskDue: null });
	});

	it('returns nulls when cache has no frontmatter', () => {
		const app = {
			metadataCache: { getFileCache: vi.fn(() => null) },
			fileManager: {},
		} as unknown as App;
		const meta = readSyncMeta(makeFile(), app);
		expect(meta).toEqual({ taskId: null, listName: null, gtaskStatus: null, gtaskTitle: null, gtaskDue: null });
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
	it('sets all sync meta fields including gtask-title and gtask-due', async () => {
		const fm: Record<string, unknown> = {};
		const app = {
			metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: fm })) },
			fileManager: {
				processFrontMatter: vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					fn(fm);
				}),
			},
		} as unknown as App;

		await writeSyncMeta(makeFile(), app, 'task-xyz', 'Personal', 'needsAction', 'Buy milk', '2025-06-15');
		expect(fm['gtask-id']).toBe('task-xyz');
		expect(fm['gtask-list']).toBe('Personal');
		expect(fm['gtask-status']).toBe('needsAction');
		expect(fm['gtask-title']).toBe('Buy milk');
		expect(fm['gtask-due']).toBe('2025-06-15');
	});

	it('omits gtask-due when null', async () => {
		const fm: Record<string, unknown> = {};
		const app = {
			metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: fm })) },
			fileManager: {
				processFrontMatter: vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					fn(fm);
				}),
			},
		} as unknown as App;

		await writeSyncMeta(makeFile(), app, 'task-xyz', 'Personal', 'needsAction', 'Buy milk', null);
		expect(fm['gtask-due']).toBeUndefined();
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

describe('writeTitleSyncBack', () => {
	it('writes title and gtask-title to frontmatter', async () => {
		const fm: Record<string, unknown> = { title: 'Old Title', 'gtask-title': 'Old Title' };
		const app = {
			metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: fm })) },
			fileManager: {
				processFrontMatter: vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					fn(fm);
				}),
			},
		} as unknown as App;

		await writeTitleSyncBack(makeFile(), app, 'New Title');
		expect(fm['title']).toBe('New Title');
		expect(fm['gtask-title']).toBe('New Title');
	});
});

describe('writeDueSyncBack', () => {
	it('writes due and gtask-due to frontmatter', async () => {
		const fm: Record<string, unknown> = {};
		const app = {
			metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: fm })) },
			fileManager: {
				processFrontMatter: vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					fn(fm);
				}),
			},
		} as unknown as App;

		await writeDueSyncBack(makeFile(), app, '2025-06-15');
		expect(fm['due']).toBe('2025-06-15');
		expect(fm['gtask-due']).toBe('2025-06-15');
	});

	it('deletes due and gtask-due when null', async () => {
		const fm: Record<string, unknown> = { due: '2025-06-15', 'gtask-due': '2025-06-15' };
		const app = {
			metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: fm })) },
			fileManager: {
				processFrontMatter: vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					fn(fm);
				}),
			},
		} as unknown as App;

		await writeDueSyncBack(makeFile(), app, null);
		expect(fm['due']).toBeUndefined();
		expect(fm['gtask-due']).toBeUndefined();
	});
});
