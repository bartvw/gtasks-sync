import { getAllTags, MarkdownView, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, GTasksSettingTab } from './settings';
import { PluginSettings } from './types';
import { runSyncCommand } from './sync/sync-command';
import { runGlobalSyncCommand, runDryRunCommand } from './sync/global-sync-command';

export default class GTasksSyncPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// Warn if SecretStorage is unavailable
		if (!this.app.secretStorage) {
			new Notice(
				'Secure storage is unavailable — OAuth credentials for Google Tasks Sync cannot be stored.'
			);
		}

		// Register the single-note sync command
		this.addCommand({
			id: 'sync-current-note',
			name: 'Sync current note to Google Tasks',
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file) return false;

				const cache = this.app.metadataCache.getFileCache(view.file);
				const tags = cache ? (getAllTags(cache) ?? []) : [];
				if (!tags.includes('#task')) return false;

				if (!checking) {
					runSyncCommand(this).catch(err => {
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(`Sync error: ${msg}`);
					});
				}
				return true;
			},
		});

		// Register the global sync command
		this.addCommand({
			id: 'global-sync',
			name: 'Global sync to Google Tasks',
			callback: () => {
				runGlobalSyncCommand(this).catch(err => {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(`Global sync error: ${msg}`);
				});
			},
		});

		// Register the dry-run global sync command
		this.addCommand({
			id: 'dry-run-global-sync',
			name: 'Dry run: global sync to Google Tasks',
			callback: () => {
				runDryRunCommand(this).catch(err => {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(`Dry run error: ${msg}`);
				});
			},
		});

		// Register settings tab
		this.addSettingTab(new GTasksSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<PluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
