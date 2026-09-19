import { describe, expect, it } from 'vitest';
import {
	findGrampsMarkdownLinkInLine,
	findGrampsUriInLine,
	formatGrampsMarkdownLink,
	formatGrampsUri,
	parseGrampsUri,
} from './uri';

describe('parseGrampsUri', () => {
	it('parses a handle URI', () => {
		expect(parseGrampsUri('gramps://Person/handle/abc123')).toEqual({
			type: 'Person',
			handle: 'abc123',
		});
	});

	it('normalizes the type case, as Gramps Web emits lowercase types', () => {
		expect(parseGrampsUri('gramps://person/handle/abc')?.type).toBe('Person');
		expect(parseGrampsUri('gramps://NOTE/handle/abc')?.type).toBe('Note');
	});

	it('accepts a trailing slash and surrounding whitespace', () => {
		expect(parseGrampsUri(' gramps://Event/handle/e1/ ')).toEqual({
			type: 'Event',
			handle: 'e1',
		});
	});

	it.each([
		'https://example.org/person/I0044',
		'gramps://Person/gramps_id/I0044',
		'gramps://Unknown/handle/abc',
		'gramps://Person/handle/',
		'gramps://Person/handle/a/b',
		'',
	])('rejects %j', (uri) => {
		expect(parseGrampsUri(uri)).toBeNull();
	});
});

describe('formatting', () => {
	it('round-trips through parseGrampsUri', () => {
		const uri = formatGrampsUri('Family', 'f00');
		expect(uri).toBe('gramps://Family/handle/f00');
		expect(parseGrampsUri(uri)).toEqual({ type: 'Family', handle: 'f00' });
	});

	it('builds a Markdown link', () => {
		expect(formatGrampsMarkdownLink('Person', 'h1', 'Johann Straub (I0044)')).toBe(
			'[Johann Straub (I0044)](gramps://Person/handle/h1)',
		);
	});
});

describe('findGrampsUriInLine', () => {
	const line = 'See [Johann](gramps://Person/handle/h1) and [Anna](gramps://Person/handle/h2).';
	const uri1 = line.indexOf('gramps://');
	const uri2 = line.lastIndexOf('gramps://');

	it('finds the URI containing the column', () => {
		expect(findGrampsUriInLine(line, uri1 + 3)?.handle).toBe('h1');
		expect(findGrampsUriInLine(line, uri2 + 3)?.handle).toBe('h2');
	});

	it('does not match on the label', () => {
		expect(findGrampsUriInLine(line, line.indexOf('Johann'))).toBeNull();
	});

	it('does not include the closing parenthesis in the handle', () => {
		expect(findGrampsUriInLine(line, uri1)?.handle).toBe('h1');
	});

	it('works when called repeatedly (global regex state)', () => {
		expect(findGrampsUriInLine(line, uri2 + 3)?.handle).toBe('h2');
		expect(findGrampsUriInLine(line, uri1 + 3)?.handle).toBe('h1');
	});
});

describe('findGrampsMarkdownLinkInLine', () => {
	const line = 'See [Johann](gramps://Person/handle/h1) and [Anna](gramps://Person/handle/h2).';

	it('matches anywhere in the link, label included', () => {
		const start = line.indexOf('[Johann]');
		const end = line.indexOf(')') + 1;
		expect(findGrampsMarkdownLinkInLine(line, start)?.handle).toBe('h1');
		expect(findGrampsMarkdownLinkInLine(line, line.indexOf('Johann'))?.handle).toBe('h1');
		expect(findGrampsMarkdownLinkInLine(line, end - 1)?.handle).toBe('h1');
		expect(findGrampsMarkdownLinkInLine(line, end)).toBeNull();
	});

	it('distinguishes links on the same line', () => {
		expect(findGrampsMarkdownLinkInLine(line, line.indexOf('Anna'))?.handle).toBe('h2');
	});

	it('ignores text outside links and non-Gramps links', () => {
		expect(findGrampsMarkdownLinkInLine(line, 0)).toBeNull();
		const web = '[Site](https://example.org)';
		expect(findGrampsMarkdownLinkInLine(web, 1)).toBeNull();
	});
});
