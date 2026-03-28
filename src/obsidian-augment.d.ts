/**
 * Type augmentations for Obsidian APIs introduced in v1.11.4
 * that are not yet in the bundled obsidian.d.ts.
 */
import 'obsidian';

declare module 'obsidian' {
	interface SecretStorage {
		/** Returns the stored value, or null if not set. */
		getSecret(key: string): Promise<string | null> | null;
		setSecret(key: string, value: string): Promise<void>;
		deleteSecret(key: string): Promise<void>;
	}

	interface App {
		secretStorage: SecretStorage;
	}
}
