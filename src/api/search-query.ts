import { GrampsObjectType } from './types';

/** Short aliases and full names (case-insensitive) accepted as a `type:` search prefix. */
const TYPE_PREFIXES: Record<string, GrampsObjectType> = {
	person: 'Person',
	p: 'Person',
	family: 'Family',
	f: 'Family',
	event: 'Event',
	e: 'Event',
	place: 'Place',
	pl: 'Place',
	source: 'Source',
	s: 'Source',
	citation: 'Citation',
	c: 'Citation',
	repository: 'Repository',
	r: 'Repository',
	media: 'Media',
	m: 'Media',
	note: 'Note',
	n: 'Note',
};

export interface ParsedSearchQuery {
	type?: GrampsObjectType;
	query: string;
}

/**
 * Parses an optional `<type>: rest` prefix from a search box query, e.g.
 * "person: johann" or "p: johann". Returns the whole input as `query` (with
 * no `type`) when there's no recognized prefix.
 */
export function parseSearchQuery(input: string): ParsedSearchQuery {
	const match = /^\s*([A-Za-z]+)\s*:\s*(.*)$/s.exec(input);
	if (match) {
		const [, prefix, rest] = match;
		const type = TYPE_PREFIXES[prefix!.toLowerCase()];
		if (type) {
			return { type, query: rest ?? '' };
		}
	}
	return { query: input };
}
