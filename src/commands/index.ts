import { Editor, MarkdownFileInfo, MarkdownView } from 'obsidian';
import type GrampsWebPlugin from '../main';
import { GrampsSearchModal } from '../ui/search-modal';
import { formatGrampsMarkdownLink } from '../links/uri';
import { objectDisplayLabel } from '../api/format';

export function registerCommands(plugin: GrampsWebPlugin): void {
	plugin.addCommand({
		id: 'insert-gramps-link',
		name: 'Insert Gramps link',
		editorCallback: (editor: Editor, _ctx: MarkdownView | MarkdownFileInfo) => {
			const selection = editor.getSelection();
			const modal = new GrampsSearchModal(plugin.app, plugin, selection, (hit, type) => {
				const label = selection || objectDisplayLabel(type, hit.object);
				const link = formatGrampsMarkdownLink(type, hit.handle, label);
				editor.replaceSelection(link);
			});
			modal.open();
		},
	});
}
