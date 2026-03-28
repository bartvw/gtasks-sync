import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { PluginSettings } from './types';
import { clearTokens, loadTokens, saveTokens } from './auth/token-store';
import { buildAuthUrl, startLoopbackServer, exchangeCodeForTokens } from './auth/oauth';
import GTasksSyncPlugin from './main';

export const DEFAULT_SETTINGS: PluginSettings = {
	clientId: '',
	defaultListName: '',
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
			new Notice('Google Tasks Sync: Secure storage is unavailable on this system. Cannot store credentials.');
			containerEl.createEl('p', {
				text: 'Warning: Secure storage is unavailable on this system. Credentials cannot be stored safely.',
				cls: 'mod-warning',
			});
		}

		// --- Google Credentials ---
		containerEl.createEl('h2', { text: 'Google Credentials' });

		new Setting(containerEl)
			.setName('Client ID')
			.setDesc('OAuth 2.0 Client ID from your Google Cloud project.')
			.addText(text =>
				text
					.setPlaceholder('Enter your Client ID')
					.setValue(this.plugin.settings.clientId)
					.onChange(async value => {
						this.plugin.settings.clientId = value;
						await this.plugin.saveSettings();
					})
			);

		// Client Secret: stored in secretStorage, displayed as a password field
		const secretSetting = new Setting(containerEl)
			.setName('Client Secret')
			.setDesc('OAuth 2.0 Client Secret (stored securely in OS keychain).');

		secretSetting.addText(text => {
			text.inputEl.type = 'password';
			text.setPlaceholder('Enter your Client Secret');
			text.setDisabled(!secretStorageAvailable);

			if (secretStorageAvailable) {
				Promise.resolve(this.app.secretStorage.getSecret('gtasks-client-secret')).then(val => {
					if (val) text.setValue(val);
				});
			}

			text.onChange(async value => {
				if (!secretStorageAvailable) return;
				await this.app.secretStorage.setSecret('gtasks-client-secret', value);
			});
		});

		// --- Google Tasks list ---
		containerEl.createEl('h2', { text: 'Google Tasks List' });

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

		// --- Connection status ---
		containerEl.createEl('h2', { text: 'Connection' });

		this.renderConnectionStatus(containerEl, secretStorageAvailable);
	}

	private renderConnectionStatus(containerEl: HTMLElement, secretStorageAvailable: boolean): void {
		loadTokens(this.app).then(tokens => {
			const connected = tokens != null;
			const statusEl = containerEl.createEl('p', {
				text: connected ? 'Status: Connected to Google' : 'Status: Not connected',
			});
			statusEl.style.fontWeight = 'bold';

			new Setting(containerEl)
				.setName('Google Account')
				.addButton(button => {
					button
						.setButtonText('Connect Google Account')
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
			new Notice('Please enter your Client ID and Client Secret first.');
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
