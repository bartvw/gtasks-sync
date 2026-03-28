import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSyncCommand } from './sync-command';
import { App, Notice, TFile, getAllTags } from 'obsidian';
import GTasksSyncPlugin from '../main';

vi.mock('obsidian');
vi.mock('../google-tasks/client');
vi.mock('../google-tasks/field-mapper');
vi.mock('./frontmatter');

import * as client from '../google-tasks/client';
import * as fieldMapper from '../google-tasks/field-mapper';
import * as frontmatter from './frontmatter';

const mockNotice = vi.mocked(Notice);

function makeFile(fm: Record<string, unknown> = {}): TFile {
	return { basename: 'my-task', path: 'Tasks/my-task.md' } as unknown as TFile;
}

function makePlugin(options: {
	activeFile?: TFile | null;
	frontmatter?: Record<string, unknown>;
	settings?: Partial<{ clientId: string; defaultListName: string }>;
} = {}): GTasksSyncPlugin {
	const fm = options.frontmatter ?? { status: 'todo', title: 'My Task' };
	const file = options.activeFile !== undefined ? options.activeFile : makeFile(fm);

	return {
		app: {
			workspace: { getActiveFile: vi.fn(() => file) },
			metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: fm })) },
			vault: { getName: vi.fn(() => 'TestVault') },
			secretStorage: {
				getSecret: vi.fn(async () => 'client-secret'),
				setSecret: vi.fn(),
				deleteSecret: vi.fn(),
			},
		} as unknown as App,
		settings: {
			clientId: 'client-id',
			defaultListName: options.settings?.defaultListName ?? 'My Tasks',
			changeLog: { enabled: false, path: 'gtasks-sync-log.md' },
			...options.settings,
		},
	} as unknown as GTasksSyncPlugin;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getAllTags).mockReturnValue(['#task']);
	vi.mocked(client.getAccessToken).mockResolvedValue('access-token');
	vi.mocked(client.resolveListId).mockResolvedValue('list-id-123');
	vi.mocked(client.getTask).mockResolvedValue({ id: 'existing-id', title: 'My Task', status: 'needsAction' });
	vi.mocked(fieldMapper.buildTaskPayload).mockReturnValue({ title: 'My Task', status: 'needsAction', notes: 'obsidian://...' });
	vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: null, listName: null, gtaskStatus: null });
	vi.mocked(frontmatter.writeSyncMeta).mockResolvedValue(undefined);
	vi.mocked(frontmatter.writeStatusSyncBack).mockResolvedValue(undefined);
});

describe('runSyncCommand - no active file', () => {
	it('shows notice and returns when no active file', async () => {
		const plugin = makePlugin({ activeFile: null });
		await runSyncCommand(plugin);
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('No active file'));
		expect(client.getAccessToken).not.toHaveBeenCalled();
	});
});

describe('runSyncCommand - not a task note', () => {
	it('shows notice when note has no #task tag', async () => {
		vi.mocked(getAllTags).mockReturnValue([]);
		const plugin = makePlugin({ frontmatter: { title: 'Not a task' } });
		await runSyncCommand(plugin);
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('#task'));
		expect(client.getAccessToken).not.toHaveBeenCalled();
	});
});

describe('runSyncCommand - auth failure', () => {
	it('shows auth error notice', async () => {
		vi.mocked(client.getAccessToken).mockRejectedValue(new Error('Not authenticated'));
		const plugin = makePlugin();
		await runSyncCommand(plugin);
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('Auth error'));
	});
});

describe('runSyncCommand - list not found', () => {
	it('shows list error notice', async () => {
		vi.mocked(client.resolveListId).mockRejectedValue(new Error('"My Tasks" not found'));
		const plugin = makePlugin();
		await runSyncCommand(plugin);
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('List error'));
	});
});

describe('runSyncCommand - first push', () => {
	it('creates task and writes frontmatter', async () => {
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: null, listName: null, gtaskStatus: null });
		vi.mocked(client.createTask).mockResolvedValue({ id: 'new-task-id', title: 'My Task', status: 'needsAction' });

		const plugin = makePlugin();
		await runSyncCommand(plugin);

		expect(client.createTask).toHaveBeenCalledWith('access-token', 'list-id-123', expect.any(Object));
		expect(frontmatter.writeSyncMeta).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'new-task-id', 'My Tasks', 'needsAction');
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('created'));
	});
});

