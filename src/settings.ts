import {
	App,
	Notice,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
} from 'obsidian';
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

interface SettingItem {
	name: string;
	desc?: string;
	aliases?: string[];
	render: (setting: Setting) => void;
}

interface SettingSection {
	heading: string;
	items: SettingItem[];
}

/**
 * Settings are defined once as render definitions. Obsidian 1.13+ renders
 * them via getSettingDefinitions() (which also makes them searchable);
 * display() renders the same definitions on older versions.
 */
export class GrampsWebSettingTab extends PluginSettingTab {
	plugin: GrampsWebPlugin;
	private password = '';
	private statusEl?: HTMLElement;

	constructor(app: App, plugin: GrampsWebPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.sections().map(({ heading, items }) => ({
			type: 'group',
			heading,
			items: items.map(({ render, ...item }) => ({
				...item,
				render: (setting: Setting) => render(setting),
			})),
		}));
	}

	/** Fallback for Obsidian versions before 1.13. */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		for (const { heading, items } of this.sections()) {
			new Setting(containerEl).setName(heading).setHeading();
			for (const item of items) {
				const setting = new Setting(containerEl).setName(item.name);
				if (item.desc) setting.setDesc(item.desc);
				item.render(setting);
			}
		}
	}

	private sections(): SettingSection[] {
		const { settings } = this.plugin;
		return [
			{
				heading: 'Server',
				items: [
					{
						name: 'Server URL',
						desc: 'The base URL of your Gramps Web server, e.g. https://grampshub.com.',
						render: (setting) => {
							setting.addText((text) =>
								text
									.setPlaceholder('https://grampshub.com')
									.setValue(settings.serverUrl)
									.onChange(async (value) => {
										settings.serverUrl = value;
										await this.plugin.saveSettings();
										this.plugin.onServerSettingsChanged();
										this.renderStatus();
									}),
							);
						},
					},
					{
						name: 'Username',
						desc: 'Your Gramps Web username.',
						render: (setting) => {
							setting.addText((text) =>
								text.setValue(settings.username).onChange(async (value) => {
									settings.username = value;
									await this.plugin.saveSettings();
									this.renderStatus();
								}),
							);
						},
					},
					{
						name: 'Password',
						desc:
							'Used only to sign in. The password itself is never stored; only the resulting session tokens are, in ' +
							"Obsidian's secret storage (device-local, not synced).",
						aliases: ['sign in', 'login'],
						render: (setting) => {
							setting.addText((text) => {
								text.inputEl.type = 'password';
								text.onChange((value) => {
									this.password = value;
								});
							});
						},
					},
					{
						name: 'Connection',
						aliases: ['sign in', 'sign out', 'test connection'],
						render: (setting) => {
							this.statusEl = setting.descEl;
							this.renderStatus();
							setting
								.addButton((btn) =>
									btn
										.setButtonText('Sign in')
										.setCta()
										.onClick(() => void this.signIn()),
								)
								.addButton((btn) =>
									btn.setButtonText('Sign out').onClick(() => void this.signOut()),
								)
								.addButton((btn) =>
									btn
										.setButtonText('Test connection')
										.onClick(() => void this.testConnection()),
								);
						},
					},
					{
						name: 'Locale',
						desc: 'Language code for translated place/event text from the server (e.g. "de" or "fr"). Leave empty to use the server default.',
						aliases: ['language'],
						render: (setting) => {
							setting.addText((text) =>
								text
									.setPlaceholder('en')
									.setValue(settings.locale)
									.onChange(async (value) => {
										settings.locale = value;
										await this.plugin.saveSettings();
										this.plugin.onServerSettingsChanged();
									}),
							);
						},
					},
				],
			},
			{
				heading: 'Links',
				items: [
					{
						name: 'Enable inline link trigger',
						desc: 'Type the trigger string to search and insert a Gramps link while typing, without a command. Disabled by default to avoid hijacking keystrokes.',
						render: (setting) => {
							setting.addToggle((toggle) =>
								toggle
									.setValue(settings.inlineTriggerEnabled)
									.onChange(async (value) => {
										settings.inlineTriggerEnabled = value;
										await this.plugin.saveSettings();
									}),
							);
						},
					},
					{
						name: 'Inline trigger string',
						desc: 'Text that triggers the inline suggester (default "@@"). Avoid a single "@", which clashes with the Natural Language Dates and At People plugins; avoid "*" and "+", used for birth/death marks.',
						render: (setting) => {
							setting.addText((text) =>
								text
									.setPlaceholder('@@')
									.setValue(settings.inlineTriggerString)
									.onChange(async (value) => {
										settings.inlineTriggerString = value || '@@';
										await this.plugin.saveSettings();
									}),
							);
						},
					},
				],
			},
		];
	}

	private async signIn(): Promise<void> {
		const { settings } = this.plugin;
		if (!settings.serverUrl || !settings.username) {
			new Notice('Set the server URL and username first.');
			return;
		}
		if (!this.password) {
			new Notice('Enter your password first.');
			return;
		}
		try {
			await this.plugin.client.login(settings.username, this.password);
			this.password = '';
			new Notice('Signed in to Gramps Web.');
			await this.plugin.refreshTreeInfo();
		} catch (e) {
			this.showApiError(e);
		}
		this.renderStatus();
	}

	private async signOut(): Promise<void> {
		this.plugin.client.signOut();
		this.plugin.settings.treeName = '';
		await this.plugin.saveSettings();
		new Notice('Signed out of Gramps Web.');
		this.renderStatus();
	}

	private async testConnection(): Promise<void> {
		try {
			const info = await this.plugin.refreshTreeInfo();
			new Notice(
				`Connected to Gramps Web ${info.apiVersion ?? ''}. Tree: ${
					info.treeName || '(unnamed)'
				}. Role: ${info.role ?? 'unknown'}.`,
			);
		} catch (e) {
			this.showApiError(e);
		}
		this.renderStatus();
	}

	private renderStatus(): void {
		if (!this.statusEl) return;
		const parts = [this.plugin.client.isSignedIn() ? 'Signed in.' : 'Not signed in.'];
		if (this.plugin.settings.treeName) {
			parts.push(`Tree: ${this.plugin.settings.treeName}.`);
		}
		this.statusEl.setText(parts.join(' '));
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
