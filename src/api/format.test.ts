import { describe, expect, it } from 'vitest';
import {
	formatLifeDates,
	formatPersonName,
	objectDisplayLabel,
	searchHitObjectType,
} from './format';
import { GrampsObject, SearchHit } from './types';

const person = (fields: Partial<GrampsObject>): GrampsObject =>
	({ handle: 'h1', gramps_id: 'I0044', ...fields });

describe('searchHitObjectType', () => {
	it('maps lowercase API types to Gramps types', () => {
		const hit = (object_type: string) => ({ object_type }) as SearchHit;
		expect(searchHitObjectType(hit('person'))).toBe('Person');
		expect(searchHitObjectType(hit('note'))).toBe('Note');
		expect(searchHitObjectType(hit('tag'))).toBeNull();
	});
});

describe('formatPersonName', () => {
	it('joins given name and surnames with prefixes', () => {
		const p = person({
			primary_name: {
				first_name: 'Johann',
				surname_list: [{ prefix: 'von', surname: 'Straub' }],
			},
		});
		expect(formatPersonName(p)).toBe('Johann von Straub');
	});

	it('falls back to the Gramps ID without a name', () => {
		expect(formatPersonName(person({}))).toBe('I0044');
	});
});

describe('formatLifeDates', () => {
	it('formats available dates', () => {
		const p = person({
			profile: { birth: { date: '1850' }, death: { date: '1912' } },
		});
		expect(formatLifeDates(p)).toBe('b. 1850 – d. 1912');
	});

	it('returns undefined without dates', () => {
		expect(formatLifeDates(person({}))).toBeUndefined();
	});
});

describe('objectDisplayLabel', () => {
	it('includes the Gramps ID', () => {
		expect(objectDisplayLabel('Family', person({ gramps_id: 'F0001' }))).toBe(
			'Family (F0001)',
		);
	});

	it('truncates long note previews', () => {
		const note = person({ gramps_id: 'N0001', text: { string: 'x'.repeat(100) } });
		expect(objectDisplayLabel('Note', note)).toBe(`${'x'.repeat(60)}… (N0001)`);
	});
});
