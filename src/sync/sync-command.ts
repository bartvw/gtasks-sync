import { Notice } from 'obsidian';
import { getAccessToken, resolveListId, createTask, updateTask, deleteTask } from '../google-tasks/client';
import { buildTaskPayload } from '../google-tasks/field-mapper';
import { readSyncMeta, writeSyncMeta } from './frontmatter';
import GTasksSyncPlugin from '../main';

export async function runSyncCommand(plugin: GTasksSyncPlugin): Promise<void> {
	// 1. Get active file with a status frontmatter field
	const file = plugin.app.workspace.getActiveFile();
	if (!file) {
		new Notice('No active file. Open a task note to sync.');
		return;
	}

	const cache = plugin.app.metadataCache.getFileCache(file);
	const frontmatter = cache?.frontmatter ?? {};
	if (!('status' in frontmatter)) {
		new Notice('This note has no "status" frontmatter field. Is this a task note?');
		return;
	}

	// 2. Get access token
	let accessToken: string;
	try {
		accessToken = await getAccessToken(plugin.app, plugin.settings);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Auth error: ${msg}`);
		return;
	}

	// 3. Resolve list ID
	const listName = plugin.settings.defaultListName;
	let listId: string;
	try {
		listId = await resolveListId(accessToken, listName);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`List error: ${msg}`);
		return;
	}

	// 4. Read sync meta from frontmatter
	const syncMeta = readSyncMeta(file, plugin.app);

	// 5. Build task payload
	const vaultName = plugin.app.vault.getName();
	const payload = buildTaskPayload(frontmatter, file, vaultName);

	try {
		if (!syncMeta.taskId) {
			// 6. First push: create task
			const created = await createTask(accessToken, listId, payload);
			if (!created.id) throw new Error('API did not return a task ID');
			await writeSyncMeta(file, plugin.app, created.id, listName);
			new Notice('Task created in Google Tasks.');
		} else if (syncMeta.listName && syncMeta.listName !== listName) {
			// 7. List changed: move task (create in new → delete from old → update frontmatter)
			const created = await createTask(accessToken, listId, payload);
			if (!created.id) throw new Error('API did not return a task ID during move');

			await writeSyncMeta(file, plugin.app, created.id, listName);

			try {
				const oldListId = await resolveListId(accessToken, syncMeta.listName);
				await deleteTask(accessToken, oldListId, syncMeta.taskId);
			} catch {
				new Notice('Warning: Task moved to new list, but old task could not be deleted.');
				return;
			}

			new Notice('Task moved to new list in Google Tasks.');
		} else {
			// 8. Update existing task
			await updateTask(accessToken, listId, syncMeta.taskId, payload);
			new Notice('Task updated in Google Tasks.');
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Sync failed: ${msg}`);
	}
}
