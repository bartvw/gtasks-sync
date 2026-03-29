export interface PluginSettings {
	clientId: string;
	defaultListName: string;
	conflictResolution: 'google-wins' | 'local-wins';
	changeLog: {
		enabled: boolean;
		path: string;
	};
	importFromGoogle: {
		enabled: boolean;
		folder: string;
		defaultStatus: string;
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
