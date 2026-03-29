import { describe, it, expect, vi } from 'vitest';
import { sanitizeFilename, findUniqueFilePath, createNoteFromGoogleTask } from './note-importer';
import { App, TFile } from 'obsidian';
import { GoogleTask, PluginSettings } from '../types';

vi.mock('obsidian');

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
	it('returns title unchanged when no invalid chars', () => {
		expect(sanitizeFilename('Buy milk')).toBe('Buy milk');
	});

	it('strips forward slash', () => {
		expect(sanitizeFilename('a/b')).toBe('ab');
	});

	it('strips colon', () => {
		expect(sanitizeFilename('Task: do this')).toBe('Task do this');
	});

	it('strips asterisk', () => {
		expect(sanitizeFilename('a*b')).toBe('ab');
	});

	it('strips question mark', () => {
		expect(sanitizeFilename('what?')).toBe('what');
	});

	it('strips double quote', () => {
		expect(sanitizeFilename('"hello"')).toBe('hello');
	});

	it('strips less-than and greater-than', () => {
		expect(sanitizeFilename('a<b>c')).toBe('abc');
	});

	it('strips pipe', () => {
		expect(sanitizeFilename('a|b')).toBe('ab');
	});

	it('strips backslash', () => {
		expect(sanitizeFilename('a\\b')).toBe('ab');
	});

	it('strips multiple invalid chars', () => {
		expect(sanitizeFilename('Task: "important" / now?')).toBe('Task important  now');
	});

	it('trims leading and trailing whitespace', () => {
		expect(sanitizeFilename('  hello  ')).toBe('hello');
	});

	it('falls back to "untitled" when result is empty', () => {
		expect(sanitizeFilename('///')).toBe('untitled');
	});

	it('falls back to "untitled" for empty string', () => {
		expect(sanitizeFilename('')).toBe('untitled');
	});

	it('falls back to "untitled" when only whitespace remains after stripping', () => {
		expect(sanitizeFilename('  /  ')).toBe('untitled');
	});
});

// ---------------------------------------------------------------------------
// findUniqueFilePath
// ---------------------------------------------------------------------------

function makeApp(existingPaths: string[] = []): App {
	return {
		vault: {
			getAbstractFileByPath: vi.fn((path: string) => {
				return existingPaths.includes(path) ? {} : null;
			}),
		},
	} as unknown as App;
}

describe('findUniqueFilePath', () => {
	it('returns base path when no collision', () => {
		const app = makeApp([]);
		expect(findUniqueFilePath('Tasks', 'Buy milk', app)).toBe('Tasks/Buy milk.md');
	});

	it('appends " 2" on single collision', () => {
		const app = makeApp(['Tasks/Buy milk.md']);
		expect(findUniqueFilePath('Tasks', 'Buy milk', app)).toBe('Tasks/Buy milk 2.md');
	});

	it('appends " 3" on multiple collisions', () => {
		const app = makeApp(['Tasks/Buy milk.md', 'Tasks/Buy milk 2.md']);
		expect(findUniqueFilePath('Tasks', 'Buy milk', app)).toBe('Tasks/Buy milk 3.md');
	});

	it('strips trailing slash from folder', () => {
		const app = makeApp([]);
		expect(findUniqueFilePath('Tasks/', 'My Task', app)).toBe('Tasks/My Task.md');
	});
});

// ---------------------------------------------------------------------------
// createNoteFromGoogleTask
// ---------------------------------------------------------------------------

function makeSettings(overrides: Partial<PluginSettings['importFromGoogle']> = {}): PluginSettings {
	return {
		clientId: '',
		defaultListName: 'My Tasks',
		conflictResolution: 'google-wins',
		changeLog: { enabled: false, path: 'log.md' },
		importFromGoogle: {
			enabled: true,
			folder: 'Imported',
			defaultStatus: 'open',
			...overrides,
		},
	};
}

function makeGoogleTask(overrides: Partial<GoogleTask> = {}): GoogleTask {
	return {
		id: 'task-abc',
		title: 'Buy milk',
		status: 'needsAction',
		...overrides,
	};
}

