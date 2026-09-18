import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { TokenStore } from './auth';
import {
	GrampsObject,
	GrampsObjectType,
	Metadata,
	SearchHit,
	TokenPair,
	TreeDetails,
	UserDetails,
	toApiPath,
} from './types';

export type GrampsApiErrorKind =
	| 'not-configured'
	| 'offline'
	| 'auth'
	| 'forbidden'
	| 'not-found'
	| 'server'
	| 'other';

export class GrampsApiError extends Error {
	kind: GrampsApiErrorKind;
	status?: number;

	constructor(message: string, kind: GrampsApiErrorKind, status?: number) {
		super(message);
		this.kind = kind;
		this.status = status;
	}
}

export interface GrampsClientOptions {
	serverUrl: string;
	locale?: string;
}

interface RequestOptions {
	method?: string;
	query?: Record<string, string | number | boolean | undefined>;
	body?: unknown;
	/** Skip the Authorization header (used for the login request itself). */
	unauthenticated?: boolean;
}

function buildQuery(query?: RequestOptions['query']): string {
	if (!query) return '';
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === '') continue;
		params.set(key, String(value));
	}
	const s = params.toString();
	return s ? `?${s}` : '';
}

/**
 * Thin, typed wrapper around the Gramps Web API, built entirely on
 * Obsidian's `requestUrl` (mobile-compatible, no CORS issues). Handles JWT
 * login, automatic access-token refresh, and maps HTTP failures to
 * `GrampsApiError`s with a `kind` that callers can use to show a clear
 * notice.
 */
export class GrampsClient {
	private baseUrl: string;

	constructor(
		private tokens: TokenStore,
		private options: GrampsClientOptions,
		private userAgent: string,
	) {
		this.baseUrl = GrampsClient.normalizeUrl(options.serverUrl);
	}

	private static normalizeUrl(url: string): string {
		return url.trim().replace(/\/+$/, '');
	}

	updateOptions(options: GrampsClientOptions): void {
		this.options = options;
		this.baseUrl = GrampsClient.normalizeUrl(options.serverUrl);
	}

	isConfigured(): boolean {
		return this.baseUrl.length > 0;
	}

	/** POST /api/token/ - obtains and stores an initial access/refresh token pair. */
	async login(username: string, password: string): Promise<void> {
		const res = await this.rawRequest('/api/token/', {
			method: 'POST',
			body: { username, password },
			unauthenticated: true,
		});
		const data = res.json as TokenPair;
		this.tokens.setTokens(data.access_token, data.refresh_token);
	}

	signOut(): void {
		this.tokens.clear();
	}

	isSignedIn(): boolean {
		return this.tokens.hasRefreshToken();
	}

	// The server rate-limits token refresh to 1/second, so concurrent
	// requests with an expired token must share a single refresh
	private pendingRefresh?: Promise<boolean>;

	private refreshAccessToken(): Promise<boolean> {
		if (!this.pendingRefresh) {
			this.pendingRefresh = (async () => {
				if (!this.tokens.getRefreshToken()) return false;
				try {
					await this.doRefresh();
					return true;
				} catch {
					return false;
				}
			})().finally(() => {
				this.pendingRefresh = undefined;
			});
		}
		return this.pendingRefresh;
	}

	/** Low-level request: no auth handling, throws GrampsApiError('offline') on network failure. */
	private async rawRequest(
		path: string,
		opts: RequestOptions,
		bearerToken?: string,
	): Promise<RequestUrlResponse> {
		if (!this.isConfigured()) {
			throw new GrampsApiError(
				'Gramps Web is not configured. Set the server URL in settings.',
				'not-configured',
			);
		}
		const params: RequestUrlParam = {
			url: `${this.baseUrl}${path}${buildQuery(opts.query)}`,
			method: opts.method ?? 'GET',
			throw: false,
			headers: {
				'User-Agent': this.userAgent,
				...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
				...(opts.body !== undefined
					? { 'Content-Type': 'application/json' }
					: {}),
			},
			...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
		};
		let res: RequestUrlResponse;
		try {
			res = await requestUrl(params);
		} catch {
			throw new GrampsApiError(
				'Could not reach the Gramps Web server. Check the server URL and your network connection.',
				'offline',
			);
		}
		if (res.status >= 200 && res.status < 300) return res;
		throw this.errorFromResponse(res);
	}

	private errorFromResponse(res: RequestUrlResponse): GrampsApiError {
		let message: string | undefined;
		try {
			message = (res.json as { message?: string })?.message;
		} catch {
			// non-JSON body; ignore
		}
		if (res.status === 401) {
			return new GrampsApiError(
				message ?? 'Not signed in to Gramps Web. Sign in from settings.',
				'auth',
				res.status,
			);
		}
		if (res.status === 403) {
			return new GrampsApiError(
				message ??
					"You don't have permission to do this on the Gramps Web server.",
				'forbidden',
				res.status,
			);
		}
		if (res.status === 404) {
			return new GrampsApiError(
				message ?? 'Object not found on the Gramps Web server.',
				'not-found',
				res.status,
			);
		}
		if (res.status >= 500) {
			return new GrampsApiError(
				message ?? 'The Gramps Web server reported an error.',
				'server',
				res.status,
			);
		}
		return new GrampsApiError(
			message ?? `Gramps Web request failed (HTTP ${res.status}).`,
			'other',
			res.status,
		);
	}

