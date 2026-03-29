import { describe, it, expect, vi } from 'vitest';
import { ChangeLogger, ChangeEntry } from './change-logger';
import { App } from 'obsidian';

vi.mock('obsidian');

function makeApp(existingContent?: string): { app: App; writeMock: ReturnType<typeof vi.fn> } {
	const writeMock = vi.fn(async () => {});
	const readMock = existingContent !== undefined
		? vi.fn(async () => existingContent)
		: vi.fn(async () => { throw new Error('ENOENT'); });

	const app = {
		vault: {
			adapter: {
				read: readMock,
				write: writeMock,
			},
		},
	} as unknown as App;

	return { app, writeMock };
}

const baseEntry = (overrides: Partial<ChangeEntry> = {}): ChangeEntry => ({
	timestamp: '2024-03-15T14:32:01.000Z',
	direction: 'to-google',
	operation: 'created',
	noteWikilink: 'Buy milk',
	listName: 'My Tasks',
	...overrides,
});

describe('ChangeLogger', () => {
	describe('5.1 Markdown output format', () => {
		it('formats a create entry correctly', async () => {
			const logger = new ChangeLogger();
			const { app, writeMock } = makeApp();

			logger.record(baseEntry());
			await logger.flush(app, 'gtasks-sync-log.md');

			const written = writeMock.mock.calls[0][1] as string;
			expect(written).toMatch(/### \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
			expect(written).toContain('✅ Created in Google Tasks');
			expect(written).toContain('[[Buy milk]]');
			expect(written).toContain('list: My Tasks');
		});

		it('formats a to-google update entry with field changes', async () => {
			const logger = new ChangeLogger();
			const { app, writeMock } = makeApp();

			logger.record(baseEntry({
				operation: 'updated',
				direction: 'to-google',
				noteWikilink: 'Doctor appointment',
				listName: 'Work',
				fieldChanges: [
					{ field: 'title', oldValue: '"Doctor"', newValue: '"Doctor appointment"' },
					{ field: 'due', oldValue: '—', newValue: '2024-03-20' },
				],
			}));
			await logger.flush(app, 'gtasks-sync-log.md');

			const written = writeMock.mock.calls[0][1] as string;
			expect(written).toContain('🔄 Updated in Google Tasks');
			expect(written).toContain('[[Doctor appointment]]');
			expect(written).toContain('  - title: "Doctor" → "Doctor appointment"');
			expect(written).toContain('  - due: — → 2024-03-20');
		});

		it('formats a from-google update entry', async () => {
			const logger = new ChangeLogger();
			const { app, writeMock } = makeApp();

			logger.record(baseEntry({
				operation: 'updated',
				direction: 'from-google',
				noteWikilink: 'Weekly review',
				listName: 'My Tasks',
				fieldChanges: [{ field: 'status', oldValue: 'needsAction', newValue: 'completed' }],
			}));
			await logger.flush(app, 'gtasks-sync-log.md');

			const written = writeMock.mock.calls[0][1] as string;
			expect(written).toContain('⬇️ Updated from Google Tasks');
			expect(written).toContain('  - status: needsAction → completed');
		});

		it('formats a delete entry correctly', async () => {
			const logger = new ChangeLogger();
			const { app, writeMock } = makeApp();

			logger.record(baseEntry({ operation: 'deleted', noteWikilink: 'Old task' }));
			await logger.flush(app, 'gtasks-sync-log.md');

			const written = writeMock.mock.calls[0][1] as string;
			expect(written).toContain('🗑️ Deleted from Google Tasks');
			expect(written).toContain('[[Old task]]');
		});

		it('formats notes field change as "notes: changed"', async () => {
			const logger = new ChangeLogger();
			const { app, writeMock } = makeApp();

			logger.record(baseEntry({
				operation: 'updated',
				fieldChanges: [{ field: 'notes', oldValue: '', newValue: '' }],
			}));
			await logger.flush(app, 'gtasks-sync-log.md');

			const written = writeMock.mock.calls[0][1] as string;
			expect(written).toContain('  - notes: changed');
			expect(written).not.toContain('notes:  →');
		});
	});

	describe('5.2 flush skips file write when no entries recorded', () => {
		it('does not call write when no entries', async () => {
			const logger = new ChangeLogger();
			const { app, writeMock } = makeApp();

			await logger.flush(app, 'gtasks-sync-log.md');

			expect(writeMock).not.toHaveBeenCalled();
		});
	});

	describe('5.3 flush appends to existing file content', () => {
		it('prepends existing content before new block', async () => {
			const existing = '### 2024-01-01 10:00:00\n\n- ✅ Created in Google Tasks | [[Old task]] | list: My Tasks\n\n';
			const logger = new ChangeLogger();
			const { app, writeMock } = makeApp(existing);

			logger.record(baseEntry({ noteWikilink: 'New task' }));
			await logger.flush(app, 'gtasks-sync-log.md');

			const written = writeMock.mock.calls[0][1] as string;
			expect(written.startsWith(existing)).toBe(true);
			expect(written).toContain('[[New task]]');
		});
	});

	describe('5.4 update entries omit field-change sub-bullets when no fields differ', () => {
		it('does not write sub-bullets when fieldChanges is empty', async () => {
			const logger = new ChangeLogger();
			const { app, writeMock } = makeApp();

			logger.record(baseEntry({
				operation: 'updated',
				fieldChanges: [],
			}));
			await logger.flush(app, 'gtasks-sync-log.md');

			const written = writeMock.mock.calls[0][1] as string;
			// No indented sub-bullets
			expect(written).not.toContain('  - ');
		});

		it('does not write sub-bullets when fieldChanges is absent', async () => {
			const logger = new ChangeLogger();
			const { app, writeMock } = makeApp();

			logger.record(baseEntry({ operation: 'updated' }));
			await logger.flush(app, 'gtasks-sync-log.md');

			const written = writeMock.mock.calls[0][1] as string;
			expect(written).not.toContain('  - ');
		});
	});
});
