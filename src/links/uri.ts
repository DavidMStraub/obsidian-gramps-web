import { GRAMPS_OBJECT_TYPES, GrampsObjectType } from '../api/types';

export const GRAMPS_URI_SCHEME = 'gramps://';

export interface GrampsLink {
	type: GrampsObjectType;
	handle: string;
}

const URI_RE = /^gramps:\/\/([A-Za-z]+)\/handle\/([^/?#]+)\/?$/;

/** Parses a `gramps://Type/handle/<handle>` URI. Returns null if it doesn't match. */
export function parseGrampsUri(uri: string): GrampsLink | null {
	const match = URI_RE.exec(uri.trim());
	if (!match) return null;
	const [, rawType, handle] = match;
	const type = GRAMPS_OBJECT_TYPES.find(
		(t) => t.toLowerCase() === rawType!.toLowerCase(),
	);
	if (!type || !handle) return null;
	return { type, handle };
}

/** Builds a `gramps://Type/handle/<handle>` URI with the canonical capitalized type name. */
export function formatGrampsUri(type: GrampsObjectType, handle: string): string {
	return `${GRAMPS_URI_SCHEME}${type}/handle/${handle}`;
}

/** Builds the full Markdown link `[label](gramps://Type/handle/<handle>)`. */
export function formatGrampsMarkdownLink(
	type: GrampsObjectType,
	handle: string,
	label: string,
): string {
	return `[${label}](${formatGrampsUri(type, handle)})`;
}

// Matches a bare gramps:// URI wherever it appears in a line of text, e.g.
// inside `[label](gramps://Person/handle/xyz)` markdown-link syntax.
const URI_SCAN_RE = /gramps:\/\/[A-Za-z]+\/handle\/[^\s)\]]+/g;

/** Finds the `gramps://` URI (if any) whose span in `lineText` contains column `ch`. */
export function findGrampsUriInLine(lineText: string, ch: number): GrampsLink | null {
	URI_SCAN_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = URI_SCAN_RE.exec(lineText))) {
		const start = match.index;
		const end = start + match[0].length;
		if (ch >= start && ch <= end) {
			return parseGrampsUri(match[0]);
		}
	}
	return null;
}

// A whole `[label](gramps://…)` Markdown link; group 1 is the URI.
const MARKDOWN_LINK_SCAN_RE = /\[[^\]\n]*\]\((gramps:\/\/[^\s)]+)\)/g;

/** Finds the `[label](gramps://…)` link (if any) whose span in `lineText`, label included, contains column `ch`. */
export function findGrampsMarkdownLinkInLine(
	lineText: string,
	ch: number,
): GrampsLink | null {
	MARKDOWN_LINK_SCAN_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = MARKDOWN_LINK_SCAN_RE.exec(lineText))) {
		const start = match.index;
		const end = start + match[0].length;
		if (ch >= start && ch < end) {
			return parseGrampsUri(match[1]!);
		}
	}
	return null;
}
