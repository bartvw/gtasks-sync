/**
 * Integration tests for the Google Tasks API client against the live API.
 *
 * Requires environment variables:
 *   GTASKS_CLIENT_ID     — OAuth 2.0 Client ID
 *   GTASKS_CLIENT_SECRET — OAuth 2.0 Client Secret
 *   GTASKS_REFRESH_TOKEN — A valid refresh token
 *   GTASKS_LIST_NAME     — Name of the list to use for tests (default: "My Tasks")
 *
 * Run with:
 *   GTASKS_CLIENT_ID=... GTASKS_CLIENT_SECRET=... GTASKS_REFRESH_TOKEN=... \
 *     npx vitest run src/integration/client.integration.test.ts --reporter=verbose
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { refreshAccessToken } from '../auth/oauth';
import {
	listTasklists,
	resolveListId,
	createTask,
	updateTask,
	deleteTask,
} from '../google-tasks/client';

const {
	GTASKS_CLIENT_ID,
	GTASKS_CLIENT_SECRET,
	GTASKS_REFRESH_TOKEN,
	GTASKS_LIST_NAME = 'My Tasks',
} = process.env;

const SKIP = !GTASKS_CLIENT_ID || !GTASKS_CLIENT_SECRET || !GTASKS_REFRESH_TOKEN;

let accessToken: string;
let listId: string;

beforeAll(async () => {
	if (SKIP) return;
	const tokens = await refreshAccessToken(
		GTASKS_REFRESH_TOKEN!,
		GTASKS_CLIENT_ID!,
		GTASKS_CLIENT_SECRET!
	);
	accessToken = tokens.accessToken;
	listId = await resolveListId(accessToken, GTASKS_LIST_NAME);
});

describe.skipIf(SKIP)('Google Tasks API client (live)', () => {
	it('lists task lists', async () => {
		const lists = await listTasklists(accessToken);
		expect(lists.length).toBeGreaterThan(0);
		expect(lists.some(l => l.title === GTASKS_LIST_NAME)).toBe(true);
	});

	it('creates, updates, and deletes a task', async () => {
		const created = await createTask(accessToken, listId, {
			title: '[gtasks-sync integration test]',
			status: 'needsAction',
		});
		expect(created.id).toBeTruthy();

		const updated = await updateTask(accessToken, listId, created.id!, {
			title: '[gtasks-sync integration test] — updated',
			status: 'completed',
		});
		expect(updated.status).toBe('completed');

		await deleteTask(accessToken, listId, created.id!);
	});
});
