import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listTasklists, resolveListId, createTask, updateTask, deleteTask } from './client';
import { GoogleTask } from '../types';

vi.mock('obsidian');

const TOKEN = 'test-access-token';

function mockFetchOk(body: unknown, status = 200) {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
		ok: true,
		status,
		json: async () => body,
	} as Response));
}

function mockFetchError(status: number, text = 'error') {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
		ok: false,
		status,
		text: async () => text,
	} as Response));
}

describe('listTasklists', () => {
	it('returns task lists', async () => {
		mockFetchOk({ items: [{ id: 'list1', title: 'My Tasks' }] });
		const lists = await listTasklists(TOKEN);
		expect(lists).toEqual([{ id: 'list1', title: 'My Tasks' }]);
	});

	it('returns empty array when items is absent', async () => {
		mockFetchOk({});
		const lists = await listTasklists(TOKEN);
		expect(lists).toEqual([]);
	});

	it('throws on API error', async () => {
		mockFetchError(403, 'Forbidden');
		await expect(listTasklists(TOKEN)).rejects.toThrow('403');
	});
});

describe('resolveListId', () => {
	it('returns list ID for matching name', async () => {
		mockFetchOk({ items: [{ id: 'list-abc', title: 'Work' }] });
		const id = await resolveListId(TOKEN, 'Work');
		expect(id).toBe('list-abc');
	});

	it('throws when list not found', async () => {
		mockFetchOk({ items: [{ id: 'list-abc', title: 'Work' }] });
		await expect(resolveListId(TOKEN, 'NonExistent')).rejects.toThrow('"NonExistent" not found');
	});
});

describe('createTask', () => {
	it('POSTs task and returns created task', async () => {
		const created: GoogleTask = { id: 'task-1', title: 'Test Task', status: 'needsAction' };
		mockFetchOk(created);
		const result = await createTask(TOKEN, 'list-1', { title: 'Test Task', status: 'needsAction' });
		expect(result).toEqual(created);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			expect.stringContaining('/lists/list-1/tasks'),
			expect.objectContaining({ method: 'POST' })
		);
	});
});

describe('updateTask', () => {
	it('PUTs task and returns updated task', async () => {
		const updated: GoogleTask = { id: 'task-1', title: 'Updated', status: 'completed' };
		mockFetchOk(updated);
		const result = await updateTask(TOKEN, 'list-1', 'task-1', { title: 'Updated', status: 'completed' });
		expect(result).toEqual(updated);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			expect.stringContaining('/tasks/task-1'),
			expect.objectContaining({ method: 'PUT' })
		);
	});
});

describe('deleteTask', () => {
	it('DELETEs the task', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			status: 204,
		} as Response));
		await expect(deleteTask(TOKEN, 'list-1', 'task-1')).resolves.toBeUndefined();
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			expect.stringContaining('/tasks/task-1'),
			expect.objectContaining({ method: 'DELETE' })
		);
	});

	it('throws on API error', async () => {
		mockFetchError(404, 'Task not found');
		await expect(deleteTask(TOKEN, 'list-1', 'bad-id')).rejects.toThrow('404');
	});
});
