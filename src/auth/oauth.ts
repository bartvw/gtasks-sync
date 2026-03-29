import * as http from 'http';
import { requestUrl } from 'obsidian';
import { TokenData } from '../types';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

export function buildAuthUrl(clientId: string, redirectUri: string): string {
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: TASKS_SCOPE,
		access_type: 'offline',
		prompt: 'consent',
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface LoopbackServer {
	port: number;
	codePromise: Promise<string>;
}

export function startLoopbackServer(timeoutMs = 5 * 60 * 1000): Promise<LoopbackServer> {
	return new Promise((resolve, reject) => {
		let timer: ReturnType<typeof setTimeout> | null = null;

		const server = http.createServer((req, res) => {
			const url = new URL(req.url ?? '/', `http://127.0.0.1`);
			const code = url.searchParams.get('code');
			const error = url.searchParams.get('error');

			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end('<html><body><p>You can close this tab and return to Obsidian.</p></body></html>');

			server.close();
			if (timer) clearTimeout(timer);

			if (code) {
				resolveCode(code);
			} else {
				rejectCode(new Error(error ?? 'OAuth cancelled'));
			}
		});

		let resolveCode!: (code: string) => void;
		let rejectCode!: (err: Error) => void;
		const codePromise = new Promise<string>((res, rej) => {
			resolveCode = res;
			rejectCode = rej;
		});

		server.listen(0, '127.0.0.1', () => {
			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				reject(new Error('Failed to get server address'));
				return;
			}
			timer = setTimeout(() => {
				server.close();
				rejectCode(new Error('OAuth timeout: no response received within 5 minutes'));
			}, timeoutMs);

			resolve({ port: addr.port, codePromise });
		});

		server.on('error', (err) => {
			reject(err);
		});
	});
}

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
}

export async function exchangeCodeForTokens(
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string
): Promise<TokenData> {
	const body = new URLSearchParams({
		code,
		client_id: clientId,
		client_secret: clientSecret,
		redirect_uri: redirectUri,
		grant_type: 'authorization_code',
	});

	const response = await requestUrl({
		url: GOOGLE_TOKEN_ENDPOINT,
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
		throw: false,
	});

	if (response.status >= 400) {
		throw new Error(`Token exchange failed: ${response.status} ${response.text}`);
	}

	const data = response.json as TokenResponse;
	if (!data.refresh_token) {
		throw new Error('No refresh token returned. Ensure you requested offline access.');
	}

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: Date.now() + data.expires_in * 1000,
	};
}

export async function refreshAccessToken(
	refreshToken: string,
	clientId: string,
	clientSecret: string
): Promise<TokenData> {
	const body = new URLSearchParams({
		refresh_token: refreshToken,
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'refresh_token',
	});

	const response = await requestUrl({
		url: GOOGLE_TOKEN_ENDPOINT,
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
		throw: false,
	});

	if (response.status >= 400) {
		throw new Error(`Token refresh failed: ${response.status} ${response.text}`);
	}

	const data = response.json as TokenResponse;
	return {
		accessToken: data.access_token,
		refreshToken,
		expiresAt: Date.now() + data.expires_in * 1000,
	};
}
