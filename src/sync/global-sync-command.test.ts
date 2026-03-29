import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGlobalSyncCommand, runDryRunCommand } from './global-sync-command';
import { App, Notice, TFile, getAllTags } from 'obsidian';
import GTasksSyncPlugin from '../main';
import { GoogleTask } from '../types';

// 'obsidian' is resolved via alias to src/__mocks__/obsidian.ts which exports
// real vi.fn() stubs — no vi.mock('obsidian') needed (auto-mocking it breaks Modal inheritance).
vi.mock('../google-tasks/client');
vi.mock('../google-tasks/field-mapper');
vi.mock('./frontmatter');
vi.mock('./note-importer');

import * as client from '../google-tasks/client';
import * as fieldMapper from '../google-tasks/field-mapper';
// taskMatchesPayload is auto-mocked; default is set in beforeEach
import * as frontmatter from './frontmatter';
import * as noteImporter from './note-importer';

// writeStatusUndone and writeGtaskStatusOnly are auto-mocked via vi.mock('./frontmatter')

const mockNotice = vi.mocked(Notice);

function makeFile(name: string, path?: string): TFile {
	return { basename: name, path: path ?? `Tasks/${name}.md`, name: `${name}.md` } as unknown as TFile;
}

function makePlugin(options: {
	markdownFiles?: TFile[];
	getFrontmatter?: (file: TFile) => Record<string, unknown>;
	settings?: Partial<{
		defaultListName: string;
		importFromGoogle: { enabled: boolean; folder: string; defaultStatus: string };
	}>;
} = {}): GTasksSyncPlugin {
	const files = options.markdownFiles ?? [];
	const getFm = options.getFrontmatter ?? (() => ({ status: 'todo', title: 'Task' }));

	return {
		app: {
			vault: { getMarkdownFiles: vi.fn(() => files), getName: vi.fn(() => 'TestVault') },
			metadataCache: {
				getFileCache: vi.fn((file: TFile) => ({ frontmatter: getFm(file) })),
			},
		} as unknown as App,
		settings: {
			clientId: 'client-id',
			defaultListName: options.settings?.defaultListName ?? 'My Tasks',
			changeLog: { enabled: false, path: 'gtasks-sync-log.md' },
			importFromGoogle: options.settings?.importFromGoogle ?? {
				enabled: false,
				folder: '',
				defaultStatus: 'open',
			},
		},
	} as unknown as GTasksSyncPlugin;
}

function makeGoogleTask(id: string, status: 'needsAction' | 'completed' = 'needsAction'): GoogleTask {
	return { id, title: 'Task', status };
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getAllTags).mockReturnValue(['#task']);
	vi.mocked(client.getAccessToken).mockResolvedValue('access-token');
	vi.mocked(client.resolveListId).mockResolvedValue('list-id-123');
	vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map());
	vi.mocked(client.createTask).mockResolvedValue({ id: 'new-id', title: 'Task', status: 'needsAction' });
	vi.mocked(client.updateTask).mockResolvedValue({ id: 'existing-id', title: 'Task', status: 'needsAction' });
	vi.mocked(fieldMapper.buildTaskPayload).mockReturnValue({ title: 'Task', status: 'needsAction', notes: 'obsidian://...' });
	vi.mocked(fieldMapper.taskMatchesPayload).mockReturnValue(false);
	vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: null, listName: null, gtaskStatus: null });
	vi.mocked(frontmatter.writeSyncMeta).mockResolvedValue(undefined);
	vi.mocked(frontmatter.writeStatusSyncBack).mockResolvedValue(undefined);
	vi.mocked(frontmatter.writeStatusUndone).mockResolvedValue(undefined);
	vi.mocked(frontmatter.writeGtaskStatusOnly).mockResolvedValue(undefined);
	vi.mocked(frontmatter.readNoteBody).mockResolvedValue('');
	vi.mocked(fieldMapper.extractBodyFromGoogleNotes).mockReturnValue('');
	vi.mocked(noteImporter.createNoteFromGoogleTask).mockResolvedValue({ basename: 'Orphan Task' } as unknown as import('obsidian').TFile);
});

// ---------------------------------------------------------------------------
// Note discovery
// ---------------------------------------------------------------------------

