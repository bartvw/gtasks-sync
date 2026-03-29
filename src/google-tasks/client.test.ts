import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listTasklists, resolveListId, createTask, updateTask, deleteTask, getTask, fetchAllTasks } from './client';
import { GoogleTask } from '../types';
import { requestUrl } from 'obsidian';

vi.mock('obsidian');

const TOKEN = 'test-access-token';

function mockRequestUrlOk(body: unknown, status = 200) {
	vi.mocked(requestUrl).mockResolvedValue({
		status,
		json: body,
		text: '',
		headers: {},
	} as any);
}

function mockRequestUrlError(status: number, text = 'error') {
	vi.mocked(requestUrl).mockResolvedValue({
		status,
		json: {},
		text,
		headers: {},
	} as any);
}

beforeEach(() => {
	vi.mocked(requestUrl).mockReset();
});

describe('listTasklists', () => {
	it('returns task lists', async () => {
		mockRequestUrlOk({ items: [{ id: 'list1', title: 'My Tasks' }] });
		const lists = await listTasklists(TOKEN);
		expect(lists).toEqual([{ id: 'list1', title: 'My Tasks' }]);
	});

	it('returns empty array when items is absent', async () => {
		mockRequestUrlOk({});
		const lists = await listTasklists(TOKEN);
		expect(lists).toEqual([]);
	});

	it('throws on API error', async () => {
		mockRequestUrlError(403, 'Forbidden');
		await expect(listTasklists(TOKEN)).rejects.toThrow('403');
	});
});

describe('resolveListId', () => {
	it('returns list ID for matching name', async () => {
		mockRequestUrlOk({ items: [{ id: 'list-abc', title: 'Work' }] });
		const id = await resolveListId(TOKEN, 'Work');
		expect(id).toBe('list-abc');
	});

	it('throws when list not found', async () => {
		mockRequestUrlOk({ items: [{ id: 'list-abc', title: 'Work' }] });
		await expect(resolveListId(TOKEN, 'NonExistent')).rejects.toThrow('"NonExistent" not found');
	});
});

describe('createTask', () => {
	it('POSTs task and returns created task', async () => {
		const created: GoogleTask = { id: 'task-1', title: 'Test Task', status: 'needsAction' };
		mockRequestUrlOk(created);
		const result = await createTask(TOKEN, 'list-1', { title: 'Test Task', status: 'needsAction' });
		expect(result).toEqual(created);
		expect(vi.mocked(requestUrl)).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.stringContaining('/lists/list-1/tasks'), method: 'POST' })
		);
	});
});

describe('updateTask', () => {
	it('PUTs task and returns updated task', async () => {
		const updated: GoogleTask = { id: 'task-1', title: 'Updated', status: 'completed' };
		mockRequestUrlOk(updated);
		const result = await updateTask(TOKEN, 'list-1', 'task-1', { title: 'Updated', status: 'completed' });
		expect(result).toEqual(updated);
		expect(vi.mocked(requestUrl)).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.stringContaining('/tasks/task-1'), method: 'PUT' })
		);
	});
});

describe('deleteTask', () => {
	it('DELETEs the task', async () => {
		vi.mocked(requestUrl).mockResolvedValue({ status: 204, json: {}, text: '', headers: {} } as any);
		await expect(deleteTask(TOKEN, 'list-1', 'task-1')).resolves.toBeUndefined();
		expect(vi.mocked(requestUrl)).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.stringContaining('/tasks/task-1'), method: 'DELETE' })
		);
	});

	it('throws on API error', async () => {
		mockRequestUrlError(404, 'Task not found');
		await expect(deleteTask(TOKEN, 'list-1', 'bad-id')).rejects.toThrow('404');
	});
});

describe('getTask', () => {
	it('GETs a single task by ID', async () => {
		const task: GoogleTask = { id: 'task-1', title: 'My Task', status: 'needsAction' };
		mockRequestUrlOk(task);
		const result = await getTask(TOKEN, 'list-1', 'task-1');
		expect(result).toEqual(task);
		expect(vi.mocked(requestUrl)).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.stringContaining('/tasks/task-1') })
		);
	});

	it('throws on API error', async () => {
		mockRequestUrlError(404, 'Not Found');
		await expect(getTask(TOKEN, 'list-1', 'missing')).rejects.toThrow('404');
	});
});

describe('fetchAllTasks', () => {
	it('returns all tasks from a single page', async () => {
		const tasks: GoogleTask[] = [
			{ id: 'task-1', title: 'Task 1', status: 'needsAction' },
			{ id: 'task-2', title: 'Task 2', status: 'completed' },
		];
		mockRequestUrlOk({ items: tasks });
		const result = await fetchAllTasks(TOKEN, 'list-1');
		expect(result.size).toBe(2);
		expect(result.get('task-1')).toEqual(tasks[0]);
		expect(result.get('task-2')).toEqual(tasks[1]);
	});

	it('paginates via nextPageToken until all tasks are collected', async () => {
		const page1: GoogleTask[] = [{ id: 'task-1', title: 'Task 1', status: 'needsAction' }];
		const page2: GoogleTask[] = [{ id: 'task-2', title: 'Task 2', status: 'completed' }];
		vi.mocked(requestUrl)
			.mockResolvedValueOnce({ status: 200, json: { items: page1, nextPageToken: 'token-abc' }, text: '', headers: {} } as any)
			.mockResolvedValueOnce({ status: 200, json: { items: page2 }, text: '', headers: {} } as any);
		const result = await fetchAllTasks(TOKEN, 'list-1');
		expect(result.size).toBe(2);
		expect(result.has('task-1')).toBe(true);
		expect(result.has('task-2')).toBe(true);
		expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(requestUrl)).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: expect.stringContaining('pageToken=token-abc') }));
	});

	it('returns empty map when items is absent', async () => {
		mockRequestUrlOk({});
		const result = await fetchAllTasks(TOKEN, 'list-1');
		expect(result.size).toBe(0);
	});

	it('includes showCompleted and showHidden in the request', async () => {
		mockRequestUrlOk({ items: [] });
		await fetchAllTasks(TOKEN, 'list-1');
		expect(vi.mocked(requestUrl)).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.stringMatching(/showCompleted=true.*showHidden=true|showHidden=true.*showCompleted=true/) })
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
		vi.mocked(requestUrl)
			.mockResolvedValueOnce({ status: 429, json: {}, text: 'rate limited', headers: { 'retry-after': '2' } } as any)
			.mockResolvedValueOnce({ status: 200, json: task, text: '', headers: {} } as any);

		const promise = getTask(TOKEN, 'list-1', 'task-1');
		await vi.advanceTimersByTimeAsync(2000);
		const result = await promise;

		expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(2);
		expect(result).toEqual(task);
	});

	it('retries with exponential backoff when Retry-After header is absent on 429', async () => {
		const task: GoogleTask = { id: 'task-1', title: 'My Task', status: 'needsAction' };
		vi.mocked(requestUrl)
			.mockResolvedValueOnce({ status: 429, json: {}, text: 'rate limited', headers: {} } as any)
			.mockResolvedValueOnce({ status: 200, json: task, text: '', headers: {} } as any);

		const promise = getTask(TOKEN, 'list-1', 'task-1');
		await vi.advanceTimersByTimeAsync(1000); // 2^0 * 1000ms backoff
		const result = await promise;

		expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(2);
		expect(result).toEqual(task);
	});
});
