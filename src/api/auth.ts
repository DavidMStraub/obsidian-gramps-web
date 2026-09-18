import { App } from 'obsidian';

export interface Account {
	serverUrl: string;
	username: string;
}

// FNV-1a, 32 bit; only needs to be stable, not cryptographic
function hash(str: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Stores JWT access/refresh tokens using Obsidian's secret storage
 * (`App.secretStorage`, available since Obsidian 1.11.4, which is why this
 * plugin requires at least that version). Secret storage is local to the
 * device and is not synced by Obsidian Sync or third-party sync plugins, so
 * tokens never end up in `data.json`.
 *
 * Secret IDs include a hash of server URL and username, so vaults connected
 * to different servers or accounts don't overwrite each other's tokens.
 *
 * The user's password itself is never stored: it is only used transiently
 * to obtain the initial token pair.
 */
export class TokenStore {
	constructor(
		private app: App,
		private getAccount: () => Account,
	) {}

	private secretId(kind: 'access' | 'refresh'): string {
		const { serverUrl, username } = this.getAccount();
		const server = serverUrl.trim().toLowerCase().replace(/\/+$/, '');
		return `gramps-web-${hash(`${server}\n${username.trim()}`)}-${kind}`;
	}

	getAccessToken(): string | null {
		return this.app.secretStorage.getSecret(this.secretId('access')) || null;
	}

	getRefreshToken(): string | null {
		return this.app.secretStorage.getSecret(this.secretId('refresh')) || null;
	}

	setAccessToken(token: string): void {
		this.app.secretStorage.setSecret(this.secretId('access'), token);
	}

	setTokens(accessToken: string, refreshToken: string): void {
		this.setAccessToken(accessToken);
		this.app.secretStorage.setSecret(this.secretId('refresh'), refreshToken);
	}

	clear(): void {
		this.app.secretStorage.setSecret(this.secretId('access'), '');
		this.app.secretStorage.setSecret(this.secretId('refresh'), '');
	}

	hasRefreshToken(): boolean {
		return Boolean(this.getRefreshToken());
	}
}