	/** Authenticated request; refreshes the access token once on 401 and retries. */
	private async request(
		path: string,
		opts: RequestOptions = {},
	): Promise<RequestUrlResponse> {
		if (opts.unauthenticated) {
			return this.rawRequest(path, opts);
		}
		let accessToken = this.tokens.getAccessToken();
		if (!accessToken) {
			if (!this.tokens.hasRefreshToken()) {
				throw new GrampsApiError(
					'Not signed in to Gramps Web. Sign in from settings.',
					'auth',
				);
			}
			const refreshed = await this.refreshAccessToken();
			if (!refreshed) {
				throw new GrampsApiError(
					'Your Gramps Web session expired. Sign in again from settings.',
					'auth',
				);
			}
			accessToken = this.tokens.getAccessToken();
		}
		try {
			return await this.rawRequest(path, opts, accessToken ?? undefined);
		} catch (e) {
			if (e instanceof GrampsApiError && e.kind === 'auth') {
				// another request may have refreshed the token in the meantime
				const refreshed =
					this.tokens.getAccessToken() !== accessToken ||
					(await this.refreshAccessToken());
				if (refreshed) {
					const retryToken = this.tokens.getAccessToken();
					return this.rawRequest(path, opts, retryToken ?? undefined);
				}
				throw new GrampsApiError(
					'Your Gramps Web session expired. Sign in again from settings.',
					'auth',
				);
			}
			throw e;
		}
	}

	/** POST /api/token/refresh/ - uses the refresh token as the bearer token. */
	private async doRefresh(): Promise<void> {
		const refreshToken = this.tokens.getRefreshToken();
		if (!refreshToken) throw new Error('No refresh token');
		const res = await this.rawRequest(
			'/api/token/refresh/',
			{ method: 'POST', unauthenticated: true },
			refreshToken,
		);
		const data = res.json as { access_token: string };
		this.tokens.setAccessToken(data.access_token);
	}

	async getMetadata(): Promise<Metadata> {
		const res = await this.request('/api/metadata/');
		return res.json as Metadata;
	}

	async getCurrentUser(): Promise<UserDetails> {
		const res = await this.request('/api/users/-/');
		return res.json as UserDetails;
	}

	async getTrees(): Promise<TreeDetails[]> {
		const res = await this.request('/api/trees/');
		return res.json as TreeDetails[];
	}

	async search(
		query: string,
		opts: { page?: number; pagesize?: number; types?: string[] } = {},
	): Promise<SearchHit[]> {
		const res = await this.request('/api/search/', {
			query: {
				query,
				page: opts.page ?? 1,
				pagesize: opts.pagesize ?? 20,
				type: opts.types?.join(','),
				profile: 'self',
				locale: this.options.locale,
			},
		});
		return res.json as SearchHit[];
	}

	/** Makes links in note HTML point to the Gramps Web frontend, like Gramps Web itself does. */
	private formatOptions(formats: string[] | undefined): string | undefined {
		if (!formats?.includes('html')) return undefined;
		return JSON.stringify({ link_format: `${this.baseUrl}/{obj_class}/{gramps_id}` });
	}

	async getObjectByHandle(
		type: GrampsObjectType,
		handle: string,
		opts: { profile?: string[]; formats?: string[] } = {},
	): Promise<GrampsObject> {
		const res = await this.request(`/api/${toApiPath(type)}/${handle}`, {
			query: {
				profile: opts.profile?.join(','),
				formats: opts.formats?.join(','),
				format_options: this.formatOptions(opts.formats),
				locale: this.options.locale,
			},
		});
		return res.json as GrampsObject;
	}

	async getObjectByGrampsId(
		type: GrampsObjectType,
		grampsId: string,
		opts: { profile?: string[]; formats?: string[] } = {},
	): Promise<GrampsObject> {
		const res = await this.request(`/api/${toApiPath(type)}/`, {
			query: {
				gramps_id: grampsId,
				profile: opts.profile?.join(','),
				formats: opts.formats?.join(','),
				format_options: this.formatOptions(opts.formats),
				locale: this.options.locale,
			},
		});
		const data = res.json as GrampsObject | GrampsObject[];
		const obj = Array.isArray(data) ? data[0] : data;
		if (!obj) {
			throw new GrampsApiError(
				`No ${type} found with Gramps ID ${grampsId}.`,
				'not-found',
			);
		}
		return obj;
	}

	/** Fetches a media thumbnail and returns it as a data: URI, or null if unavailable. */
	async getThumbnailDataUri(
		mediaHandle: string,
		size = 100,
	): Promise<string | null> {
		try {
			const res = await this.request(
				`/api/media/${mediaHandle}/thumbnail/${size}`,
			);
			const contentType = res.headers['content-type'] ?? 'image/jpeg';
			const bytes = new Uint8Array(res.arrayBuffer);
			let binary = '';
			for (let i = 0; i < bytes.length; i++) {
				binary += String.fromCharCode(bytes[i]!);
			}
			const base64 = btoa(binary);
			return `data:${contentType};base64,${base64}`;
		} catch {
			return null;
		}
	}
}
