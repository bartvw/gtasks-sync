import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { PluginSettings } from './types';
import { clearTokens, loadTokens, saveTokens } from './auth/token-store';
import { buildAuthUrl, startLoopbackServer, exchangeCodeForTokens } from './auth/oauth';
import GTasksSyncPlugin from './main';

export const DEFAULT_SETTINGS: PluginSettings = {
	clientId: '',
	defaultListName: '',
	conflictResolution: 'google-wins',
	changeLog: {
		enabled: true,
		path: 'gtasks-sync-log.md',
	},
	importFromGoogle: {
		enabled: false,
		folder: '',
		defaultStatus: 'open',
	},
};

export class GTasksSettingTab extends PluginSettingTab {
	plugin: GTasksSyncPlugin;

	constructor(app: App, plugin: GTasksSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const secretStorageAvailable = this.app.secretStorage != null;

		if (!secretStorageAvailable) {
			new Notice('Google Tasks Sync: secure storage is unavailable on this system. Cannot store credentials.');
			containerEl.createEl('p', {
				text: 'Warning: secure storage is unavailable on this system. Credentials cannot be stored safely.',
				cls: 'mod-warning',
			});
		}

		// --- Google Credentials ---
		new Setting(containerEl).setName('Google credentials').setHeading();

		new Setting(containerEl)
			.setName('Client ID')
			.setDesc('The OAuth 2.0 client ID from your Google Cloud project.')
			.addText(text =>
				text
					.setPlaceholder('Enter your client ID')
					.setValue(this.plugin.settings.clientId)
					.onChange(async value => {
						this.plugin.settings.clientId = value;
						await this.plugin.saveSettings();
					})
			);

		// Client Secret: stored in secretStorage, displayed as a password field
		const secretSetting = new Setting(containerEl)
			.setName('Client secret')
			.setDesc('OAuth 2.0 client secret (stored securely in OS keychain).');

		secretSetting.addText(text => {
			text.inputEl.type = 'password';
			text.setPlaceholder('Enter your client secret');
			text.setDisabled(!secretStorageAvailable);

			if (secretStorageAvailable) {
				void Promise.resolve(this.app.secretStorage.getSecret('gtasks-client-secret')).then(val => {
					if (val) text.setValue(val);
				});
			}

			text.onChange(async value => {
				if (!secretStorageAvailable) return;
				await this.app.secretStorage.setSecret('gtasks-client-secret', value);
			});
		});

		// --- Google Tasks list ---
		new Setting(containerEl).setName('Google Tasks list').setHeading();

		new Setting(containerEl)
			.setName('Default list name')
			.setDesc('Name of the Google Tasks list to sync to.')
			.addText(text =>
				text
					.setPlaceholder('My Tasks')
					.setValue(this.plugin.settings.defaultListName)
					.onChange(async value => {
						this.plugin.settings.defaultListName = value;
						await this.plugin.saveSettings();
					})
			);

		// --- Conflict resolution ---
		new Setting(containerEl)
			.setName('Conflict resolution')
			.setDesc('When both local and Google changed a field between syncs, which value wins?')
			.addDropdown(drop =>
				drop
					.addOption('google-wins', 'Google wins')
					.addOption('local-wins', 'Local wins')
					.setValue(this.plugin.settings.conflictResolution)
					.onChange(async (value: string) => {
						this.plugin.settings.conflictResolution = value as 'google-wins' | 'local-wins';
						await this.plugin.saveSettings();
					})
			);

		// --- Change log ---
		new Setting(containerEl).setName('Change log').setHeading();

		new Setting(containerEl)
			.setName('Enable change log')
			.setDesc('Append a log of every sync operation to a file in your vault.')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.changeLog.enabled)
					.onChange(async value => {
						this.plugin.settings.changeLog.enabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Log file path')
			.setDesc('Path to the change log file in your vault, for example gtasks-sync-log.md.')
			.addText(text =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder('gtasks-sync-log.md')
					.setValue(this.plugin.settings.changeLog.path)
					.onChange(async value => {
						this.plugin.settings.changeLog.path = value;
						await this.plugin.saveSettings();
					})
			);

		// --- Import from Google Tasks ---
		new Setting(containerEl).setName('Import from Google Tasks').setHeading();

		const importValidationEl = containerEl.createEl('p', {
			text: 'Import folder is required when import is enabled.',
			cls: 'mod-warning gtasks-validation-hidden',
		});

		const updateValidation = () => {
			const invalid = this.plugin.settings.importFromGoogle.enabled && !this.plugin.settings.importFromGoogle.folder;
			importValidationEl.toggleClass('gtasks-validation-hidden', !invalid);
		};

		new Setting(containerEl)
			.setName('Enable import')
			.setDesc('Create Obsidian notes for Google Tasks that have no matching vault note.')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.importFromGoogle.enabled)
					.onChange(async value => {
						this.plugin.settings.importFromGoogle.enabled = value;
						await this.plugin.saveSettings();
						updateValidation();
					})
			);

		new Setting(containerEl)
			.setName('Import folder')
			.setDesc('Path to the folder where imported notes are created.')
			.addText(text =>
				text
					.setPlaceholder('Imported tasks')
					.setValue(this.plugin.settings.importFromGoogle.folder)
					.onChange(async value => {
						this.plugin.settings.importFromGoogle.folder = value;
						await this.plugin.saveSettings();
						updateValidation();
					})
			);

		updateValidation();

		new Setting(containerEl)
			.setName('Default status')
			.setDesc('The status frontmatter value written to newly imported notes.')
			.addText(text =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder('open')
					.setValue(this.plugin.settings.importFromGoogle.defaultStatus)
					.onChange(async value => {
						this.plugin.settings.importFromGoogle.defaultStatus = value;
						await this.plugin.saveSettings();
					})
			);

		// --- Connection status ---
		new Setting(containerEl).setName('Connection').setHeading();

		this.renderConnectionStatus(containerEl, secretStorageAvailable);
	}

	private renderConnectionStatus(containerEl: HTMLElement, secretStorageAvailable: boolean): void {
		void loadTokens(this.app).then(tokens => {
			const connected = tokens != null;
			const statusEl = containerEl.createEl('p', {
				text: connected ? 'Status: connected to Google' : 'Status: not connected',
			});
			statusEl.addClass('gtasks-connection-status');

			new Setting(containerEl)
				.setName('Google account')
				.addButton(button => {
					button
						.setButtonText('Connect Google account')
						.setDisabled(!secretStorageAvailable || connected)
						.onClick(async () => {
							await this.startOAuthFlow();
						});
				})
				.addButton(button => {
					button
						.setButtonText('Disconnect')
						.setDisabled(!connected)
						.setWarning()
						.onClick(async () => {
							await clearTokens(this.app);
							new Notice('Disconnected from Google.');
							this.display();
						});
				});
		});
	}

	private async startOAuthFlow(): Promise<void> {
		const clientId = this.plugin.settings.clientId;
		const clientSecret = await Promise.resolve(this.app.secretStorage.getSecret('gtasks-client-secret'));

		if (!clientId || !clientSecret) {
			new Notice('Please enter your client ID and client secret first.');
			return;
		}

		try {
			const { port, codePromise } = await startLoopbackServer();
			const redirectUri = `http://127.0.0.1:${port}`;
			const authUrl = buildAuthUrl(clientId, redirectUri);

			window.open(authUrl);
			new Notice('Browser opened. Complete the Google sign-in to connect.');

			const code = await codePromise;
			const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
			await saveTokens(this.app, tokens);
			new Notice('Successfully connected to Google!');
			this.display();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Failed to connect: ${msg}`);
			this.display();
		}
	}
}
