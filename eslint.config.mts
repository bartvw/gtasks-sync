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

const NODE_GLOBS = [
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
			"obsidianmd/ui/sentence-case": ["error", {
				brands: ["Google", "Google Cloud", "Google Tasks", "Google Tasks Sync", "My Tasks", "OAuth", "Obsidian"],
				acronyms: ["ID", "OS", "URL", "API"],
			}],
		},
	},
	{
		// typescript-eslint plugin is already declared in the recommended config objects above,
		// but flat config requires re-declaring it in each config object that uses its rules.
		plugins: { "@typescript-eslint": tseslint.plugin },
		rules: {
			"@typescript-eslint/no-unused-vars": ["warn", {
				vars: "all",
				args: "none",
				ignoreRestSiblings: true,
				varsIgnorePattern: "^_",
				argsIgnorePattern: "^_",
			}],
		},
	},
	// Test files: disable rules that don't apply in test/mock context
	{
		files: TEST_GLOBS,
		rules: {
			"obsidianmd/ui/sentence-case": "off",
			"obsidianmd/settings-tab/no-manual-html-headings": "off",
			"obsidianmd/no-static-styles-assignment": "off",
			"obsidianmd/no-tfile-tfolder-cast": "off",
			"no-restricted-globals": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
		},
	},
	// Node.js globals for integration tests and vitest config
	{
		files: NODE_GLOBS,
		languageOptions: {
			globals: {
				...globals.node,
			},
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
