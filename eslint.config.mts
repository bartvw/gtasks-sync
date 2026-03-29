import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

const TEST_GLOBS = [
	"src/*/*.test.ts",
	"src/__mocks__/*.ts",
	"src/integration/*.ts",
	"vitest.config.ts",
];

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				project: ['./tsconfig.json', './tsconfig.test.json'],
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	// eslint-plugin-obsidianmd types its configs as optional and without [Symbol.iterator],
	// but the runtime object is a custom iterable. Cast to any[] to spread it correctly.
	...(obsidianmd.configs!.recommended as any[]),
	{
		plugins: { obsidianmd },
		rules: {
			"obsidianmd/ui/sentence-case": ["error", { brands: ["Google Tasks"] }],
		},
	},
	{
		files: TEST_GLOBS,
		rules: {
			"obsidianmd/ui/sentence-case": "off",
			"obsidianmd/settings-tab/no-manual-html-headings": "off",
			"obsidianmd/no-static-styles-assignment": "off",
			"no-restricted-globals": "off",
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
