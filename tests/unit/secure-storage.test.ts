import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecureStorage } from '../../src/main/secure-storage';

// Mock keytar
const mockSetPassword = vi.fn();
const mockGetPassword = vi.fn();
const mockDeletePassword = vi.fn();

vi.mock('keytar', () => ({
  setPassword: (...args: any[]) => mockSetPassword(...args),
  getPassword: (...args: any[]) => mockGetPassword(...args),
  deletePassword: (...args: any[]) => mockDeletePassword(...args),
}));

describe('SecureStorage', () => {
  let secureStorage: SecureStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    // Import fresh instance after clearing mocks
    secureStorage = new (require('../../src/main/secure-storage').KeytarSecureStorage)();
  });

  describe('setProviderApiKey', () => {
    it('should store API key in keychain', async () => {
      mockSetPassword.mockResolvedValue(undefined);

      await secureStorage.setProviderApiKey('openai', 'test-api-key');

      expect(mockSetPassword).toHaveBeenCalledWith(
        'com.opentype.desktop.api-keys',
        'openai',
        'test-api-key'
      );
    });

    it('should throw error when keychain fails', async () => {
      mockSetPassword.mockRejectedValue(new Error('Keychain locked'));

      await expect(
        secureStorage.setProviderApiKey('openai', 'test-api-key')
      ).rejects.toThrow('Failed to store API key: Keychain locked');
    });
  });

  describe('getProviderApiKey', () => {
    it('should return API key from keychain', async () => {
      mockGetPassword.mockResolvedValue('test-api-key');

      const result = await secureStorage.getProviderApiKey('openai');

      expect(result).toBe('test-api-key');
      expect(mockGetPassword).toHaveBeenCalledWith(
        'com.opentype.desktop.api-keys',
        'openai'
      );
    });

    it('should return null when key not found', async () => {
      mockGetPassword.mockResolvedValue(null);

      const result = await secureStorage.getProviderApiKey('openai');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetPassword.mockRejectedValue(new Error('Keychain error'));

      const result = await secureStorage.getProviderApiKey('openai');

      expect(result).toBeNull();
    });
  });

  describe('deleteProviderApiKey', () => {
    it('should delete API key from keychain', async () => {
      mockDeletePassword.mockResolvedValue(true);

      const result = await secureStorage.deleteProviderApiKey('openai');

      expect(result).toBe(true);
      expect(mockDeletePassword).toHaveBeenCalledWith(
        'com.opentype.desktop.api-keys',
        'openai'
      );
    });

    it('should return false on failure', async () => {
      mockDeletePassword.mockRejectedValue(new Error('Keychain error'));

      const result = await secureStorage.deleteProviderApiKey('openai');

      expect(result).toBe(false);
    });
  });

  describe('hasProviderApiKey', () => {
    it('should return true when key exists', async () => {
      mockGetPassword.mockResolvedValue('test-api-key');

      const result = await secureStorage.hasProviderApiKey('openai');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockGetPassword.mockResolvedValue(null);

      const result = await secureStorage.hasProviderApiKey('openai');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockGetPassword.mockRejectedValue(new Error('Keychain error'));

      const result = await secureStorage.hasProviderApiKey('openai');

      expect(result).toBe(false);
    });
  });
});
