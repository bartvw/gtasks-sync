import { App, getAllTags, Modal, Notice, TFile } from 'obsidian';
import { getAccessToken, resolveListId, fetchAllTasks, createTask, updateTask } from '../google-tasks/client';
import { buildTaskPayload, taskMatchesPayload } from '../google-tasks/field-mapper';
import { readSyncMeta, writeSyncMeta, writeStatusSyncBack } from './frontmatter';
import { GoogleTask } from '../types';
import GTasksSyncPlugin from '../main';

type ReconcileAction = 'create' | 'update' | 'recreate' | 'mark-done' | 'skip';

interface NoteResult {
	file: TFile;
	action: ReconcileAction;
	error?: string;
}

function isActiveStatus(status: unknown): boolean {
	return status !== 'done' && status !== 'cancelled';
}

function determineAction(
	taskId: string | null,
	frontmatter: Record<string, unknown>,
	activeTasks: Map<string, GoogleTask>,
	completedTasks: Map<string, GoogleTask>,
	payload: Omit<GoogleTask, 'id'>
): ReconcileAction {
	const noteIsActive = isActiveStatus(frontmatter['status']);

	if (!taskId) {
		return noteIsActive ? 'create' : 'skip';
	}
	if (activeTasks.has(taskId)) {
		const remoteTask = activeTasks.get(taskId)!;
		return taskMatchesPayload(remoteTask, payload) ? 'skip' : 'update';
	}
	if (completedTasks.has(taskId)) {
		return noteIsActive ? 'mark-done' : 'skip';
	}
	// Not found in either map — task was deleted
	return noteIsActive ? 'recreate' : 'skip';
}

class SyncProgressModal extends Modal {
	private total: number;
	private progressEl!: HTMLElement;
	private statusEl!: HTMLElement;
	private cancelBtn!: HTMLButtonElement;
	private _cancelled = false;

	constructor(app: App, total: number) {
		super(app);
		this.total = total;
	}

	get cancelled(): boolean {
		return this._cancelled;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Syncing to Google Tasks' });
		this.progressEl = contentEl.createEl('p', { text: `0 / ${this.total}` });
		this.statusEl = contentEl.createEl('p', { text: 'Starting...' });
		this.cancelBtn = contentEl.createEl('button', { text: 'Cancel' });
		this.cancelBtn.addEventListener('click', () => {
			this._cancelled = true;
			this.statusEl.setText('Cancelling after current note...');
			this.cancelBtn.disabled = true;
		});
	}

	updateProgress(processed: number, filename: string) {
		this.progressEl.setText(`${processed} / ${this.total}`);
		this.statusEl.setText(filename);
	}

