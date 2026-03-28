export interface PluginSettings {
	clientId: string;
	defaultListName: string;
	changeLog: {
		enabled: boolean;
		path: string;
	};
}

export interface GoogleTask {
	id?: string;
	title: string;
	notes?: string;
	due?: string;
	status: 'needsAction' | 'completed';
}

export interface TokenData {
	accessToken: string;
	refreshToken: string;
	expiresAt: number; // Unix timestamp in milliseconds
}

export interface SyncResult {
	success: boolean;
	message: string;
}
