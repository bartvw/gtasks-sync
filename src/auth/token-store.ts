import { App } from 'obsidian';
import { TokenData } from '../types';

const TOKEN_KEY = 'gtasks-tokens';

export async function saveTokens(app: App, tokens: TokenData): Promise<void> {
	await app.secretStorage.setSecret(TOKEN_KEY, JSON.stringify(tokens));
}

export async function loadTokens(app: App): Promise<TokenData | null> {
	const raw = await Promise.resolve(app.secretStorage.getSecret(TOKEN_KEY));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as TokenData;
	} catch {
		return null;
	}
}

export async function clearTokens(app: App): Promise<void> {
	await app.secretStorage.deleteSecret(TOKEN_KEY);
}
