import { App, SuggestModal } from 'obsidian';
import type GrampsWebPlugin from '../main';
import { GrampsObjectType, SearchHit } from '../api/types';
import { objectDisplayLabel, searchHitObjectType } from '../api/format';
import { parseSearchQuery } from '../api/search-query';
import { notifyApiError } from '../notices';

const SEARCH_DEBOUNCE_MS = 250;

/** Search picker used by the "Insert Gramps link" command and the inline trigger. */
export class GrampsSearchModal extends SuggestModal<SearchHit> {
	private debounceTimer?: number;
	// Created here rather than in onOpen, because super.onOpen() already
	// calls getSuggestions()
	private filterEl: HTMLElement;

	constructor(
		app: App,
		private plugin: GrampsWebPlugin,
		private initialQuery: string,
		private onChoose: (hit: SearchHit, type: GrampsObjectType) => void,
	) {
		super(app);
		this.setPlaceholder('Search Gramps Web… (prefix with a type, e.g. "person:" or "p:")');
		this.filterEl = createDiv({ cls: 'gramps-web-search-filter' });
		this.resultContainerEl.before(this.filterEl);
	}

	onOpen(): void {
		void super.onOpen();
		this.setInstructions([
			{ command: 'type:', purpose: 'filter by type, e.g. "person:" or "p:"' },
		]);
		if (this.initialQuery) {
			this.inputEl.value = this.initialQuery;
			this.inputEl.dispatchEvent(new Event('input'));
		}
	}

	private updateFilterChip(type: GrampsObjectType | undefined): void {
		this.filterEl.empty();
		if (type) {
			this.filterEl.createSpan({ cls: 'gramps-web-filter-chip', text: `Type: ${type}` });
		}
	}

	getSuggestions(raw: string): Promise<SearchHit[]> {
		const { type, query } = parseSearchQuery(raw);
		this.updateFilterChip(type);
		if (!query.trim()) return Promise.resolve([]);
		return new Promise((resolve) => {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = window.setTimeout(() => {
				this.plugin.client
					.search(query, { pagesize: 20, types: type ? [type.toLowerCase()] : undefined })
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
			cls: 'gramps-web-suggestion-title',
			text: type ? objectDisplayLabel(type, hit.object) : hit.object_type,
		});
		el.createDiv({ cls: 'gramps-web-suggestion-type', text: hit.object_type });
	}

	onChooseSuggestion(hit: SearchHit, _evt: MouseEvent | KeyboardEvent): void {
		const type = searchHitObjectType(hit);
		if (!type) return;
		this.plugin.cache.set(type, hit.object);
		this.onChoose(hit, type);
	}
}
