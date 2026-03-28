import { getAllTags, Notice } from 'obsidian';
import { getAccessToken, resolveListId, createTask, updateTask, deleteTask, getTask } from '../google-tasks/client';
import { buildTaskPayload } from '../google-tasks/field-mapper';
import { readSyncMeta, writeSyncMeta, writeStatusSyncBack } from './frontmatter';
import GTasksSyncPlugin from '../main';

export async function runSyncCommand(plugin: GTasksSyncPlugin): Promise<void> {
	// 1. Get active file tagged with #task
	const file = plugin.app.workspace.getActiveFile();
	if (!file) {
		new Notice('No active file. Open a task note to sync.');
		return;
	}

	const cache = plugin.app.metadataCache.getFileCache(file);
	const tags = getAllTags(cache) ?? [];
	if (!tags.includes('#task')) {
		new Notice('This note is not tagged with #task. Is this a task note?');
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
	const frontmatter = cache?.frontmatter ?? {};
	const vaultName = plugin.app.vault.getName();
	const payload = buildTaskPayload(frontmatter, file, vaultName);

	try {
		if (!syncMeta.taskId) {
			// 6. First push: create task
			const created = await createTask(accessToken, listId, payload);
			if (!created.id) throw new Error('API did not return a task ID');
			await writeSyncMeta(file, plugin.app, created.id, listName, created.status);
			new Notice('Task created in Google Tasks.');
		} else if (syncMeta.listName && syncMeta.listName !== listName) {
			// 7. List changed: move task (create in new → delete from old → update frontmatter)
			const created = await createTask(accessToken, listId, payload);
			if (!created.id) throw new Error('API did not return a task ID during move');

			await writeSyncMeta(file, plugin.app, created.id, listName, created.status);

			try {
				const oldListId = await resolveListId(accessToken, syncMeta.listName);
				await deleteTask(accessToken, oldListId, syncMeta.taskId);
			} catch {
				new Notice('Warning: Task moved to new list, but old task could not be deleted.');
				return;
			}

			new Notice('Task moved to new list in Google Tasks.');
		} else {
			// 8. Update existing task: fetch current state first
			let currentTask;
			try {
				currentTask = await getTask(accessToken, listId, syncMeta.taskId);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				new Notice(`Sync failed: ${msg}`);
				return;
			}

			// 8a. Task was completed in Google Tasks since last sync — sync back
			if (currentTask.status === 'completed' && syncMeta.gtaskStatus === 'needsAction') {
				await writeStatusSyncBack(file, plugin.app);
				new Notice('Task was completed in Google Tasks. Note updated.');
				return;
			}

			// 8b. Push local state to Google Tasks
			const updated = await updateTask(accessToken, listId, syncMeta.taskId, payload);
			await writeSyncMeta(file, plugin.app, syncMeta.taskId, listName, updated.status);
			new Notice('Task updated in Google Tasks.');
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Sync failed: ${msg}`);
	}
}