describe('runSyncCommand - update', () => {
	it('fetches current task then updates when task is active', async () => {
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(client.getTask).mockResolvedValue({ id: 'existing-id', title: 'My Task', status: 'needsAction' });
		vi.mocked(client.updateTask).mockResolvedValue({ id: 'existing-id', title: 'My Task', status: 'needsAction' });

		const plugin = makePlugin();
		await runSyncCommand(plugin);

		expect(client.getTask).toHaveBeenCalledWith('access-token', 'list-id-123', 'existing-id');
		expect(client.updateTask).toHaveBeenCalledWith('access-token', 'list-id-123', 'existing-id', expect.any(Object));
		expect(frontmatter.writeSyncMeta).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'existing-id', 'My Tasks', 'needsAction');
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('updated'));
	});

	it('syncs completion back when Google task is completed and gtask-status was needsAction', async () => {
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'needsAction' });
		vi.mocked(client.getTask).mockResolvedValue({ id: 'existing-id', title: 'My Task', status: 'completed' });

		const plugin = makePlugin();
		await runSyncCommand(plugin);

		expect(client.getTask).toHaveBeenCalled();
		expect(client.updateTask).not.toHaveBeenCalled();
		expect(frontmatter.writeStatusSyncBack).toHaveBeenCalled();
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('completed in Google Tasks'));
	});

	it('pushes local state when Google task is completed and gtask-status was already completed', async () => {
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: 'completed' });
		vi.mocked(client.getTask).mockResolvedValue({ id: 'existing-id', title: 'My Task', status: 'completed' });
		vi.mocked(client.updateTask).mockResolvedValue({ id: 'existing-id', title: 'My Task', status: 'completed' });

		const plugin = makePlugin();
		await runSyncCommand(plugin);

		expect(client.updateTask).toHaveBeenCalled();
		expect(frontmatter.writeStatusSyncBack).not.toHaveBeenCalled();
	});

	it('shows error when getTask fails', async () => {
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'existing-id', listName: 'My Tasks', gtaskStatus: null });
		vi.mocked(client.getTask).mockRejectedValue(new Error('Task not found'));

		const plugin = makePlugin();
		await runSyncCommand(plugin);

		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('Sync failed'));
		expect(client.updateTask).not.toHaveBeenCalled();
	});
});

describe('runSyncCommand - list move', () => {
	it('creates in new list, deletes from old list', async () => {
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'old-task-id', listName: 'Old List', gtaskStatus: null });
		vi.mocked(client.createTask).mockResolvedValue({ id: 'new-task-id', title: 'My Task', status: 'needsAction' });
		vi.mocked(client.resolveListId)
			.mockResolvedValueOnce('new-list-id') // for new list
			.mockResolvedValueOnce('old-list-id'); // for old list
		vi.mocked(client.deleteTask).mockResolvedValue(undefined);

		const plugin = makePlugin({ settings: { defaultListName: 'New List' } });
		await runSyncCommand(plugin);

		expect(client.createTask).toHaveBeenCalledWith('access-token', 'new-list-id', expect.any(Object));
		expect(frontmatter.writeSyncMeta).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'new-task-id', 'New List', 'needsAction');
		expect(client.deleteTask).toHaveBeenCalledWith('access-token', 'old-list-id', 'old-task-id');
		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('moved'));
	});

	it('shows warning when delete from old list fails', async () => {
		vi.mocked(frontmatter.readSyncMeta).mockReturnValue({ taskId: 'old-task-id', listName: 'Old List', gtaskStatus: null });
		vi.mocked(client.createTask).mockResolvedValue({ id: 'new-task-id', title: 'My Task', status: 'needsAction' });
		vi.mocked(client.resolveListId)
			.mockResolvedValueOnce('new-list-id')
			.mockRejectedValueOnce(new Error('old list not found'));

		const plugin = makePlugin({ settings: { defaultListName: 'New List' } });
		await runSyncCommand(plugin);

		expect(mockNotice).toHaveBeenCalledWith(expect.stringContaining('Warning'));
	});
});
