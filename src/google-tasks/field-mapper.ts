import { TFile } from 'obsidian';
import { GoogleTask } from '../types';

export function extractBodyFromGoogleNotes(notes: string): string {
	if (!notes) return '';
	const sepIdx = notes.indexOf('\n\nobsidian://');
	if (sepIdx !== -1) {
		return notes.slice(0, sepIdx).trim();
	}
	if (notes.startsWith('obsidian://')) {
		return '';
	}
	return notes.trim();
}

export function taskMatchesPayload(task: GoogleTask, payload: Omit<GoogleTask, 'id'>): boolean {
	if (task.title !== payload.title) return false;
	if (task.status !== payload.status) return false;
	if (task.notes !== payload.notes) return false;
	const taskDue = task.due ? task.due.slice(0, 10) : undefined;
	const payloadDue = payload.due ? payload.due.slice(0, 10) : undefined;
	return taskDue === payloadDue;
}

export function buildObsidianUri(vaultName: string, filePath: string): string {
	return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
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
	file: TFile,
	vaultName: string,
	noteBody?: string
): Omit<GoogleTask, 'id'> {
	const title = typeof frontmatter['title'] === 'string'
		? frontmatter['title']
		: file.basename;

	const status = mapStatusToGoogle(
		typeof frontmatter['status'] === 'string' ? frontmatter['status'] : ''
	);

	const due = mapDueToGoogle(
		typeof frontmatter['due'] === 'string' ? frontmatter['due'] : undefined
	);

	const uri = buildObsidianUri(vaultName, file.path);
	const notes = noteBody ? `${noteBody}\n\n${uri}` : uri;

	const payload: Omit<GoogleTask, 'id'> = { title, status, notes };
	if (due) payload.due = due;

	return payload;
}