describe('runGlobalSyncCommand - note discovery', () => {
	it('shows notice and exits when no #task notes are found', async () => {
		vi.mocked(getAllTags).mockReturnValue([]);
		const plugin = makePlugin({ markdownFiles: [makeFile('plain-note')] });
		await runGlobalSyncCommand(plugin);
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('No task notes'));
		expect(client.fetchAllTasks).not.toHaveBeenCalled();
	});

	it('does not open a modal when no task notes found', async () => {
		vi.mocked(getAllTags).mockReturnValue([]);
		const plugin = makePlugin({ markdownFiles: [makeFile('note')] });
		await runGlobalSyncCommand(plugin);
		expect(client.getAccessToken).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Auth / fetch failures
// ---------------------------------------------------------------------------

describe('runGlobalSyncCommand - failures', () => {
	it('aborts with auth error notice', async () => {
		vi.mocked(client.getAccessToken).mockRejectedValue(new Error('Not authenticated'));
		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('Auth error'));
		expect(client.fetchAllTasks).not.toHaveBeenCalled();
	});

	it('aborts with list error notice', async () => {
		vi.mocked(client.resolveListId).mockRejectedValue(new Error('List not found'));
		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('List error'));
		expect(client.fetchAllTasks).not.toHaveBeenCalled();
	});

	it('aborts when fetchAllTasks fails', async () => {
		vi.mocked(client.fetchAllTasks).mockRejectedValue(new Error('Network error'));
		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch'));
		expect(client.createTask).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Reconciliation logic
// ---------------------------------------------------------------------------

describe('runGlobalSyncCommand - reconciliation', () => {
	it('creates a task for an active note with no gtask-id', async () => {
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: null, listName: null, gtaskStatus: null });
		const plugin = makePlugin({ markdownFiles: [makeFile('active-task')] });
		await runGlobalSyncCommand(plugin);
		expect(client.createTask).toHaveBeenCalledWith('access-token', 'list-id-123', expect.any(Object));
		expect(frontmatter.writeSyncMeta).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'new-id', 'My Tasks', 'needsAction');
	});

	it('skips a done note with no gtask-id', async () => {
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: null, listName: null, gtaskStatus: null });
		const plugin = makePlugin({
			markdownFiles: [makeFile('done-task')],
			getFrontmatter: () => ({ status: 'done' }),
		});
		await runGlobalSyncCommand(plugin);
		expect(client.createTask).not.toHaveBeenCalled();
		expect(frontmatter.writeSyncMeta).not.toHaveBeenCalled();
	});

	it('updates an existing task when gtask-id is in the active map', async () => {
		const activeTask = makeGoogleTask('existing-id');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', activeTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).toHaveBeenCalledWith('access-token', 'list-id-123', 'existing-id', expect.any(Object));
		expect(frontmatter.writeSyncMeta).toHaveBeenCalled();
	});

	it('writes status done when gtask-id is in completed map and note is active', async () => {
		const completedTask = makeGoogleTask('existing-id', 'completed');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', completedTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			getFrontmatter: () => ({ status: 'todo' }),
		});
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).not.toHaveBeenCalled();
		expect(frontmatter.writeStatusSyncBack).toHaveBeenCalled();
	});

	it('skips when gtask-id is in completed map and note is done', async () => {
		const completedTask = makeGoogleTask('existing-id', 'completed');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', completedTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'completed' });
		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			getFrontmatter: () => ({ status: 'done' }),
		});
		await runGlobalSyncCommand(plugin);
		expect(client.createTask).not.toHaveBeenCalled();
		expect(client.updateTask).not.toHaveBeenCalled();
		expect(frontmatter.writeStatusSyncBack).not.toHaveBeenCalled();
	});

	it('recreates a task when gtask-id is not found in either map and note is active', async () => {
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map()); // empty — task was deleted
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'deleted-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);
		expect(client.createTask).toHaveBeenCalled();
		expect(frontmatter.writeSyncMeta).toHaveBeenCalled();
	});

	it('skips when gtask-id is not found in either map and note is done', async () => {
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map());
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'deleted-id', listName: 'My Tasks', gtaskStatus: null });
		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			getFrontmatter: () => ({ status: 'done' }),
		});
		await runGlobalSyncCommand(plugin);
		expect(client.createTask).not.toHaveBeenCalled();
	});

	it('skips when gtask-id is in active map and payload matches remote task', async () => {
		const activeTask = makeGoogleTask('existing-id');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', activeTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(fieldMapper.taskMatchesPayload).mockReturnValue(true);
		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).not.toHaveBeenCalled();
		expect(frontmatter.writeSyncMeta).not.toHaveBeenCalled();
	});

	it('updates when gtask-id is in active map and title differs', async () => {
		const activeTask = makeGoogleTask('existing-id');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', activeTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(fieldMapper.taskMatchesPayload).mockReturnValue(false);
		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).toHaveBeenCalledWith('access-token', 'list-id-123', 'existing-id', expect.any(Object));
	});

	it('updates when gtask-id is in active map and status differs', async () => {
		const activeTask = makeGoogleTask('existing-id');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', activeTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(fieldMapper.taskMatchesPayload).mockReturnValue(false);
		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			getFrontmatter: () => ({ status: 'done', title: 'Task' }),
		});
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).toHaveBeenCalledWith('access-token', 'list-id-123', 'existing-id', expect.any(Object));
	});

	it('updates when gtask-id is in active map and due date differs', async () => {
		const activeTask = { ...makeGoogleTask('existing-id'), due: '2025-01-01T00:00:00.000Z' };
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', activeTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(fieldMapper.taskMatchesPayload).mockReturnValue(false);
		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).toHaveBeenCalledWith('access-token', 'list-id-123', 'existing-id', expect.any(Object));
	});

	// 4.1 Task un-completed in Google (now active), note is done → mark-undone
	it('writes status open when gtask-id is in active map, gtask-status was completed, and note is done', async () => {
		const activeTask = makeGoogleTask('existing-id', 'needsAction');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', activeTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'completed' });
		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			getFrontmatter: () => ({ status: 'done' }),
		});
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).not.toHaveBeenCalled();
		expect(frontmatter.writeStatusUndone).toHaveBeenCalled();
		expect(frontmatter.writeStatusSyncBack).not.toHaveBeenCalled();
	});

	// 4.2 Task un-completed in Google (now active), note is already active → sync-meta (needsAction)
	it('updates only gtask-status when gtask-id is in active map, gtask-status was completed, and note is active', async () => {
		const activeTask = makeGoogleTask('existing-id', 'needsAction');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', activeTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'completed' });
		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			getFrontmatter: () => ({ status: 'todo' }),
		});
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).not.toHaveBeenCalled();
		expect(frontmatter.writeStatusUndone).not.toHaveBeenCalled();
		expect(frontmatter.writeGtaskStatusOnly).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'needsAction');
	});

	// 4.3 Task completed in Google, note is already done, gtask-status was needsAction → sync-meta (completed)
	it('updates only gtask-status when gtask-id is in completed map, gtask-status was needsAction, and note is done', async () => {
		const completedTask = makeGoogleTask('existing-id', 'completed');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', completedTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			getFrontmatter: () => ({ status: 'done' }),
		});
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).not.toHaveBeenCalled();
		expect(frontmatter.writeStatusSyncBack).not.toHaveBeenCalled();
		expect(frontmatter.writeGtaskStatusOnly).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'completed');
	});

	// 4.4 gtask-status is null, task is active in Google, note is done → falls back to update (existing behavior)
	it('falls back to update when gtask-status is null, task is active in Google, and note is done', async () => {
		const activeTask = makeGoogleTask('existing-id', 'needsAction');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', activeTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: null });
		vi.mocked(fieldMapper.taskMatchesPayload).mockReturnValue(false);
		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			getFrontmatter: () => ({ status: 'done' }),
		});
		await runGlobalSyncCommand(plugin);
		expect(client.updateTask).toHaveBeenCalledWith('access-token', 'list-id-123', 'existing-id', expect.any(Object));
		expect(frontmatter.writeStatusUndone).not.toHaveBeenCalled();
		expect(frontmatter.writeGtaskStatusOnly).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Dry-run counts
