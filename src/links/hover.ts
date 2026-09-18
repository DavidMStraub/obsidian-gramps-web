import { HoverParent, HoverPopover } from 'obsidian';
import type GrampsWebPlugin from '../main';
import { GrampsLink } from './uri';
import { findGrampsLinkAt } from './click';
import { renderObjectCard } from '../ui/cards';

const HOVER_DELAY_MS = 300;

class SimpleHoverParent implements HoverParent {
	hoverPopover: HoverPopover | null = null;
}

/** Shows a card (name, Gramps ID, life dates, thumbnail) when hovering a `gramps://` link. */
export function registerHoverCard(plugin: GrampsWebPlugin): void {
	let current: HTMLElement | null = null;
	let timer: number | undefined;

	plugin.registerDomEvent(
		document,
		'mouseover',
		(evt: MouseEvent) => {
			const found = findGrampsLinkAt(evt.target as HTMLElement | null);
			if (!found || found.el === current) return;
			const { el, link } = found;
			current = el;
			window.clearTimeout(timer);
			timer = window.setTimeout(
				() => void showHoverCard(plugin, el, link),
				HOVER_DELAY_MS,
			);
			el.addEventListener(
				'mouseleave',
				() => {
					window.clearTimeout(timer);
					current = null;
				},
				{ once: true },
			);
		},
		true,
	);
	plugin.register(() => window.clearTimeout(timer));
}

async function showHoverCard(
	plugin: GrampsWebPlugin,
	anchor: HTMLElement,
	link: GrampsLink,
): Promise<void> {
	const parent = new SimpleHoverParent();
	const popover = new HoverPopover(parent, anchor, 100);
	popover.hoverEl.addClass('gramps-web-hover-card');
	// Render into a child, so Obsidian's popover styles don't apply to the card
	const el = popover.hoverEl.createDiv({ text: 'Loading…' });
	try {
		let obj = plugin.cache.get(link.handle);
		if (!obj) {
			obj = await plugin.client.getObjectByHandle(link.type, link.handle, {
				profile: ['self'],
			});
			plugin.cache.set(link.type, obj);
		}
		await renderObjectCard(plugin, el, link.type, obj);
	} catch {
		el.empty();
		el.setText('Could not load from Gramps Web.');
	}
}
