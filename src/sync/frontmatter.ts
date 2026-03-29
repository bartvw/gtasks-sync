import { App, TFile } from 'obsidian';

export interface SyncMeta {
	taskId: string | null;
	listName: string | null;
	gtaskStatus: 'needsAction' | 'completed' | null;
	gtaskTitle: string | null;
	gtaskDue: string | null;
}

export function readSyncMeta(file: TFile, app: App): SyncMeta {
	const cache = app.metadataCache.getFileCache(file);
	const fm = (cache?.frontmatter ?? {}) as Record<string, unknown>;
	const rawStatus = fm['gtask-status'];
	return {
		taskId: typeof fm['gtask-id'] === 'string' ? fm['gtask-id'] : null,
		listName: typeof fm['gtask-list'] === 'string' ? fm['gtask-list'] : null,
		gtaskStatus: rawStatus === 'needsAction' || rawStatus === 'completed' ? rawStatus : null,
		gtaskTitle: typeof fm['gtask-title'] === 'string' ? fm['gtask-title'] : null,
		gtaskDue: typeof fm['gtask-due'] === 'string' ? fm['gtask-due'] : null,
	};
}

export async function writeSyncMeta(
	file: TFile,
	app: App,
	taskId: string,
	listName: string,
	gtaskStatus: 'needsAction' | 'completed',
	gtaskTitle: string,
	gtaskDue: string | null
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm['gtask-id'] = taskId;
		fm['gtask-list'] = listName;
		fm['gtask-status'] = gtaskStatus;
		fm['gtask-title'] = gtaskTitle;
		if (gtaskDue != null) {
			fm['gtask-due'] = gtaskDue;
		}
	});
}

export async function writeStatusSyncBack(file: TFile, app: App): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm['status'] = 'done';
		fm['gtask-status'] = 'completed';
	});
}

export async function writeStatusUndone(file: TFile, app: App): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm['status'] = 'open';
		fm['gtask-status'] = 'needsAction';
	});
}

export async function writeGtaskStatusOnly(file: TFile, app: App, gtaskStatus: 'needsAction' | 'completed'): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm['gtask-status'] = gtaskStatus;
	});
}

export async function writeTitleSyncBack(file: TFile, app: App, title: string): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm['title'] = title;
		fm['gtask-title'] = title;
	});
}

export async function writeDueSyncBack(file: TFile, app: App, due: string | null): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		if (due != null) {
			fm['due'] = due;
			fm['gtask-due'] = due;
		} else {
			delete fm['due'];
			delete fm['gtask-due'];
		}
	});
}
