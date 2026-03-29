import { App, TFile } from 'obsidian';

export async function readNoteBody(file: TFile, app: App): Promise<string> {
	const content = await app.vault.read(file);
	if (!content.startsWith('---')) return '';
	const closeIdx = content.indexOf('\n---', 3);
	if (closeIdx === -1) return '';
	return content.slice(closeIdx + 4).trim();
}

export interface SyncMeta {
	taskId: string | null;
	listName: string | null;
	gtaskStatus: 'needsAction' | 'completed' | null;
}

export function readSyncMeta(file: TFile, app: App): SyncMeta {
	const cache = app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter ?? {};
	const rawStatus = fm['gtask-status'];
	return {
		taskId: typeof fm['gtask-id'] === 'string' ? fm['gtask-id'] : null,
		listName: typeof fm['gtask-list'] === 'string' ? fm['gtask-list'] : null,
		gtaskStatus: rawStatus === 'needsAction' || rawStatus === 'completed' ? rawStatus : null,
	};
}

export async function writeSyncMeta(
	file: TFile,
	app: App,
	taskId: string,
	listName: string,
	gtaskStatus: 'needsAction' | 'completed'
): Promise<void> {
	await app.fileManager.processFrontMatter(file, fm => {
		fm['gtask-id'] = taskId;
		fm['gtask-list'] = listName;
		fm['gtask-status'] = gtaskStatus;
	});
}

export async function writeStatusSyncBack(file: TFile, app: App): Promise<void> {
	await app.fileManager.processFrontMatter(file, fm => {
		fm['status'] = 'done';
		fm['gtask-status'] = 'completed';
	});
}
