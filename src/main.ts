import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, GrampsWebSettings, GrampsWebSettingTab } from './settings';
import { TokenStore } from './api/auth';
import { GrampsClient } from './api/client';
import { GrampsCache } from './api/cache';
import { registerCommands } from './commands';
import { registerLinkClickHandling } from './links/click';
import { buildLivePreviewExtension } from './links/live-preview';
import { registerHoverCard } from './links/hover';
import { registerGrampsCodeBlock } from './codeblock/gramps-block';
import { GrampsInlineSuggest } from './ui/editor-suggest';

export interface ConnectionInfo {
	apiVersion?: string;
	treeName: string;
	role?: number;
}

export default class GrampsWebPlugin extends Plugin {
	settings!: GrampsWebSettings;
	tokens!: TokenStore;
	client!: GrampsClient;
	cache!: GrampsCache;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.tokens = new TokenStore(this.app, () => this.settings);
		this.client = new GrampsClient(this.tokens, {
			serverUrl: this.settings.serverUrl,
			locale: this.settings.locale || undefined,
		}, `obsidian-gramps-web/${this.manifest.version}`);
		this.cache = new GrampsCache();

		this.addSettingTab(new GrampsWebSettingTab(this.app, this));

		registerCommands(this);
		registerLinkClickHandling(this);
		this.registerEditorExtension(buildLivePreviewExtension(this));
		registerHoverCard(this);
		registerGrampsCodeBlock(this);

		if (this.settings.inlineTriggerEnabled) {
			this.registerEditorSuggest(new GrampsInlineSuggest(this.app, this));
		}
	}

	onunload(): void {
		// All listeners/extensions were registered via this.register* helpers
		// and are cleaned up automatically.
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<GrampsWebSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** Called after the server URL or locale changes: rebuilds the client and drops the object cache. */
	onServerSettingsChanged(): void {
		this.client.updateOptions({
			serverUrl: this.settings.serverUrl,
			locale: this.settings.locale || undefined,
		});
		this.cache.clear();
	}

	/** Fetches server metadata, the signed-in user's role, and the bound tree's name. */
	async refreshTreeInfo(): Promise<ConnectionInfo> {
		const [metadata, user, trees] = await Promise.all([
			this.client.getMetadata(),
			this.client.getCurrentUser(),
			this.client.getTrees().catch(() => []),
		]);
		const treeName = trees[0]?.name ?? '';
		this.settings.treeName = treeName;
		await this.saveSettings();
		return {
			apiVersion: metadata.gramps_webapi?.version,
			treeName,
			role: user.role,
		};
	}
}
