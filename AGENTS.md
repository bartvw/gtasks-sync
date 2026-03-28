# AGENTS.md — gtasks-sync

## Project overview

Obsidian plugin that synchronises task notes (notes with task-related frontmatter) to Google Tasks.

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## Development methodology

### Spec-driven development (OpenSpec)

- Every feature begins with a spec file in `specs/` before any implementation.
- Specs are written in OpenSpec format and describe behaviour, inputs, outputs, and edge cases.
- Implementation must not deviate from the spec without updating the spec first.
- Specs are the source of truth; code serves the spec.

### Testing requirements

- **Unit tests** are required for all pure functions, utilities, and business logic.
- **Integration tests** are required for anything touching the Obsidian API, Google Tasks API, or the file system, where feasible.
- Tests live alongside source files: `src/foo.test.ts` next to `src/foo.ts`.
- Aim for full branch coverage on core sync logic.
- No feature is considered complete without passing tests.
- Use mocks/stubs for external APIs in unit tests; use real implementations in integration tests.

## Environment & tooling

- Node.js: v24.
- **Package manager: npm** (`package.json` defines npm scripts and dependencies).
- **Bundler: esbuild** (`esbuild.config.mjs` and build scripts depend on it).
- Types: `obsidian` type definitions.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Build requirements

- Output: `main.js` (CommonJS, ES2018 target).
- Mark `obsidian`, `electron`, and all CodeMirror packages as **external** in the esbuild config.

## Linting

- To use eslint install it from terminal: `npm install -g eslint`
- To analyze this project: `eslint main.ts` or `eslint ./src/`

## File & folder conventions

- **Organize code into multiple files**: split functionality across separate modules rather than putting everything in `main.ts`.
- Source lives in `src/`. Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands).
- **Example file structure**:
  ```
  src/
    main.ts           # Plugin entry point, lifecycle management
    settings.ts       # Settings interface and defaults
    commands/         # Command implementations
      command1.ts
      command2.ts
    ui/              # UI components, modals, views
      modal.ts
      view.ts
    utils/           # Utility functions, helpers
      helpers.ts
      constants.ts
    types.ts         # TypeScript interfaces and types
  ```
- **Do not commit build artifacts**: never commit `node_modules/`, `main.js`, or other generated files.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Release artifacts must end up at the top level of the plugin folder in the vault (`main.js`, `manifest.json`, `styles.css`).

## Manifest rules (`manifest.json`)

Required fields:

```json
{
  "id": "",            // Unique; must NOT contain "obsidian"
  "name": "",          // Display name shown to users
  "author": "",        // Developer name
  "version": "",       // Semantic version x.y.z — must match GitHub release tag exactly
  "minAppVersion": "", // Minimum Obsidian version supported
  "description": "",   // Long description of plugin functionality
  "isDesktopOnly": false
}
```

- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Optional: `authorUrl`, `fundingUrl` (string or map).

## Testing (manual install)

Copy `main.js`, `manifest.json`, `styles.css` (if any) to:

```
<Vault>/.obsidian/plugins/<plugin-id>/
```

Reload Obsidian and enable the plugin in **Settings → Community plugins**.

**Never develop or test in your primary notes vault.** Use a dedicated development vault. Use symlinks or the Hot-Reload plugin to speed up the feedback loop. The Hot-Reload plugin triggers on change when the plugin directory contains a `.git` subdirectory or a `.hotreload` file.

## Commands & settings

- Add user-facing commands via `this.addCommand(...)`.
- Use stable command IDs; avoid renaming once released.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.

## Versioning & releases

- Follow semantic versioning (`x.y.z`). The git release tag must exactly match the version in `manifest.json` (no `v` prefix).
- Bump `version` in `manifest.json` and update `versions.json` to map plugin version → minimum app version.
- Every GitHub release must include `manifest.json`, `main.js`, and `styles.css` (if applicable) as binary attachments.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. Non-negotiable rules:

- **Do not** use `innerHTML` or `outerHTML`; use the Obsidian DOM helpers or `createEl`.
- **Do not** use regex lookbehind patterns.
- **Do not** obfuscate code.
- **Do not** include client-side telemetry without clear, prominent disclosure. Server-side telemetry requires a privacy policy link.
- **Do not** access files outside the user's vault without a clear explanation shown to the user.
- Default to local/offline operation. Only make network requests when essential to the feature.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Google Tasks OAuth credentials must never be committed; use a `.env` file excluded by `.gitignore`.
- Avoid deceptive patterns, ads, or spammy notifications.

## Accessibility

- All interactive elements must be keyboard accessible.
- Icon-only buttons must have ARIA labels.
- Focus indicators must be clearly visible.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.
- Avoid blocking the main thread; always use async/await.
- Always register listeners and intervals via `registerEvent` / `registerInterval` so they are automatically cleaned up.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: focus only on plugin lifecycle (`onload`, `onunload`, `addCommand` calls). Delegate all feature logic to separate modules.
- **Split large files**: if any file exceeds ~200–300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.
- All sync operations must be idempotent and conflict-safe (defined in specs per operation).

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behaviour unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Agent do/don't

**Do**
- Start every feature with a spec in `specs/` before writing any implementation code.
- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.
- Write tests alongside new code (`src/foo.test.ts` next to `src/foo.ts`).

**Don't**
- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.
- Implement anything that deviates from the spec without updating the spec first.
- Commit OAuth credentials or secrets.

## Common tasks

### Organize code across multiple files

**main.ts** (minimal, lifecycle only):
```ts
import { Plugin } from "obsidian";
import { MySettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";

export default class MyPlugin extends Plugin {
  settings: MySettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    registerCommands(this);
  }
}
```

**settings.ts**:
```ts
export interface MySettings {
  enabled: boolean;
  apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
  enabled: true,
  apiKey: "",
};
```

**commands/index.ts**:
```ts
import { Plugin } from "obsidian";
import { doSomething } from "./my-command";

export function registerCommands(plugin: Plugin) {
  plugin.addCommand({
    id: "do-something",
    name: "Do something",
    callback: () => doSomething(plugin),
  });
}
```

### Add a command

```ts
this.addCommand({
  id: "your-command-id",
  name: "Do the thing",
  callback: () => this.doTheThing(),
});
```

### Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(this.app.workspace.on("file-open", f => { /* ... */ }));
this.registerDomEvent(window, "resize", () => { /* ... */ });
this.registerInterval(window.setInterval(() => { /* ... */ }, 1000));
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`.
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
