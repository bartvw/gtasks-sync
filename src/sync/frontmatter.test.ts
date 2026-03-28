import { describe, it, expect, vi } from 'vitest';
import { readSyncMeta, writeSyncMeta } from './frontmatter';
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
	it('reads gtask-id and gtask-list from frontmatter', () => {
		const app = makeApp({ 'gtask-id': 'task-1', 'gtask-list': 'My Tasks' });
		const meta = readSyncMeta(makeFile(), app);
		expect(meta).toEqual({ taskId: 'task-1', listName: 'My Tasks' });
	});

	it('returns nulls when fields are absent', () => {
		const app = makeApp({});
		const meta = readSyncMeta(makeFile(), app);
		expect(meta).toEqual({ taskId: null, listName: null });
	});

	it('returns nulls when cache has no frontmatter', () => {
		const app = {
			metadataCache: { getFileCache: vi.fn(() => null) },
			fileManager: {},
		} as unknown as App;
		const meta = readSyncMeta(makeFile(), app);
		expect(meta).toEqual({ taskId: null, listName: null });
	});
});

describe('writeSyncMeta', () => {
	it('calls processFrontMatter with correct values', async () => {
		const app = makeApp({});
		const file = makeFile();
		await writeSyncMeta(file, app, 'task-abc', 'Work');
		expect(app.fileManager.processFrontMatter).toHaveBeenCalledWith(file, expect.any(Function));
	});

	it('sets gtask-id and gtask-list in frontmatter', async () => {
		const fm: Record<string, unknown> = {};
		const app = {
			metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: fm })) },
			fileManager: {
				processFrontMatter: vi.fn(async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					fn(fm);
				}),
			},
		} as unknown as App;

		await writeSyncMeta(makeFile(), app, 'task-xyz', 'Personal');
		expect(fm['gtask-id']).toBe('task-xyz');
		expect(fm['gtask-list']).toBe('Personal');
	});
});