// ---------------------------------------------------------------------------

describe('runDryRunCommand - counts', () => {
	it('shows notice when no task notes found', async () => {
		vi.mocked(getAllTags).mockReturnValue([]);
		const plugin = makePlugin({ markdownFiles: [makeFile('note')] });
		await runDryRunCommand(plugin);
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('No task notes'));
	});

	it('counts each reconciliation action correctly', async () => {
		const activeTask = makeGoogleTask('active-id');
		const completedTask = makeGoogleTask('completed-id', 'completed');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([
			['active-id', activeTask],
			['completed-id', completedTask],
		]));

		const files = [
			makeFile('new-active'),       // no gtask-id, active → create
			makeFile('new-done'),         // no gtask-id, done → skip
			makeFile('existing-active'),  // active-id in active map → update
			makeFile('remote-done'),      // completed-id in completed map, note active → mark-done
			makeFile('deleted-active'),   // missing-id not in map, active → recreate
		];

		const readSyncMetaMock = vi.mocked(frontmatter.readSyncMeta);
		readSyncMetaMock
			.mockReturnValueOnce({ taskId: null, listName: null, gtaskStatus: null })           // new-active
			.mockReturnValueOnce({ taskId: null, listName: null, gtaskStatus: null })           // new-done
			.mockReturnValueOnce({ taskId: 'active-id', listName: 'My Tasks', gtaskStatus: 'needsAction' })  // existing-active
			.mockReturnValueOnce({ taskId: 'completed-id', listName: 'My Tasks', gtaskStatus: 'needsAction' }) // remote-done
			.mockReturnValueOnce({ taskId: 'missing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' }); // deleted-active

		const getFm = (file: TFile): Record<string, unknown> => {
			if (file.basename === 'new-done') return { status: 'done' };
			return { status: 'todo' };
		};

		const plugin = makePlugin({ markdownFiles: files, getFrontmatter: getFm });
		await runDryRunCommand(plugin);

		// Dry-run should NOT make any API writes
		expect(client.createTask).not.toHaveBeenCalled();
		expect(client.updateTask).not.toHaveBeenCalled();
		expect(frontmatter.writeSyncMeta).not.toHaveBeenCalled();
		expect(frontmatter.writeStatusSyncBack).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Import pass — orphan detection (8.6)
// ---------------------------------------------------------------------------

describe('runGlobalSyncCommand - import pass', () => {
	function makeGoogleTask(id: string, status: 'needsAction' | 'completed' = 'needsAction'): GoogleTask {
		return { id, title: 'Orphan Task', status };
	}

	it('imports orphan active tasks when import is enabled and folder is set', async () => {
		const orphanTask = makeGoogleTask('orphan-id');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['orphan-id', orphanTask]]));
		// Note has a different gtask-id so orphan-id is never "seen"
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'other-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });

		const plugin = makePlugin({
			markdownFiles: [makeFile('some-task')],
			settings: {
				importFromGoogle: { enabled: true, folder: 'Imported', defaultStatus: 'open' },
			},
		});

		await runGlobalSyncCommand(plugin);
		expect(noteImporter.createNoteFromGoogleTask).toHaveBeenCalledWith(
			orphanTask,
			'My Tasks',
			expect.anything(),
			expect.anything()
		);
	});

	it('does not import when import is disabled', async () => {
		const orphanTask = makeGoogleTask('orphan-id');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['orphan-id', orphanTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: null, listName: null, gtaskStatus: null });

		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			settings: {
				importFromGoogle: { enabled: false, folder: 'Imported', defaultStatus: 'open' },
			},
		});

		await runGlobalSyncCommand(plugin);
		expect(noteImporter.createNoteFromGoogleTask).not.toHaveBeenCalled();
	});

	it('shows notice and skips import when folder is empty', async () => {
		const orphanTask = makeGoogleTask('orphan-id');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['orphan-id', orphanTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: null, listName: null, gtaskStatus: null });

		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			settings: {
				importFromGoogle: { enabled: true, folder: '', defaultStatus: 'open' },
			},
		});

		await runGlobalSyncCommand(plugin);
		expect(noteImporter.createNoteFromGoogleTask).not.toHaveBeenCalled();
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('Import folder not configured'));
	});

	it('does not import tasks already matched to vault notes', async () => {
		const seenTask = makeGoogleTask('seen-id');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['seen-id', seenTask]]));
		// The note has gtask-id: seen-id — it is "seen" in the reconciliation loop
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'seen-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(fieldMapper.taskMatchesPayload).mockReturnValue(true);

		const plugin = makePlugin({
			markdownFiles: [makeFile('seen-task')],
			settings: {
				importFromGoogle: { enabled: true, folder: 'Imported', defaultStatus: 'open' },
			},
		});

		await runGlobalSyncCommand(plugin);
		expect(noteImporter.createNoteFromGoogleTask).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Dry-run import count (8.7)
