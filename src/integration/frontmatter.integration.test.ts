/**
 * Integration tests for frontmatter read/write using a real file on disk.
 *
 * These tests use the real file system and a minimal App stub.
 * They are excluded from the default test run (vitest excludes *.integration.test.ts).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Minimal stub for the Obsidian App that reads/writes real files.
// We implement processFrontMatter by manually parsing/writing YAML frontmatter.
import { parse, stringify } from 'yaml';

async function readFrontMatter(filePath: string): Promise<Record<string, unknown>> {
	const content = await fs.readFile(filePath, 'utf-8');
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};
	return (parse(match[1] ?? '') as Record<string, unknown>) ?? {};
}

async function writeFrontMatter(filePath: string, updates: Record<string, unknown>): Promise<void> {
	const content = await fs.readFile(filePath, 'utf-8');
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	const existing = match ? ((parse(match[1] ?? '') as Record<string, unknown>) ?? {}) : {};
	const merged = { ...existing, ...updates };
	const body = match ? content.slice(match[0].length) : `\n\n${content}`;
	const newContent = `---\n${stringify(merged).trimEnd()}\n---${body}`;
	await fs.writeFile(filePath, newContent, 'utf-8');
}

let tmpDir: string;

beforeEach(async () => {
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gtasks-integration-'));
});

afterEach(async () => {
	await fs.rm(tmpDir, { recursive: true });
});

describe('Frontmatter read/write integration', () => {
	it('writes gtask-id and gtask-list and reads them back', async () => {
		const filePath = path.join(tmpDir, 'test-task.md');
		await fs.writeFile(filePath, '---\nstatus: todo\ntitle: Test Task\n---\n\nBody text.\n');

		await writeFrontMatter(filePath, { 'gtask-id': 'task-abc', 'gtask-list': 'My Tasks' });
		const fm = await readFrontMatter(filePath);

		expect(fm['gtask-id']).toBe('task-abc');
		expect(fm['gtask-list']).toBe('My Tasks');
		expect(fm['status']).toBe('todo');
		expect(fm['title']).toBe('Test Task');
	});

	it('preserves existing body content after frontmatter write', async () => {
		const filePath = path.join(tmpDir, 'task.md');
		const body = '\n\nThis is the task body.\n';
		await fs.writeFile(filePath, `---\nstatus: todo\n---${body}`);

		await writeFrontMatter(filePath, { 'gtask-id': 'x', 'gtask-list': 'y' });
		const content = await fs.readFile(filePath, 'utf-8');

		expect(content).toContain('This is the task body.');
	});
});
