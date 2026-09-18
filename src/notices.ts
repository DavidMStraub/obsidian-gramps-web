import { Notice } from 'obsidian';
import { GrampsApiError } from './api/client';

/** Shows a clear, user-facing notice for a Gramps Web API error (or any other error). */
export function notifyApiError(e: unknown, context?: string): void {
	const prefix = context ? `${context}: ` : '';
	if (e instanceof GrampsApiError) {
		new Notice(`${prefix}${e.message}`);
		return;
	}
	new Notice(`${prefix}Unexpected error talking to Gramps Web. See console for details.`);
	console.error(e);
}