	showSummary(processed: number, results: NoteResult[]) {
		const { contentEl } = this;
		contentEl.empty();

		const failures = results.filter(r => r.error);

		if (failures.length === 0) {
			contentEl.createEl('h2', { text: 'Sync Complete' });
			contentEl.createEl('p', { text: `Successfully processed ${processed} notes.` });
		} else {
			contentEl.createEl('h2', { text: 'Sync Complete with Errors' });
			contentEl.createEl('p', { text: `${failures.length} note(s) failed:` });
			const list = contentEl.createEl('ul');
			for (const r of failures) {
				list.createEl('li', { text: `${r.file.name}: ${r.error}` });
			}
		}

		const closeBtn = contentEl.createEl('button', { text: 'Close' });
		closeBtn.addEventListener('click', () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}

class DryRunSummaryModal extends Modal {
	private counts: Record<ReconcileAction, number>;
	private plugin: GTasksSyncPlugin;
	private files: TFile[];
	private accessToken: string;
	private listId: string;
	private listName: string;
	private activeTasks: Map<string, GoogleTask>;
	private completedTasks: Map<string, GoogleTask>;

	constructor(
		app: App,
		plugin: GTasksSyncPlugin,
		counts: Record<ReconcileAction, number>,
		files: TFile[],
		accessToken: string,
		listId: string,
		listName: string,
		activeTasks: Map<string, GoogleTask>,
		completedTasks: Map<string, GoogleTask>
	) {
		super(app);
		this.plugin = plugin;
		this.counts = counts;
		this.files = files;
		this.accessToken = accessToken;
		this.listId = listId;
		this.listName = listName;
		this.activeTasks = activeTasks;
		this.completedTasks = completedTasks;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Dry Run: Global Sync' });

		const table = contentEl.createEl('table');
		const rows: [string, number][] = [
			['Would create', this.counts.create],
			['Would update', this.counts.update],
			['Would recreate', this.counts.recreate],
			['Would mark done', this.counts['mark-done']],
			['Would skip', this.counts.skip],
		];
		for (const [label, count] of rows) {
			const tr = table.createEl('tr');
			tr.createEl('td', { text: label });
			tr.createEl('td', { text: String(count) });
		}

		const runBtn = contentEl.createEl('button', { text: 'Run sync' });
		runBtn.style.marginTop = '16px';
		runBtn.addEventListener('click', () => {
			this.close();
			runGlobalSyncWithData(
				this.plugin,
				this.accessToken,
				this.listId,
				this.listName,
				this.files,
				this.activeTasks,
				this.completedTasks
			);
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

async function runGlobalSyncWithData(
	plugin: GTasksSyncPlugin,
	accessToken: string,
	listId: string,
	listName: string,
	files: TFile[],
	activeTasks: Map<string, GoogleTask>,
	completedTasks: Map<string, GoogleTask>
): Promise<void> {
	const modal = new SyncProgressModal(plugin.app, files.length);
	modal.open();

	const vaultName = plugin.app.vault.getName();
	const results: NoteResult[] = [];
	let processed = 0;

	for (const file of files) {
		if (modal.cancelled) break;

		const cache = plugin.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter ?? {};
		const syncMeta = readSyncMeta(file, plugin.app);
		const payload = buildTaskPayload(frontmatter, file, vaultName);
		const action = determineAction(syncMeta.taskId, frontmatter, activeTasks, completedTasks, payload);
		const result: NoteResult = { file, action };

		try {
			if (action === 'create' || action === 'recreate') {
				const created = await createTask(accessToken, listId, payload);
				if (!created.id) throw new Error('API did not return a task ID');
				await writeSyncMeta(file, plugin.app, created.id, listName, created.status);
				activeTasks.set(created.id, created);
			} else if (action === 'update') {
				const updated = await updateTask(accessToken, listId, syncMeta.taskId!, payload);
				await writeSyncMeta(file, plugin.app, syncMeta.taskId!, listName, updated.status);
			} else if (action === 'mark-done') {
				await writeStatusSyncBack(file, plugin.app);
			}
			// 'skip' requires no action
		} catch (err) {
			result.error = err instanceof Error ? err.message : String(err);
		}

		processed++;
		results.push(result);
		modal.updateProgress(processed, file.name);
	}

	modal.showSummary(processed, results);
}

function discoverTaskNotes(plugin: GTasksSyncPlugin): TFile[] {
	return plugin.app.vault.getMarkdownFiles().filter(file => {
		const cache = plugin.app.metadataCache.getFileCache(file);
		const tags = getAllTags(cache) ?? [];
		return tags.includes('#task');
	});
}

async function authenticate(plugin: GTasksSyncPlugin): Promise<{
	accessToken: string;
	listId: string;
	listName: string;
} | null> {
	let accessToken: string;
	try {
		accessToken = await getAccessToken(plugin.app, plugin.settings);
	} catch (err) {
		new Notice(`Auth error: ${err instanceof Error ? err.message : String(err)}`);
		return null;
	}

	const listName = plugin.settings.defaultListName;
	let listId: string;
	try {
		listId = await resolveListId(accessToken, listName);
	} catch (err) {
		new Notice(`List error: ${err instanceof Error ? err.message : String(err)}`);
		return null;
	}

	return { accessToken, listId, listName };
}

async function buildTaskMaps(
	accessToken: string,
	listId: string
): Promise<{ activeTasks: Map<string, GoogleTask>; completedTasks: Map<string, GoogleTask> } | null> {
	let allTasks: Map<string, GoogleTask>;
	try {
		allTasks = await fetchAllTasks(accessToken, listId);
	} catch (err) {
		new Notice(`Failed to fetch tasks: ${err instanceof Error ? err.message : String(err)}`);
		return null;
	}

	const activeTasks = new Map<string, GoogleTask>();
	const completedTasks = new Map<string, GoogleTask>();
	for (const [id, task] of allTasks) {
		if (task.status === 'completed') {
			completedTasks.set(id, task);
		} else {
			activeTasks.set(id, task);
		}
	}

	return { activeTasks, completedTasks };
}

export async function runGlobalSyncCommand(plugin: GTasksSyncPlugin): Promise<void> {
	const files = discoverTaskNotes(plugin);
	if (files.length === 0) {
		new Notice('No task notes found. Tag notes with #task to include them in sync.');
		return;
	}

	const auth = await authenticate(plugin);
	if (!auth) return;

	const maps = await buildTaskMaps(auth.accessToken, auth.listId);
	if (!maps) return;

	await runGlobalSyncWithData(
		plugin,
		auth.accessToken,
		auth.listId,
		auth.listName,
		files,
		maps.activeTasks,
		maps.completedTasks
	);
}

export async function runDryRunCommand(plugin: GTasksSyncPlugin): Promise<void> {
	const files = discoverTaskNotes(plugin);
	if (files.length === 0) {
		new Notice('No task notes found. Tag notes with #task to include them in sync.');
		return;
	}

	const auth = await authenticate(plugin);
	if (!auth) return;

	const maps = await buildTaskMaps(auth.accessToken, auth.listId);
	if (!maps) return;

	const counts: Record<ReconcileAction, number> = {
		create: 0,
		update: 0,
		recreate: 0,
		'mark-done': 0,
		skip: 0,
	};

	const vaultName = plugin.app.vault.getName();
	for (const file of files) {
		const cache = plugin.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter ?? {};
		const syncMeta = readSyncMeta(file, plugin.app);
		const payload = buildTaskPayload(frontmatter, file, vaultName);
		const action = determineAction(syncMeta.taskId, frontmatter, maps.activeTasks, maps.completedTasks, payload);
		counts[action]++;
	}

	new DryRunSummaryModal(
		plugin.app,
		plugin,
		counts,
		files,
		auth.accessToken,
		auth.listId,
		auth.listName,
		maps.activeTasks,
		maps.completedTasks
	).open();
}
