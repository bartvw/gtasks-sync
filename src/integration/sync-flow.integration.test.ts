/**
 * Integration tests for the full sync command flow against the live Google Tasks API.
 *
 * Requires environment variables:
 *   GTASKS_CLIENT_ID     — OAuth 2.0 Client ID
 *   GTASKS_CLIENT_SECRET — OAuth 2.0 Client Secret
 *   GTASKS_REFRESH_TOKEN — A valid refresh token
 *   GTASKS_LIST_NAME     — Name of the list to use for tests (default: "My Tasks")
 *
 * Run with:
 *   GTASKS_CLIENT_ID=... GTASKS_CLIENT_SECRET=... GTASKS_REFRESH_TOKEN=... \
 *     npx vitest run src/integration/sync-flow.integration.test.ts --reporter=verbose
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { refreshAccessToken } from '../auth/oauth';
import { resolveListId, listTasklists, deleteTask } from '../google-tasks/client';
import { buildTaskPayload } from '../google-tasks/field-mapper';
import { createTask, updateTask } from '../google-tasks/client';
import { TFile } from 'obsidian';

const {
	GTASKS_CLIENT_ID,
	GTASKS_CLIENT_SECRET,
	GTASKS_REFRESH_TOKEN,
	GTASKS_LIST_NAME = 'My Tasks',
} = process.env;

const SKIP = !GTASKS_CLIENT_ID || !GTASKS_CLIENT_SECRET || !GTASKS_REFRESH_TOKEN;

let accessToken: string;
let listId: string;
let createdTaskId: string | undefined;

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

afterAll(async () => {
	if (SKIP || !createdTaskId) return;
	try {
		await deleteTask(accessToken, listId, createdTaskId);
	} catch {
		// best-effort cleanup
	}
});

describe.skipIf(SKIP)('Full sync flow (live)', () => {
	it('creates a task and then updates it', async () => {
		const file = { basename: 'integration-test-note', path: 'integration-test-note.md' } as unknown as TFile;
		const frontmatter = { status: 'todo', title: '[gtasks-sync] integration test note', due: '2099-01-01' };

		const payload = buildTaskPayload(frontmatter, file, 'TestVault');
		const created = await createTask(accessToken, listId, payload);
		expect(created.id).toBeTruthy();
		createdTaskId = created.id;

		// Simulate re-push (update)
		const updatedPayload = buildTaskPayload({ ...frontmatter, status: 'done' }, file, 'TestVault');
		const updated = await updateTask(accessToken, listId, createdTaskId!, updatedPayload);
		expect(updated.status).toBe('completed');
	});
});
