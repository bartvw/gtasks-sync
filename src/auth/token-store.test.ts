import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveTokens, loadTokens, clearTokens } from './token-store';
import { TokenData } from '../types';
import { App } from 'obsidian';

vi.mock('obsidian');

function makeApp(store: Record<string, string> = {}): App {
	const storage: Record<string, string> = { ...store };
	return {
		secretStorage: {
			getSecret: vi.fn(async (key: string) => storage[key] ?? ''),
			setSecret: vi.fn(async (key: string, value: string) => { storage[key] = value; }),
			deleteSecret: vi.fn(async (key: string) => { delete storage[key]; }),
		},
	} as unknown as App;
}

const sampleTokens: TokenData = {
	accessToken: 'access-abc',
	refreshToken: 'refresh-xyz',
	expiresAt: 9999999999000,
};

describe('token-store', () => {
	it('saves and loads tokens', async () => {
		const app = makeApp();
		await saveTokens(app, sampleTokens);
		const loaded = await loadTokens(app);
		expect(loaded).toEqual(sampleTokens);
	});

	it('returns null when no tokens are stored', async () => {
		const app = makeApp();
		const loaded = await loadTokens(app);
		expect(loaded).toBeNull();
	});

	it('returns null when stored value is corrupt JSON', async () => {
		const app = makeApp({ 'gtasks-tokens': 'not-json' });
		const loaded = await loadTokens(app);
		expect(loaded).toBeNull();
	});

	it('clears tokens', async () => {
		const app = makeApp();
		await saveTokens(app, sampleTokens);
		await clearTokens(app);
		const loaded = await loadTokens(app);
		expect(loaded).toBeNull();
	});
});
