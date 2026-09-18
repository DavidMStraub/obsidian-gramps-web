import { GRAMPS_OBJECT_TYPES, GrampsObject, GrampsObjectType, SearchHit } from './types';

/** Maps a search hit's lowercase `object_type` (e.g. "person") to the canonical capitalized type. */
export function searchHitObjectType(hit: SearchHit): GrampsObjectType | null {
	const capitalized = hit.object_type.charAt(0).toUpperCase() + hit.object_type.slice(1);
	return GRAMPS_OBJECT_TYPES.find((t) => t === capitalized) ?? null;
}

/** Formats a person's primary name as "Given Surname" (best effort). */
export function formatPersonName(obj: GrampsObject): string {
	const name = obj.primary_name;
	if (!name) return obj.gramps_id ?? obj.handle;
	const given = name.first_name?.trim() ?? '';
	const surname = name.surname_list
		?.map((s) => `${s.prefix ? `${s.prefix} ` : ''}${s.surname ?? ''}`.trim())
		.filter(Boolean)
		.join(' ');
	const full = [given, surname].filter(Boolean).join(' ').trim();
	return full || (obj.gramps_id ?? obj.handle);
}

/** Formats a person's life dates as "b. 1900 - d. 1980", using whatever is available. */
export function formatLifeDates(obj: GrampsObject): string | undefined {
	const birth = obj.profile?.birth?.date;
	const death = obj.profile?.death?.date;
	if (!birth && !death) return undefined;
	const parts: string[] = [];
	if (birth) parts.push(`b. ${birth}`);
	if (death) parts.push(`d. ${death}`);
	return parts.join(' – ');
}

function asString(v: unknown): string | undefined {
	if (typeof v === 'string') return v;
	if (v && typeof v === 'object' && 'string' in v) {
		return (v as { string?: string }).string;
	}
	if (v && typeof v === 'object' && 'value' in v) {
		return (v as { value?: string }).value;
	}
	return undefined;
}

/** A short, human-readable label for any Gramps object, for lists and cards. */
export function objectDisplayLabel(
	type: GrampsObjectType,
	obj: GrampsObject,
): string {
	const id = obj.gramps_id ?? obj.handle;
	switch (type) {
		case 'Person':
			return `${formatPersonName(obj)} (${id})`;
		case 'Note': {
			const text = obj.text?.string ?? '';
			const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text;
			return preview ? `${preview} (${id})` : `Note (${id})`;
		}
		case 'Event': {
			const t = asString(obj.type) ?? 'Event';
			const d = asString(obj.date);
			return d ? `${t}: ${d} (${id})` : `${t} (${id})`;
		}
		case 'Place': {
			const n = asString(obj.name) ?? asString(obj.title);
			return n ? `${n} (${id})` : `Place (${id})`;
		}
		case 'Source': {
			const title = obj.title;
			return title ? `${title} (${id})` : `Source (${id})`;
		}
		case 'Family':
			return `Family (${id})`;
		case 'Repository':
			return `Repository (${id})`;
		case 'Media':
			return `Media (${id})`;
		case 'Citation':
			return `Citation (${id})`;
		default:
			return `${String(type)} (${id})`;
	}
}
