import { App, TFile } from 'obsidian';

export interface SyncMeta {
	taskId: string | null;
	listName: string | null;
}

export function readSyncMeta(file: TFile, app: App): SyncMeta {
	const cache = app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter ?? {};
	return {
		taskId: typeof fm['gtask-id'] === 'string' ? fm['gtask-id'] : null,
		listName: typeof fm['gtask-list'] === 'string' ? fm['gtask-list'] : null,
	};
}

export async function writeSyncMeta(
	file: TFile,
	app: App,
	taskId: string,
	listName: string
): Promise<void> {
	await app.fileManager.processFrontMatter(file, fm => {
		fm['gtask-id'] = taskId;
		fm['gtask-list'] = listName;
	});
}
