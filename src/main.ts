import { MarkdownView, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, GTasksSettingTab } from './settings';
import { PluginSettings } from './types';
import { runSyncCommand } from './sync/sync-command';

export default class GTasksSyncPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// Warn if SecretStorage is unavailable
		if (!this.app.secretStorage) {
			new Notice(
				'Google Tasks Sync: Secure storage is unavailable on this system. OAuth credentials cannot be stored.'
			);
		}

		// Register the sync command
		this.addCommand({
			id: 'sync-current-note',
			name: 'Sync current note to Google Tasks',
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file) return false;

				const cache = this.app.metadataCache.getFileCache(view.file);
				const hasSyncMeta = cache?.frontmatter && 'status' in cache.frontmatter;
				if (!hasSyncMeta) return false;

				if (!checking) {
					runSyncCommand(this).catch(err => {
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(`Sync error: ${msg}`);
					});
				}
				return true;
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
