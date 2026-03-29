import { getAllTags, Notice } from 'obsidian';
import { getAccessToken, resolveListId, createTask, updateTask, deleteTask, getTask } from '../google-tasks/client';
import { buildTaskPayload, resolveField, mapStatusToGoogle, mapDueToGoogle } from '../google-tasks/field-mapper';
import { readSyncMeta, writeSyncMeta, writeStatusSyncBack, writeTitleSyncBack, writeDueSyncBack } from './frontmatter';
import { ChangeLogger, buildFieldChanges } from './change-logger';
import GTasksSyncPlugin from '../main';

/** Extract the date portion (YYYY-MM-DD) from a Google RFC 3339 due string, or null if absent. */
function googleDueToDate(due: string | undefined): string | null {
	return due ? due.slice(0, 10) : null;
}

export async function runSyncCommand(plugin: GTasksSyncPlugin): Promise<void> {
	// 1. Get active file tagged with #task
	const file = plugin.app.workspace.getActiveFile();
	if (!file) {
		new Notice('No active file. Open a task note to sync.');
		return;
	}

	const cache = plugin.app.metadataCache.getFileCache(file);
	const tags = cache ? (getAllTags(cache) ?? []) : [];
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

	// 5. Build task payload (used for create/recreate paths)
	const frontmatter = cache?.frontmatter ?? {};
	const payload = buildTaskPayload(frontmatter, file);

	const logger = plugin.settings.changeLog.enabled ? new ChangeLogger() : null;

	try {
		if (!syncMeta.taskId) {
			// 6. First push: create task
			const created = await createTask(accessToken, listId, payload);
			if (!created.id) throw new Error('API did not return a task ID');
			const gtaskTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : file.basename;
			const gtaskDue = typeof frontmatter['due'] === 'string' ? frontmatter['due'] : null;
			await writeSyncMeta(file, plugin.app, created.id, listName, created.status, gtaskTitle, gtaskDue);
			logger?.record({
				timestamp: new Date().toISOString(),
				direction: 'to-google',
				operation: 'created',
				noteWikilink: file.basename,
				listName,
			});
			new Notice('Task created in Google Tasks.');
		} else if (syncMeta.listName && syncMeta.listName !== listName) {
			// 7. List changed: move task (create in new → delete from old → update frontmatter)
			const created = await createTask(accessToken, listId, payload);
			if (!created.id) throw new Error('API did not return a task ID during move');

			const gtaskTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : file.basename;
			const gtaskDue = typeof frontmatter['due'] === 'string' ? frontmatter['due'] : null;
			await writeSyncMeta(file, plugin.app, created.id, listName, created.status, gtaskTitle, gtaskDue);

			try {
				const oldListId = await resolveListId(accessToken, syncMeta.listName);
				await deleteTask(accessToken, oldListId, syncMeta.taskId);
			} catch {
				new Notice('Warning: task moved to new list, but old task could not be deleted.');
				return;
			}

			logger?.record({
				timestamp: new Date().toISOString(),
				direction: 'to-google',
				operation: 'created',
				noteWikilink: file.basename,
				listName,
			});
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
				logger?.record({
					timestamp: new Date().toISOString(),
					direction: 'from-google',
					operation: 'updated',
					noteWikilink: file.basename,
					listName,
					fieldChanges: [{ field: 'status', oldValue: 'needsAction', newValue: 'completed' }],
				});
				if (logger) await logger.flush(plugin.app, plugin.settings.changeLog.path);
				new Notice('Task was completed in Google Tasks. Note updated.');
				return;
			}

			// 8b. Per-field resolution for title and due
			const conflictStrategy = plugin.settings.conflictResolution;

			const localTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : file.basename;
			const googleTitle = currentTask.title;
			const titleResult = resolveField(localTitle, googleTitle, syncMeta.gtaskTitle, conflictStrategy);

			const localDue = typeof frontmatter['due'] === 'string' ? frontmatter['due'] : null;
			const googleDue = googleDueToDate(currentTask.due);
			const dueResult = resolveField(localDue, googleDue, syncMeta.gtaskDue, conflictStrategy);

			// Status comparison
			const localStatus = mapStatusToGoogle(typeof frontmatter['status'] === 'string' ? frontmatter['status'] : '');
			const statusChanged = localStatus !== currentTask.status;

			// Collect pull-backs
			if (titleResult.action === 'pull') {
				await writeTitleSyncBack(file, plugin.app, titleResult.value);
			}
			if (dueResult.action === 'pull') {
				await writeDueSyncBack(file, plugin.app, dueResult.value);
			}

			// Build push payload
			const pushPayload: { title?: string; status?: 'needsAction' | 'completed'; due?: string } = {};
			if (titleResult.action === 'push') {
				pushPayload.title = titleResult.value;
			}
			if (dueResult.action === 'push') {
				pushPayload.due = mapDueToGoogle(dueResult.value ?? undefined) ?? undefined;
			}
			if (statusChanged) {
				pushPayload.status = localStatus;
			}

			const hasPush = pushPayload.title !== undefined || pushPayload.due !== undefined || pushPayload.status !== undefined;
			if (!hasPush) {
				// All resolved to pull/skip; update sentinels
				const finalTitle = titleResult.value;
				const finalDue = dueResult.value;
				await writeSyncMeta(file, plugin.app, syncMeta.taskId, listName, currentTask.status, finalTitle, finalDue);
				new Notice('Task is up to date.');
			} else {
				const mergedPayload = {
					title: pushPayload.title ?? currentTask.title,
					status: pushPayload.status ?? currentTask.status,
					...(pushPayload.due !== undefined ? { due: pushPayload.due }
						: currentTask.due ? { due: currentTask.due } : {}),
				};
				const fieldChanges = buildFieldChanges(currentTask, mergedPayload);
				const updated = await updateTask(accessToken, listId, syncMeta.taskId, mergedPayload);
				const finalTitle = pushPayload.title ?? titleResult.value;
				const finalDue = pushPayload.due ? (updated.due ? googleDueToDate(updated.due) : null) : dueResult.value;
				await writeSyncMeta(file, plugin.app, syncMeta.taskId, listName, updated.status, finalTitle, finalDue);
				if (fieldChanges.length > 0) {
					logger?.record({
						timestamp: new Date().toISOString(),
						direction: 'to-google',
						operation: 'updated',
						noteWikilink: file.basename,
						listName,
						fieldChanges,
					});
				}
				new Notice('Task updated in Google Tasks.');
			}
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Sync failed: ${msg}`);
	}

	if (logger) await logger.flush(plugin.app, plugin.settings.changeLog.path);
}