describe('createNoteFromGoogleTask', () => {
	it('creates a file at the correct path with frontmatter', async () => {
		const createdFile = { basename: 'Buy milk' } as unknown as TFile;
		const mockCreate = vi.fn().mockResolvedValue(createdFile);
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn(() => null),
				createFolder: vi.fn().mockResolvedValue(undefined),
				create: mockCreate,
			},
		} as unknown as App;

		const settings = makeSettings();
		const task = makeGoogleTask();
		const result = await createNoteFromGoogleTask(task, 'My Tasks', settings, app);

		expect(mockCreate).toHaveBeenCalledWith(
			'Imported/Buy milk.md',
			expect.stringContaining('gtask-id: task-abc')
		);
		expect(result).toBe(createdFile);
	});

	it('includes due date in frontmatter when task has due', async () => {
		const mockCreate = vi.fn().mockResolvedValue({ basename: 'Task' } as unknown as TFile);
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn(() => null),
				createFolder: vi.fn().mockResolvedValue(undefined),
				create: mockCreate,
			},
		} as unknown as App;

		const task = makeGoogleTask({ due: '2025-06-15T00:00:00.000Z' });
		await createNoteFromGoogleTask(task, 'My Tasks', makeSettings(), app);

		const content: string = mockCreate.mock.calls[0][1];
		expect(content).toContain('due: 2025-06-15');
		expect(content).toContain('gtask-due: 2025-06-15');
	});

	it('omits due from frontmatter when task has no due', async () => {
		const mockCreate = vi.fn().mockResolvedValue({ basename: 'Task' } as unknown as TFile);
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn(() => null),
				createFolder: vi.fn().mockResolvedValue(undefined),
				create: mockCreate,
			},
		} as unknown as App;

		const task = makeGoogleTask({ due: undefined });
		await createNoteFromGoogleTask(task, 'My Tasks', makeSettings(), app);

		const content: string = mockCreate.mock.calls[0][1];
		expect(content).not.toContain('due:');
		expect(content).not.toContain('gtask-due:');
	});

	it('writes gtask-title sentinel in frontmatter', async () => {
		const mockCreate = vi.fn().mockResolvedValue({ basename: 'Task' } as unknown as TFile);
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn(() => null),
				createFolder: vi.fn().mockResolvedValue(undefined),
				create: mockCreate,
			},
		} as unknown as App;

		const task = makeGoogleTask({ title: 'Buy milk' });
		await createNoteFromGoogleTask(task, 'My Tasks', makeSettings(), app);

		const content: string = mockCreate.mock.calls[0][1];
		expect(content).toContain('gtask-title: "Buy milk"');
	});

	it('does not include note body from Google notes field', async () => {
		const mockCreate = vi.fn().mockResolvedValue({ basename: 'Task' } as unknown as TFile);
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn(() => null),
				createFolder: vi.fn().mockResolvedValue(undefined),
				create: mockCreate,
			},
		} as unknown as App;

		const task = makeGoogleTask({ notes: 'Some notes content\n\nobsidian://...' });
		await createNoteFromGoogleTask(task, 'My Tasks', makeSettings(), app);

		const content: string = mockCreate.mock.calls[0][1];
		expect(content).not.toContain('Some notes content');
	});

	it('creates folder if it does not exist', async () => {
		const mockCreateFolder = vi.fn().mockResolvedValue(undefined);
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn(() => null),
				createFolder: mockCreateFolder,
				create: vi.fn().mockResolvedValue({ basename: 'Task' } as unknown as TFile),
			},
		} as unknown as App;

		await createNoteFromGoogleTask(makeGoogleTask(), 'My Tasks', makeSettings({ folder: 'Imported' }), app);
		expect(mockCreateFolder).toHaveBeenCalledWith('Imported');
	});

	it('does not create folder if it already exists', async () => {
		const mockCreateFolder = vi.fn();
		const app = {
			vault: {
				// First call (for folder check) returns existing, second (for file) returns null
				getAbstractFileByPath: vi.fn()
					.mockReturnValueOnce({}) // folder exists
					.mockReturnValue(null),  // file does not exist
				createFolder: mockCreateFolder,
				create: vi.fn().mockResolvedValue({ basename: 'Task' } as unknown as TFile),
			},
		} as unknown as App;

		await createNoteFromGoogleTask(makeGoogleTask(), 'My Tasks', makeSettings({ folder: 'Imported' }), app);
		expect(mockCreateFolder).not.toHaveBeenCalled();
	});
});
