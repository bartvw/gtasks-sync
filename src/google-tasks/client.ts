import { App } from 'obsidian';
import { PluginSettings, GoogleTask, TokenData } from '../types';
import { loadTokens, saveTokens } from '../auth/token-store';
import { refreshAccessToken } from '../auth/oauth';

const BASE_URL = 'https://tasks.googleapis.com';

export interface TaskList {
	id: string;
	title: string;
}

export async function getAccessToken(app: App, settings: PluginSettings): Promise<string> {
	const tokens = await loadTokens(app);
	if (!tokens) {
		throw new Error('Not authenticated. Please connect your Google Account in settings.');
	}

	if (Date.now() < tokens.expiresAt - 60_000) {
		return tokens.accessToken;
	}

	const clientSecret = await Promise.resolve(app.secretStorage.getSecret('gtasks-client-secret'));
	if (!clientSecret) {
		throw new Error('Client Secret not found. Please re-enter credentials in settings.');
	}

	let refreshed: TokenData;
	try {
		refreshed = await refreshAccessToken(tokens.refreshToken, settings.clientId, clientSecret);
	} catch (err) {
		await loadTokens(app); // clear if invalid_grant
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('invalid_grant')) {
			const { clearTokens } = await import('../auth/token-store');
			await clearTokens(app);
			throw new Error('Session expired. Please reconnect your Google Account in settings.');
		}
		throw err;
	}

	await saveTokens(app, refreshed);
	return refreshed.accessToken;
}

async function apiFetch<T>(url: string, accessToken: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
			...(options?.headers ?? {}),
		},
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Google Tasks API error ${response.status}: ${text}`);
	}

	if (response.status === 204) {
		return undefined as unknown as T;
	}

	return response.json() as Promise<T>;
}

export async function listTasklists(accessToken: string): Promise<TaskList[]> {
	const data = await apiFetch<{ items?: TaskList[] }>(
		`${BASE_URL}/tasks/v1/users/@me/lists`,
		accessToken
	);
	return data.items ?? [];
}

export async function resolveListId(accessToken: string, listName: string): Promise<string> {
	const lists = await listTasklists(accessToken);
	const match = lists.find(l => l.title === listName);
	if (!match) {
		throw new Error(`Google Tasks list "${listName}" not found. Check the list name in settings.`);
	}
	return match.id;
}

export async function createTask(
	accessToken: string,
	listId: string,
	task: Omit<GoogleTask, 'id'>
): Promise<GoogleTask> {
	return apiFetch<GoogleTask>(
		`${BASE_URL}/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`,
		accessToken,
		{ method: 'POST', body: JSON.stringify(task) }
	);
}

export async function updateTask(
	accessToken: string,
	listId: string,
	taskId: string,
	task: Omit<GoogleTask, 'id'>
): Promise<GoogleTask> {
	return apiFetch<GoogleTask>(
		`${BASE_URL}/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
		accessToken,
		{ method: 'PUT', body: JSON.stringify({ ...task, id: taskId }) }
	);
}

export async function deleteTask(
	accessToken: string,
	listId: string,
	taskId: string
): Promise<void> {
	await apiFetch<void>(
		`${BASE_URL}/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
		accessToken,
		{ method: 'DELETE' }
	);
}
