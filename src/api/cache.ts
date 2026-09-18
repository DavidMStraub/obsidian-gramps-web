import { GrampsObject, GrampsObjectType } from './types';

/**
 * In-memory cache of Gramps objects keyed by handle, plus a handle <->
 * Gramps ID index. Cleared whenever the server/settings change (a new
 * `GrampsCache` is created by the plugin in that case); never persisted.
 */
export class GrampsCache {
	private byHandle = new Map<string, GrampsObject>();
	private handleByGrampsId = new Map<string, string>();

	private key(type: GrampsObjectType, grampsId: string): string {
		return `${type}:${grampsId}`;
	}

	get(handle: string): GrampsObject | undefined {
		return this.byHandle.get(handle);
	}

	set(type: GrampsObjectType, obj: GrampsObject): void {
		this.byHandle.set(obj.handle, obj);
		if (obj.gramps_id) {
			this.handleByGrampsId.set(this.key(type, obj.gramps_id), obj.handle);
		}
	}

	getHandleForGrampsId(
		type: GrampsObjectType,
		grampsId: string,
	): string | undefined {
		return this.handleByGrampsId.get(this.key(type, grampsId));
	}

	clear(): void {
		this.byHandle.clear();
		this.handleByGrampsId.clear();
	}
}
