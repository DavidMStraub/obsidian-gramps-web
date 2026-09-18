/**
 * Types describing the slice of the Gramps Web API this plugin uses.
 *
 * These are intentionally partial: only the fields the plugin reads are
 * declared, since the API returns much more than we need.
 */

/** Object types as used in the `gramps://` URI scheme (capitalized). */
export type GrampsObjectType =
	| 'Person'
	| 'Family'
	| 'Event'
	| 'Place'
	| 'Source'
	| 'Citation'
	| 'Repository'
	| 'Media'
	| 'Note';

/** Lowercase form, as used by the Gramps Web API and frontend routes. */
export type GrampsObjectTypeLower = Lowercase<GrampsObjectType>;

export const GRAMPS_OBJECT_TYPES: readonly GrampsObjectType[] = [
	'Person',
	'Family',
	'Event',
	'Place',
	'Source',
	'Citation',
	'Repository',
	'Media',
	'Note',
];

export function toApiPath(type: GrampsObjectType): string {
	// e.g. Person -> people, Family -> families, others: + "s"
	switch (type) {
		case 'Person':
			return 'people';
		case 'Family':
			return 'families';
		default:
			return `${type.toLowerCase()}s`;
	}
}

export function toRouteSegment(type: GrampsObjectType): GrampsObjectTypeLower {
	return type.toLowerCase() as GrampsObjectTypeLower;
}

export interface TokenPair {
	access_token: string;
	refresh_token: string;
}

export interface AccessTokenOnly {
	access_token: string;
}

export interface SurnameEntry {
	surname?: string;
	prefix?: string;
	primary?: boolean;
	connector?: string;
}

export interface NameEntry {
	first_name?: string;
	surname_list?: SurnameEntry[];
	call?: string;
	suffix?: string;
}

export interface EventProfile {
	date?: string;
	place?: string;
	place_name?: string;
	type?: string;
}

export interface PersonProfile {
	birth?: EventProfile;
	death?: EventProfile;
	gramps_id?: string;
	name_given?: string;
	name_surname?: string;
	sex?: string;
}

export interface MediaRef {
	ref: string;
}

/** A Gramps object as returned by the API. Deliberately loose: only the
 * fields we read are typed; everything else passes through untouched. */
export interface GrampsObject {
	_class?: string;
	handle: string;
	gramps_id?: string;
	primary_name?: NameEntry;
	media_list?: MediaRef[];
	profile?: PersonProfile;
	// Note fields
	text?: { string?: string };
	formatted?: { html?: string };
	// Event fields
	type?: { string?: string } | string;
	date?: { string?: string } | string;
	description?: string;
	// Place fields
	name?: { value?: string } | string;
	title?: string;
	// Source fields
	author?: string;
	[key: string]: unknown;
}

export interface SearchHit {
	handle: string;
	object: GrampsObject;
	object_type: string;
	score?: number;
}

export interface Metadata {
	database?: {
		version?: string;
	};
	gramps_webapi?: {
		version?: string;
	};
	[key: string]: unknown;
}

export interface UserDetails {
	name?: string;
	full_name?: string;
	role?: number;
	tree?: string;
	[key: string]: unknown;
}

export interface TreeDetails {
	id?: string;
	name?: string;
	[key: string]: unknown;
}
