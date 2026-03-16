import { safeStorage } from 'electron';
import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { Store } from './store';

interface SecretFile {
  version: number;
  providerKeys: Record<string, string>; // providerId -> encrypted key (base64)
  providerKeyPairs: Record<string, Record<string, string>>; // providerId -> {keyName -> encrypted value}
  lastMigration?: number;
}

const SECRETS_FILE = 'secrets.enc';
const CURRENT_VERSION = 1;

export class SecureStorage {
  private secretsPath: string;
  private cache: Map<string, string> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.secretsPath = path.join(app.getPath('userData'), SECRETS_FILE);
  }

  /**
   * Initialize the secure storage and check availability
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if encryption is available
      const isAvailable = safeStorage.isEncryptionAvailable();
      if (!isAvailable) {
        console.error('[SecureStorage] Encryption is not available on this system');
        return false;
      }

      // Ensure secrets file exists
      try {
        await fs.access(this.secretsPath);
      } catch {
        // Create empty secrets file
        await this.saveSecrets({
          version: CURRENT_VERSION,
          providerKeys: {},
          providerKeyPairs: {}
        });
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[SecureStorage] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Check if migration from plaintext is needed
   */
  isMigrationNeeded(store: Store): boolean {
    const providers = store.get('providers');
    return providers.some(p => p.apiKey && p.apiKey.length > 0);
  }

  /**
   * Migrate API keys from plaintext store to secure storage
   */
  async migrateFromPlaintext(store: Store): Promise<{ success: boolean; migrated: number; errors: string[] }> {
    const errors: string[] = [];
    let migrated = 0;

    try {
      const providers = store.get('providers');
      
      for (const provider of providers) {
        if (provider.apiKey && provider.apiKey.length > 0) {
          try {
            await this.setProviderApiKey(provider.id, provider.apiKey);
            
            // Clear from store but keep metadata
            provider.apiKey = undefined;
            (provider as any).hasKeyInKeychain = true;
            
            migrated++;
          } catch (error) {
            errors.push(`Failed to migrate ${provider.id}: ${error}`);
          }
        }
      }

      // Save updated providers (without apiKey)
      store.set('providers', providers);
      
      // Update last migration timestamp
      const secrets = await this.loadSecrets();
      secrets.lastMigration = Date.now();
      await this.saveSecrets(secrets);

      return { success: errors.length === 0, migrated, errors };
    } catch (error) {
      return { 
        success: false, 
        migrated, 
        errors: [...errors, `Migration failed: ${error}`] 
      };
    }
  }

  /**
   * Get API key for a provider
   */
  async getProviderApiKey(providerId: string): Promise<string | null> {
    // Check cache first
    if (this.cache.has(providerId)) {
      return this.cache.get(providerId)!;
    }

    try {
      const secrets = await this.loadSecrets();
      const encryptedKey = secrets.providerKeys[providerId];
      
      if (!encryptedKey) {
        return null;
      }

      // Decrypt
      const encryptedBuffer = Buffer.from(encryptedKey, 'base64');
      const decrypted = safeStorage.decryptString(encryptedBuffer);
      
      // Cache decrypted value
      this.cache.set(providerId, decrypted);
      
      return decrypted;
    } catch (error) {
      console.error(`[SecureStorage] Failed to get key for ${providerId}:`, error);
      return null;
    }
  }

  /**
   * Store API key for a provider
   */
  async setProviderApiKey(providerId: string, apiKey: string): Promise<void> {
    try {
      // Encrypt
      const encrypted = safeStorage.encryptString(apiKey);
      const encryptedBase64 = encrypted.toString('base64');

      // Load and update secrets
      const secrets = await this.loadSecrets();
      secrets.providerKeys[providerId] = encryptedBase64;
      
      await this.saveSecrets(secrets);
      
      // Update cache
      this.cache.set(providerId, apiKey);
    } catch (error) {
      console.error(`[SecureStorage] Failed to set key for ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Delete API key for a provider
   */
  async deleteProviderApiKey(providerId: string): Promise<void> {
    try {
      const secrets = await this.loadSecrets();
      delete secrets.providerKeys[providerId];
      await this.saveSecrets(secrets);
      
      // Remove from cache
      this.cache.delete(providerId);
    } catch (error) {
      console.error(`[SecureStorage] Failed to delete key for ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a provider has a key stored
   */
  async hasProviderApiKey(providerId: string): Promise<boolean> {
    const secrets = await this.loadSecrets();
    return !!secrets.providerKeys[providerId];
  }

  /**
   * Get a specific credential value for a provider (for key-value pairs like AccessKey ID/Secret)
   */
  async getProviderCredential(providerId: string, keyName: string): Promise<string | null> {
    const cacheKey = `${providerId}:${keyName}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const secrets = await this.loadSecrets();
      const providerCredentials = secrets.providerKeyPairs[providerId];

      if (!providerCredentials || !providerCredentials[keyName]) {
        return null;
      }

      // Decrypt
      const encryptedKey = providerCredentials[keyName];
      const encryptedBuffer = Buffer.from(encryptedKey, 'base64');
      const decrypted = safeStorage.decryptString(encryptedBuffer);

      // Cache decrypted value
      this.cache.set(cacheKey, decrypted);

      return decrypted;
    } catch (error) {
      console.error(`[SecureStorage] Failed to get credential ${keyName} for ${providerId}:`, error);
      return null;
    }
  }

  /**
   * Store a specific credential value for a provider (for key-value pairs like AccessKey ID/Secret)
   */
  async setProviderCredential(providerId: string, keyName: string, value: string): Promise<void> {
    try {
      // Encrypt
      const encrypted = safeStorage.encryptString(value);
      const encryptedBase64 = encrypted.toString('base64');

      // Load and update secrets
      const secrets = await this.loadSecrets();
      if (!secrets.providerKeyPairs[providerId]) {
        secrets.providerKeyPairs[providerId] = {};
      }
      secrets.providerKeyPairs[providerId][keyName] = encryptedBase64;

      await this.saveSecrets(secrets);

      // Update cache
      const cacheKey = `${providerId}:${keyName}`;
      this.cache.set(cacheKey, value);
    } catch (error) {
      console.error(`[SecureStorage] Failed to set credential ${keyName} for ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a specific credential for a provider
   */
  async deleteProviderCredential(providerId: string, keyName: string): Promise<void> {
    try {
      const secrets = await this.loadSecrets();
      if (secrets.providerKeyPairs[providerId]) {
        delete secrets.providerKeyPairs[providerId][keyName];
        await this.saveSecrets(secrets);
      }

      // Remove from cache
      const cacheKey = `${providerId}:${keyName}`;
      this.cache.delete(cacheKey);
    } catch (error) {
      console.error(`[SecureStorage] Failed to delete credential ${keyName} for ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a provider has a specific credential stored
   */
  async hasProviderCredential(providerId: string, keyName: string): Promise<boolean> {
    const secrets = await this.loadSecrets();
    return !!(secrets.providerKeyPairs[providerId] && secrets.providerKeyPairs[providerId][keyName]);
  }

  /**
   * Get all credentials for a provider as a key-value object
   */
  async getProviderCredentials(providerId: string, keyNames: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    for (const keyName of keyNames) {
      result[keyName] = await this.getProviderCredential(providerId, keyName);
    }
    return result;
  }

  /**
   * Set multiple credentials for a provider at once
   */
  async setProviderCredentials(providerId: string, credentials: Record<string, string>): Promise<void> {
    for (const [keyName, value] of Object.entries(credentials)) {
      await this.setProviderCredential(providerId, keyName, value);
    }
  }

  /**
   * Clear all cached keys (call on lock/sleep)
   */
  clearCache(): void {
    this.cache.clear();
  }

  private async loadSecrets(): Promise<SecretFile> {
    try {
      const data = await fs.readFile(this.secretsPath, 'utf-8');
      const secrets = JSON.parse(data) as SecretFile;

      // Handle version migration if needed
      if (secrets.version !== CURRENT_VERSION) {
        // Future: handle version migrations
        secrets.version = CURRENT_VERSION;
      }

      // Ensure providerKeyPairs exists (backward compatibility)
      if (!secrets.providerKeyPairs) {
        secrets.providerKeyPairs = {};
      }

      return secrets;
    } catch (error) {
      // Return empty secrets if file doesn't exist or is corrupted
      return {
        version: CURRENT_VERSION,
        providerKeys: {},
        providerKeyPairs: {}
      };
    }
  }

  private async saveSecrets(secrets: SecretFile): Promise<void> {
    await fs.writeFile(this.secretsPath, JSON.stringify(secrets, null, 2));
  }
}

// Export singleton instance
export const secureStorage = new SecureStorage();
