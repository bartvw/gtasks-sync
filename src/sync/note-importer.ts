import { App, TFile } from 'obsidian';
import { GoogleTask, PluginSettings } from '../types';

export function sanitizeFilename(title: string): string {
	const sanitized = title.replace(/[/:*?"<>|\\]/g, '').trim();
	return sanitized || 'untitled';
}

export function findUniqueFilePath(folder: string, baseName: string, app: App): string {
	const normalizedFolder = folder.replace(/\/$/, '');
	const base = `${normalizedFolder}/${baseName}.md`;
	if (!app.vault.getAbstractFileByPath(base)) return base;
	let n = 2;
	for (;;) {
		const candidate = `${normalizedFolder}/${baseName} ${n}.md`;
		if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
		n++;
	}
}

async function ensureFolderExists(folder: string, app: App): Promise<void> {
	if (!folder || app.vault.getAbstractFileByPath(folder)) return;
	const parent = folder.split('/').slice(0, -1).join('/');
	if (parent) await ensureFolderExists(parent, app);
	await app.vault.createFolder(folder);
}

function buildFrontmatter(task: GoogleTask, listName: string, defaultStatus: string): string {
	const lines = ['---', 'tags:\n  - task'];
	const escapedTitle = task.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	lines.push(`title: "${escapedTitle}"`);
	const dueDate = task.due ? task.due.slice(0, 10) : null;
	if (dueDate) {
		lines.push(`due: ${dueDate}`);
	}
	lines.push(`status: ${defaultStatus}`);
	lines.push(`gtask-id: ${task.id}`);
	lines.push(`gtask-list: ${listName}`);
	lines.push('gtask-status: needsAction');
	lines.push(`gtask-title: "${escapedTitle}"`);
	if (dueDate) {
		lines.push(`gtask-due: ${dueDate}`);
	}
	lines.push('---');
	return lines.join('\n');
}

export async function createNoteFromGoogleTask(
	task: GoogleTask,
	listName: string,
	settings: PluginSettings,
	app: App
): Promise<TFile> {
	const { folder, defaultStatus } = settings.importFromGoogle;

	await ensureFolderExists(folder, app);

	const sanitized = sanitizeFilename(task.title);
	const filePath = findUniqueFilePath(folder, sanitized, app);

	const frontmatter = buildFrontmatter(task, listName, defaultStatus);

	return await app.vault.create(filePath, frontmatter);
}
