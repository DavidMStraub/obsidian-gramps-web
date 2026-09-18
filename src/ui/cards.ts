import type GrampsWebPlugin from '../main';
import { GrampsObject, GrampsObjectType } from '../api/types';
import {
	formatLifeDates,
	formatPersonName,
	objectDisplayLabel,
} from '../api/format';
/**
 * Renders a compact card for a Gramps object into `el`. Shared between the
 * hover card and the `gramps` code block so both look and behave the same.
 */
export async function renderObjectCard(
	plugin: GrampsWebPlugin,
	el: HTMLElement,
	type: GrampsObjectType,
	obj: GrampsObject,
): Promise<void> {
	el.empty();
	el.addClass('gramps-web-card', `gramps-web-card-${type.toLowerCase()}`);

	const mediaHandle = obj.media_list?.[0]?.ref;
	if (mediaHandle) {
		const dataUri = await plugin.client.getThumbnailDataUri(mediaHandle, 100);
		if (dataUri) {
			const img = el.createEl('img', { cls: 'gramps-web-card-thumb' });
			img.src = dataUri;
			img.alt = '';
		}
	}

	const body = el.createDiv({ cls: 'gramps-web-card-body' });
	const link = plugin.settings.serverUrl
		? `${plugin.settings.serverUrl.replace(/\/+$/, '')}/${type.toLowerCase()}/${
				obj.gramps_id ?? obj.handle
			}`
		: undefined;

	const titleEl = body.createEl(link ? 'a' : 'div', {
		cls: 'gramps-web-card-title',
		text: type === 'Person' ? formatPersonName(obj) : objectDisplayLabel(type, obj),
	});
	if (link && titleEl instanceof HTMLAnchorElement) {
		titleEl.href = link;
		titleEl.target = '_blank';
		titleEl.rel = 'noopener';
	}

	body.createDiv({ cls: 'gramps-web-card-id', text: obj.gramps_id ?? obj.handle });

	if (type === 'Person') {
		const dates = formatLifeDates(obj);
		if (dates) {
			body.createDiv({ cls: 'gramps-web-card-dates', text: dates });
		}
	} else if (type === 'Note') {
		const text = obj.text?.string;
		if (text) {
			body.createDiv({
				cls: 'gramps-web-card-note-preview',
				text: text.length > 200 ? `${text.slice(0, 200)}…` : text,
			});
		}
	}
}