// ---------------------------------------------------------------------------

describe('runDryRunCommand - import count', () => {
	function makeGoogleTask(id: string): GoogleTask {
		return { id, title: 'Orphan Task', status: 'needsAction' };
	}

	it('includes import count in dry-run when import is enabled and orphans exist', async () => {
		const orphan1 = makeGoogleTask('orphan-1');
		const orphan2 = makeGoogleTask('orphan-2');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([
			['orphan-1', orphan1],
			['orphan-2', orphan2],
		]));
		// Note has no gtask-id so nothing is marked as seen
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: null, listName: null, gtaskStatus: null });

		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			settings: {
				importFromGoogle: { enabled: true, folder: 'Imported', defaultStatus: 'open' },
			},
		});

		await runDryRunCommand(plugin);
		// No notes should actually be created in dry-run
		expect(noteImporter.createNoteFromGoogleTask).not.toHaveBeenCalled();
	});

	it('does not include import count when import is disabled', async () => {
		const orphan = makeGoogleTask('orphan-1');
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['orphan-1', orphan]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: null, listName: null, gtaskStatus: null });

		const plugin = makePlugin({
			markdownFiles: [makeFile('task')],
			settings: {
				importFromGoogle: { enabled: false, folder: '', defaultStatus: 'open' },
			},
		});

		await runDryRunCommand(plugin);
		expect(noteImporter.createNoteFromGoogleTask).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Regression: remote body preserved when Obsidian note has no body
