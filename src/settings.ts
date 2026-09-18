import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type GrampsWebPlugin from './main';
import { GrampsApiError } from './api/client';

export interface GrampsWebSettings {
	serverUrl: string;
	username: string;
	locale: string;
	/** Cached display name of the tree the signed-in user is bound to. */
	treeName: string;
	inlineTriggerEnabled: boolean;
	inlineTriggerString: string;
}

export const DEFAULT_SETTINGS: GrampsWebSettings = {
	serverUrl: '',
	username: '',
	locale: '',
	treeName: '',
	inlineTriggerEnabled: false,
	inlineTriggerString: '@@',
};

export class GrampsWebSettingTab extends PluginSettingTab {
	plugin: GrampsWebPlugin;
	private password = '';

	constructor(app: App, plugin: GrampsWebPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Server').setHeading();

		new Setting(containerEl)
			.setName('Server URL')
			.setDesc('The base URL of your Gramps Web server, e.g. https://gramps.example.com.')
			.addText((text) =>
				text
					.setPlaceholder('https://gramps.example.com')
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value;
						await this.plugin.saveSettings();
						this.plugin.onServerSettingsChanged();
					}),
			);

		new Setting(containerEl)
			.setName('Username')
			.setDesc('Your Gramps Web username.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.username)
					.onChange(async (value) => {
						this.plugin.settings.username = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Password')
			.setDesc(
				'Used only to sign in. The password itself is never stored; only the resulting session tokens are, in ' +
					"Obsidian's secret storage (device-local, not synced).",
			)
			.addText((text) => {
				text.inputEl.type = 'password';
				text.onChange((value) => {
					this.password = value;
				});
			});

		const statusSetting = new Setting(containerEl).setName('Connection');
		this.renderStatus(statusSetting.descEl);
		statusSetting
			.addButton((btn) =>
				btn
					.setButtonText('Sign in')
					.setCta()
					.onClick(async () => {
						if (!this.plugin.settings.serverUrl || !this.plugin.settings.username) {
							new Notice('Set the server URL and username first.');
							return;
						}
						if (!this.password) {
							new Notice('Enter your password first.');
							return;
						}
						try {
							await this.plugin.client.login(
								this.plugin.settings.username,
								this.password,
							);
							this.password = '';
							new Notice('Signed in to Gramps Web.');
							await this.plugin.refreshTreeInfo();
							this.display();
						} catch (e) {
							this.showApiError(e);
						}
					}),
			)
			.addButton((btn) =>
				btn.setButtonText('Sign out').onClick(async () => {
					this.plugin.client.signOut();
					this.plugin.settings.treeName = '';
					await this.plugin.saveSettings();
					new Notice('Signed out of Gramps Web.');
					this.display();
				}),
			)
			.addButton((btn) =>
				btn.setButtonText('Test connection').onClick(async () => {
					try {
						const info = await this.plugin.refreshTreeInfo();
						new Notice(
							`Connected to Gramps Web ${info.apiVersion ?? ''}. Tree: ${
								info.treeName || '(unnamed)'
							}. Role: ${info.role ?? 'unknown'}.`,
						);
						this.display();
					} catch (e) {
						this.showApiError(e);
					}
				}),
			);

		new Setting(containerEl)
			.setName('Locale')
			.setDesc(
				'Language code for translated place/event text from the server (e.g. "de" or "fr"). Leave empty to use the server default.',
			)
			.addText((text) =>
				text
					.setPlaceholder('en')
					.setValue(this.plugin.settings.locale)
					.onChange(async (value) => {
						this.plugin.settings.locale = value;
						await this.plugin.saveSettings();
						this.plugin.onServerSettingsChanged();
					}),
			);

		new Setting(containerEl).setName('Links').setHeading();

		new Setting(containerEl)
			.setName('Enable inline link trigger')
			.setDesc(
				'Type the trigger string to search and insert a Gramps link while typing, without a command. Disabled by default to avoid hijacking keystrokes. Requires reloading the plugin after changing.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.inlineTriggerEnabled)
					.onChange(async (value) => {
						this.plugin.settings.inlineTriggerEnabled = value;
						await this.plugin.saveSettings();
						new Notice('Reload the plugin for this change to take effect.');
					}),
			);

		new Setting(containerEl)
			.setName('Inline trigger string')
			.setDesc(
				'Text that triggers the inline suggester (default "@@"). Avoid a single "@", which clashes with the Natural Language Dates and At People plugins; avoid "*" and "+", used for birth/death marks. Requires reloading the plugin after changing.',
			)
			.addText((text) =>
				text
					.setPlaceholder('@@')
					.setValue(this.plugin.settings.inlineTriggerString)
					.onChange(async (value) => {
						this.plugin.settings.inlineTriggerString = value || '@@';
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderStatus(el: HTMLElement): void {
		el.empty();
		const signedIn = this.plugin.client.isSignedIn();
		const parts = [signedIn ? 'Signed in.' : 'Not signed in.'];
		if (this.plugin.settings.treeName) {
			parts.push(`Tree: ${this.plugin.settings.treeName}.`);
		}
		el.setText(parts.join(' '));
	}

	private showApiError(e: unknown): void {
		if (e instanceof GrampsApiError) {
			new Notice(`Gramps Web: ${e.message}`);
		} else {
			new Notice('Gramps Web: unexpected error. See console for details.');
			console.error(e);
		}
	}
}
