import { sanitizeHTMLToDom } from 'obsidian';
import type GrampsWebPlugin from '../main';
import { GRAMPS_OBJECT_TYPES, GrampsObject, GrampsObjectType } from '../api/types';
import { renderObjectCard } from '../ui/cards';
import { notifyApiError } from '../notices';

export interface ParsedCodeBlock {
	type: GrampsObjectType;
	grampsId: string;
}

/** Parses a `gramps` code block body, e.g. "person: I0044" or "note: N0012". */
export function parseCodeBlockSource(source: string): ParsedCodeBlock | null {
	const line = source
		.split('\n')
		.map((l) => l.trim())
		.find((l) => l.length > 0);
	if (!line) return null;
	const match = /^([A-Za-z]+)\s*:\s*(\S+)$/.exec(line);
	if (!match) return null;
	const [, rawType, grampsId] = match;
	const type = GRAMPS_OBJECT_TYPES.find(
		(t) => t.toLowerCase() === rawType!.toLowerCase(),
	);
	if (!type || !grampsId) return null;
	return { type, grampsId };
}

/** Registers the `gramps` code block processor: a live card for any object, or a read-only note embed. */
export function registerGrampsCodeBlock(plugin: GrampsWebPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor('gramps', async (source, el) => {
		const parsed = parseCodeBlockSource(source);
		if (!parsed) {
			el.createDiv({
				cls: 'gramps-web-card-error',
				text: 'Invalid gramps code block. Expected e.g. "person: I0044".',
			});
			return;
		}
		const { type, grampsId } = parsed;
		const container = el.createDiv({ cls: 'gramps-web-block' });
		container.setText('Loading…');
		try {
			const obj = await fetchObject(plugin, type, grampsId);
			if (type === 'Note') {
				renderNoteEmbed(container, obj);
			} else {
				await renderObjectCard(plugin, container, type, obj);
			}
		} catch (e) {
			container.empty();
			container.addClass('gramps-web-card-error');
			container.setText(
				e instanceof Error ? e.message : 'Could not load from Gramps Web.',
			);
			notifyApiError(e, `Gramps ${type} ${grampsId}`);
		}
	});
}

async function fetchObject(
	plugin: GrampsWebPlugin,
	type: GrampsObjectType,
	grampsId: string,
): Promise<GrampsObject> {
	const needsHtml = type === 'Note';
	const cachedHandle = plugin.cache.getHandleForGrampsId(type, grampsId);
	const cached = cachedHandle ? plugin.cache.get(cachedHandle) : undefined;
	if (cached && (!needsHtml || cached.formatted?.html)) {
		return cached;
	}
	const obj = await plugin.client.getObjectByGrampsId(type, grampsId, {
		profile: ['self'],
		formats: needsHtml ? ['html'] : undefined,
	});
	plugin.cache.set(type, obj);
	return obj;
}

function renderNoteEmbed(el: HTMLElement, obj: GrampsObject): void {
	el.empty();
	el.addClass('gramps-web-note-embed');
	const html = obj.formatted?.html;
	if (html) {
		// The note's own gramps:// links (Gramps uses the same URI scheme)
		// keep working as-is: the plugin's global link click handler matches
		// any `a[href^="gramps://"]`, wherever it is in the DOM.
		el.appendChild(sanitizeHTMLToDom(html));
	} else if (obj.text?.string) {
		el.setText(obj.text.string);
	} else {
		el.setText('Empty note');
	}
}
