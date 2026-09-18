import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from 'obsidian';
import type GrampsWebPlugin from '../main';
import { SearchHit } from '../api/types';
import { objectDisplayLabel, searchHitObjectType } from '../api/format';
import { parseSearchQuery } from '../api/search-query';
import { formatGrampsMarkdownLink } from '../links/uri';
import { notifyApiError } from '../notices';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Opt-in inline trigger: typing the configured trigger string (default
 * `@@`) opens a suggester for Gramps objects, inserting a `gramps://` link
 * on selection. Only registered when enabled in settings.
 */
export class GrampsInlineSuggest extends EditorSuggest<SearchHit> {
	private debounceTimer?: number;

	constructor(
		app: App,
		private plugin: GrampsWebPlugin,
	) {
		super(app);
		this.setInstructions([
			{ command: 'type:', purpose: 'filter by type, e.g. "person:" or "p:"' },
		]);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		const trigger = this.plugin.settings.inlineTriggerString;
		if (!trigger) return null;
		const lineText = editor.getLine(cursor.line).slice(0, cursor.ch);
		const idx = lineText.lastIndexOf(trigger);
		if (idx === -1) return null;
		const query = lineText.slice(idx + trigger.length);
		// Bail out once the query looks like it left the intended mention
		// (blank line, or the user kept typing past a reasonable length).
		if (/\s{2,}/.test(query) || query.length > 100) return null;
		return {
			start: { line: cursor.line, ch: idx },
			end: cursor,
			query,
		};
	}

	getSuggestions(context: EditorSuggestContext): Promise<SearchHit[]> {
		const { type, query } = parseSearchQuery(context.query);
		this.setInstructions([
			type
				? { command: `Type: ${type}`, purpose: 'active filter' }
				: { command: 'type:', purpose: 'filter by type, e.g. "person:" or "p:"' },
		]);
		if (!query.trim()) return Promise.resolve([]);
		return new Promise((resolve) => {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = window.setTimeout(() => {
				this.plugin.client
					.search(query, {
						pagesize: 20,
						types: type ? [type.toLowerCase()] : undefined,
					})
					.then(resolve)
					.catch((e: unknown) => {
						notifyApiError(e, 'Search');
						resolve([]);
					});
			}, SEARCH_DEBOUNCE_MS);
		});
	}

	renderSuggestion(hit: SearchHit, el: HTMLElement): void {
		const type = searchHitObjectType(hit);
		el.createDiv({
			text: type ? objectDisplayLabel(type, hit.object) : hit.object_type,
		});
	}

	selectSuggestion(hit: SearchHit, _evt: MouseEvent | KeyboardEvent): void {
		const type = searchHitObjectType(hit);
		if (!type || !this.context) return;
		this.plugin.cache.set(type, hit.object);
		const label = objectDisplayLabel(type, hit.object);
		const link = formatGrampsMarkdownLink(type, hit.handle, label);
		this.context.editor.replaceRange(link, this.context.start, this.context.end);
	}
}
