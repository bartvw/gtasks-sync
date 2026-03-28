import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAuthUrl, exchangeCodeForTokens, refreshAccessToken } from './oauth';

const CLIENT_ID = 'test-client-id';
const CLIENT_SECRET = 'test-client-secret';
const REDIRECT_URI = 'http://127.0.0.1:12345';

describe('buildAuthUrl', () => {
	it('includes clientId, redirectUri, and tasks scope', () => {
		const url = buildAuthUrl(CLIENT_ID, REDIRECT_URI);
		expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
		expect(url).toContain(`client_id=${encodeURIComponent(CLIENT_ID)}`);
		expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/tasks'));
		expect(url).toContain(encodeURIComponent(REDIRECT_URI));
		expect(url).toContain('access_type=offline');
	});
});

describe('exchangeCodeForTokens', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	it('returns TokenData on success', async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				access_token: 'access-123',
				refresh_token: 'refresh-456',
				expires_in: 3600,
			}),
		} as Response);

		const before = Date.now();
		const tokens = await exchangeCodeForTokens('code', CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
		const after = Date.now();

		expect(tokens.accessToken).toBe('access-123');
		expect(tokens.refreshToken).toBe('refresh-456');
		expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
		expect(tokens.expiresAt).toBeLessThanOrEqual(after + 3600 * 1000);
	});

	it('throws when API returns error', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 400,
			text: async () => '{"error":"invalid_grant"}',
		} as Response);

		await expect(
			exchangeCodeForTokens('bad-code', CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
		).rejects.toThrow('Token exchange failed');
	});

	it('throws when no refresh_token in response', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				access_token: 'access-123',
				expires_in: 3600,
				// no refresh_token
			}),
		} as Response);

		await expect(
			exchangeCodeForTokens('code', CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
		).rejects.toThrow('No refresh token');
	});
});

describe('refreshAccessToken', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	it('returns new TokenData preserving refreshToken', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				access_token: 'new-access',
				expires_in: 3600,
			}),
		} as Response);

		const tokens = await refreshAccessToken('refresh-abc', CLIENT_ID, CLIENT_SECRET);
		expect(tokens.accessToken).toBe('new-access');
		expect(tokens.refreshToken).toBe('refresh-abc');
	});

	it('throws when refresh fails', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: async () => '{"error":"invalid_grant"}',
		} as Response);

		await expect(
			refreshAccessToken('bad-refresh', CLIENT_ID, CLIENT_SECRET)
		).rejects.toThrow('Token refresh failed');
	});
});
