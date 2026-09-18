import type GrampsWebPlugin from '../main';
import { EditorView } from '@codemirror/view';
import { GrampsLink, findGrampsMarkdownLinkInLine, parseGrampsUri } from './uri';
import { notifyApiError } from '../notices';

/** Resolves a handle to its Gramps ID and opens the object's page on the Gramps Web server. */
export async function openGrampsLink(
	plugin: GrampsWebPlugin,
	link: GrampsLink,
): Promise<void> {
	if (!plugin.settings.serverUrl) {
		notifyApiError(
			new Error('Gramps Web is not configured. Set the server URL in settings.'),
		);
		return;
	}
	try {
		let obj = plugin.cache.get(link.handle);
		if (!obj) {
			// same profile as the hover card, since both share the cache
			obj = await plugin.client.getObjectByHandle(link.type, link.handle, {
				profile: ['self'],
			});
			plugin.cache.set(link.type, obj);
		}
		const grampsId = obj.gramps_id ?? link.handle;
		const base = plugin.settings.serverUrl.replace(/\/+$/, '');
		const url = `${base}/${link.type.toLowerCase()}/${grampsId}`;
		window.open(url, '_blank');
	} catch (e) {
		notifyApiError(e, 'Open in Gramps Web');
	}
}

/** The rendered `gramps://` link element at `target` (reading view or live preview) and its link. */
export function findGrampsLinkAt(
	target: HTMLElement | null,
): { el: HTMLElement; link: GrampsLink } | null {
	const anchor = target?.closest('a');
	if (anchor) {
		const href = anchor.getAttribute('href');
		const link = href?.startsWith('gramps://') ? parseGrampsUri(href) : null;
		return link ? { el: anchor, link } : null;
	}
	const label = target?.closest<HTMLElement>('.cm-underline');
	const link = label ? linkFromLivePreview(label) : null;
	return label && link ? { el: label, link } : null;
}

/**
 * Live preview renders a Markdown link's label as a `span.cm-underline`
 * without the URI, so look up the link in the document source instead.
 */
function linkFromLivePreview(label: HTMLElement): GrampsLink | null {
	const editorEl = label.closest('.cm-editor');
	if (!(editorEl instanceof HTMLElement)) return null;
	const view = EditorView.findFromDOM(editorEl);
	if (!view) return null;
	const pos = view.posAtDOM(label);
	const line = view.state.doc.lineAt(pos);
	return findGrampsMarkdownLinkInLine(line.text, pos - line.from);
}

/**
 * Intercepts clicks on `gramps://` links anywhere in the app (reading view,
 * and rendered link widgets in live preview) before Obsidian hands the
 * unknown URI scheme off to the OS.
 */
export function registerLinkClickHandling(plugin: GrampsWebPlugin): void {
	plugin.registerDomEvent(
		document,
		'click',
		(evt: MouseEvent) => {
			const link = findGrampsLinkAt(evt.target as HTMLElement | null)?.link;
			if (!link) return;
			evt.preventDefault();
			evt.stopPropagation();
			void openGrampsLink(plugin, link);
		},
		true,
	);
}
