import { safeStorage } from 'electron';
import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { Store } from './store';

interface SecretFile {
  version: number;
  providerKeys: Record<string, string>; // providerId -> encrypted key (base64)
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
          providerKeys: {}
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
      
      return secrets;
    } catch (error) {
      // Return empty secrets if file doesn't exist or is corrupted
      return {
        version: CURRENT_VERSION,
        providerKeys: {}
      };
    }
  }

  private async saveSecrets(secrets: SecretFile): Promise<void> {
    await fs.writeFile(this.secretsPath, JSON.stringify(secrets, null, 2));
  }
}

// Export singleton instance
export const secureStorage = new SecureStorage();