// ---------------------------------------------------------------------------

describe('runGlobalSyncCommand - remote notes body preservation', () => {
	it('passes remote body to buildTaskPayload when Obsidian note has no body', async () => {
		const remoteTask = { id: 'existing-id', title: 'Task', status: 'needsAction' as const, notes: 'user content\n\nobsidian://...' };
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', remoteTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(frontmatter.readNoteBody).mockResolvedValue('');
		vi.mocked(fieldMapper.extractBodyFromGoogleNotes).mockReturnValue('user content');

		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);

		expect(fieldMapper.buildTaskPayload).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.anything(),
			'user content'
		);
	});

	it('does not update when note has no body and remote body is preserved in payload', async () => {
		const remoteTask = { id: 'existing-id', title: 'Task', status: 'needsAction' as const, notes: 'user content\n\nobsidian://...' };
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', remoteTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(frontmatter.readNoteBody).mockResolvedValue('');
		vi.mocked(fieldMapper.extractBodyFromGoogleNotes).mockReturnValue('user content');
		// Payload built with preserved body matches remote → no update needed
		vi.mocked(fieldMapper.taskMatchesPayload).mockReturnValue(true);

		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);

		expect(client.updateTask).not.toHaveBeenCalled();
	});

	it('uses the Obsidian note body when present, ignoring remote body', async () => {
		const remoteTask = { id: 'existing-id', title: 'Task', status: 'needsAction' as const, notes: 'old remote content\n\nobsidian://...' };
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', remoteTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(frontmatter.readNoteBody).mockResolvedValue('local note body');

		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);

		expect(fieldMapper.buildTaskPayload).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.anything(),
			'local note body'
		);
		// extractBodyFromGoogleNotes should not be called when note has its own body
		expect(fieldMapper.extractBodyFromGoogleNotes).not.toHaveBeenCalled();
	});

	it('passes empty body when note has no body and remote task has no notes', async () => {
		const remoteTask = { id: 'existing-id', title: 'Task', status: 'needsAction' as const };
		vi.mocked(client.fetchAllTasks).mockResolvedValue(new Map([['existing-id', remoteTask]]));
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(frontmatter.readNoteBody).mockResolvedValue('');
		vi.mocked(fieldMapper.extractBodyFromGoogleNotes).mockReturnValue('');

		const plugin = makePlugin({ markdownFiles: [makeFile('task')] });
		await runGlobalSyncCommand(plugin);

		expect(fieldMapper.buildTaskPayload).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.anything(),
			''
		);
	});
});
