import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listTasklists, resolveListId, createTask, updateTask, deleteTask, getTask, fetchAllTasks } from './client';
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
		headers: { get: () => null },
	} as unknown as Response));
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

describe('getTask', () => {
	it('GETs a single task by ID', async () => {
		const task: GoogleTask = { id: 'task-1', title: 'My Task', status: 'needsAction' };
		mockFetchOk(task);
		const result = await getTask(TOKEN, 'list-1', 'task-1');
		expect(result).toEqual(task);
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			expect.stringContaining('/tasks/task-1'),
			expect.any(Object)
		);
	});

	it('throws on API error', async () => {
		mockFetchError(404, 'Not Found');
		await expect(getTask(TOKEN, 'list-1', 'missing')).rejects.toThrow('404');
	});
});

describe('fetchAllTasks', () => {
	it('returns all tasks from a single page', async () => {
		const tasks: GoogleTask[] = [
			{ id: 'task-1', title: 'Task 1', status: 'needsAction' },
			{ id: 'task-2', title: 'Task 2', status: 'completed' },
		];
		mockFetchOk({ items: tasks });
		const result = await fetchAllTasks(TOKEN, 'list-1');
		expect(result.size).toBe(2);
		expect(result.get('task-1')).toEqual(tasks[0]);
		expect(result.get('task-2')).toEqual(tasks[1]);
	});

	it('paginates via nextPageToken until all tasks are collected', async () => {
		const page1: GoogleTask[] = [{ id: 'task-1', title: 'Task 1', status: 'needsAction' }];
		const page2: GoogleTask[] = [{ id: 'task-2', title: 'Task 2', status: 'completed' }];
		vi.stubGlobal('fetch', vi.fn()
			.mockResolvedValueOnce({
				ok: true, status: 200,
				json: async () => ({ items: page1, nextPageToken: 'token-abc' }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true, status: 200,
				json: async () => ({ items: page2 }),
			} as Response)
		);
		const result = await fetchAllTasks(TOKEN, 'list-1');
		expect(result.size).toBe(2);
		expect(result.has('task-1')).toBe(true);
		expect(result.has('task-2')).toBe(true);
		expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(2, expect.stringContaining('pageToken=token-abc'), expect.any(Object));
	});

	it('returns empty map when items is absent', async () => {
		mockFetchOk({});
		const result = await fetchAllTasks(TOKEN, 'list-1');
		expect(result.size).toBe(0);
	});

	it('includes showCompleted and showHidden in the request', async () => {
		mockFetchOk({ items: [] });
		await fetchAllTasks(TOKEN, 'list-1');
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			expect.stringMatching(/showCompleted=true.*showHidden=true|showHidden=true.*showCompleted=true/),
			expect.any(Object)
		);
	});
});

describe('apiFetch - rate limit handling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('retries after Retry-After header duration on 429', async () => {
		const task: GoogleTask = { id: 'task-1', title: 'My Task', status: 'needsAction' };
		vi.stubGlobal('fetch', vi.fn()
			.mockResolvedValueOnce({
				ok: false, status: 429,
				headers: { get: (h: string) => h === 'Retry-After' ? '2' : null },
				text: async () => 'rate limited',
			} as unknown as Response)
			.mockResolvedValueOnce({
				ok: true, status: 200,
				json: async () => task,
			} as Response)
		);

		const promise = getTask(TOKEN, 'list-1', 'task-1');
		await vi.advanceTimersByTimeAsync(2000);
		const result = await promise;

		expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
		expect(result).toEqual(task);
	});

	it('retries with exponential backoff when Retry-After header is absent on 429', async () => {
		const task: GoogleTask = { id: 'task-1', title: 'My Task', status: 'needsAction' };
		vi.stubGlobal('fetch', vi.fn()
			.mockResolvedValueOnce({
				ok: false, status: 429,
				headers: { get: () => null },
				text: async () => 'rate limited',
			} as unknown as Response)
			.mockResolvedValueOnce({
				ok: true, status: 200,
				json: async () => task,
			} as Response)
		);

		const promise = getTask(TOKEN, 'list-1', 'task-1');
		await vi.advanceTimersByTimeAsync(1000); // 2^0 * 1000ms backoff
		const result = await promise;

		expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
		expect(result).toEqual(task);
	});
});
