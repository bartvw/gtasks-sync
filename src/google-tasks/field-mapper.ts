import { TFile } from 'obsidian';

export function taskMatchesPayload(task: { title: string; status: string; due?: string }, payload: { title: string; status: string; due?: string }): boolean {
	if (task.title !== payload.title) return false;
	if (task.status !== payload.status) return false;
	const taskDue = task.due ? task.due.slice(0, 10) : undefined;
	const payloadDue = payload.due ? payload.due.slice(0, 10) : undefined;
	return taskDue === payloadDue;
}

export function mapStatusToGoogle(status: string): 'needsAction' | 'completed' {
	return status === 'done' || status === 'cancelled' ? 'completed' : 'needsAction';
}

export function mapDueToGoogle(due: string | undefined): string | undefined {
	if (!due) return undefined;
	// Convert YYYY-MM-DD to RFC 3339 midnight UTC
	return `${due}T00:00:00.000Z`;
}

export function buildTaskPayload(
	frontmatter: Record<string, unknown>,
	file: TFile
): { title: string; status: 'needsAction' | 'completed'; due?: string } {
	const title = typeof frontmatter['title'] === 'string'
		? frontmatter['title']
		: file.basename;

	const status = mapStatusToGoogle(
		typeof frontmatter['status'] === 'string' ? frontmatter['status'] : ''
	);

	const due = mapDueToGoogle(
		typeof frontmatter['due'] === 'string' ? frontmatter['due'] : undefined
	);

	const payload: { title: string; status: 'needsAction' | 'completed'; due?: string } = { title, status };
	if (due) payload.due = due;

	return payload;
}

export function resolveField<T>(
	local: T,
	google: T,
	lastSynced: T | null,
	strategy: 'google-wins' | 'local-wins'
): { action: 'push' | 'pull' | 'skip'; value: T } {
	const sentinel = lastSynced ?? local; // null → treat as equal to local
	const localChanged = local !== sentinel;
	const googleChanged = google !== sentinel;

	if (!localChanged && !googleChanged) {
		return { action: 'skip', value: local };
	}
	if (localChanged && !googleChanged) {
		return { action: 'push', value: local };
	}
	if (!localChanged && googleChanged) {
		return { action: 'pull', value: google };
	}
	// Both changed
	if (local === google) {
		// Both changed to the same value — agree on Google's value
		return { action: 'pull', value: google };
	}
	// Conflict
	if (strategy === 'google-wins') {
		return { action: 'pull', value: google };
	} else {
		return { action: 'push', value: local };
	}
}
