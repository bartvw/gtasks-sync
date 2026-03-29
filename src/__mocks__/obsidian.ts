import { vi } from 'vitest';

export const App = vi.fn();
export const Plugin = vi.fn();
export const PluginSettingTab = vi.fn();
export const Notice = vi.fn();
export const TFile = vi.fn();
export const MarkdownView = vi.fn();
export const SecretComponent = vi.fn();
export const Setting = vi.fn();
export const getAllTags = vi.fn(() => [] as string[]);
export const requestUrl = vi.fn();

function makeContentEl(): Record<string, unknown> {
	const el: Record<string, unknown> = {
		empty: vi.fn(),
		setText: vi.fn(),
		addEventListener: vi.fn(),
		addClass: vi.fn(),
		style: {},
	};
	el.createEl = vi.fn(() => el);
	return el;
}

export class Modal {
	app: unknown;
	contentEl: ReturnType<typeof makeContentEl>;
	constructor(app: unknown) {
		this.app = app;
		this.contentEl = makeContentEl();
	}
	open() { this.onOpen(); }
	close() { this.onClose(); }
	onOpen() {}
	onClose() {}
}
