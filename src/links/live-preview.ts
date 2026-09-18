import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import type GrampsWebPlugin from '../main';
import { openGrampsLink } from './click';
import { findGrampsUriInLine } from './uri';

/**
 * CM6 extension that makes `gramps://` URIs clickable in live preview even
 * when shown as raw, unrendered markdown source (the case a plain
 * `registerMarkdownPostProcessor`/DOM click handler can't reach, since no
 * `<a>` element exists yet on that line).
 */
export function buildLivePreviewExtension(plugin: GrampsWebPlugin): Extension {
	return EditorView.domEventHandlers({
		click: (event, view) => {
			// Rendered links (an actual <a href="gramps://...">) are already
			// handled by the document-level click handler in links/click.ts.
			if ((event.target as HTMLElement | null)?.closest('a')) return false;
			const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
			if (pos == null) return false;
			const line = view.state.doc.lineAt(pos);
			const link = findGrampsUriInLine(line.text, pos - line.from);
			if (link) {
				event.preventDefault();
				void openGrampsLink(plugin, link);
				return true;
			}
			return false;
		},
	});
}
