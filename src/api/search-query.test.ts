import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from './search-query';

describe('parseSearchQuery', () => {
	it.each([
		['person: Straub', 'Person', 'Straub'],
		['p: Straub', 'Person', 'Straub'],
		['P:Straub', 'Person', 'Straub'],
		['  family :  Straub Maier', 'Family', 'Straub Maier'],
		['pl: Tübingen', 'Place', 'Tübingen'],
		['n: ', 'Note', ''],
		['e:', 'Event', ''],
	])('parses %j', (input, type, query) => {
		expect(parseSearchQuery(input)).toEqual({ type, query });
	});

	it.each(['Straub', 'x: Straub', 'I0044', 'https://example.org', ''])(
		'leaves %j unfiltered',
		(input) => {
			expect(parseSearchQuery(input)).toEqual({ query: input });
		},
	);
});
