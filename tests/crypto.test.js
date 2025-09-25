/**
 * Unit tests for crypto functions
 */

import {
  generateSalt,
  generateIV,
  deriveKey,
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
  encryptFile,
  decryptFile,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  uint8ArrayToBase64,
  base64ToUint8Array
} from '../src/crypto.js';

// Crypto is already mocked in setup.js, no need to redefine it here

describe('Crypto Utilities', () => {
  describe('Random Generation', () => {
    test('generateSalt should return Uint8Array of correct length', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    test('generateIV should return Uint8Array of correct length', () => {
      const iv = generateIV();
      expect(iv).toBeInstanceOf(Uint8Array);
      expect(iv.length).toBe(12);
    });

    test('generateSalt should produce different values', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('Base64 Conversion', () => {
    test('arrayBufferToBase64 and base64ToArrayBuffer should be reversible', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const base64 = arrayBufferToBase64(original);
      const result = base64ToArrayBuffer(base64);
      
      expect(new Uint8Array(result)).toEqual(new Uint8Array(original));
    });

    test('uint8ArrayToBase64 and base64ToUint8Array should be reversible', () => {
      const original = new Uint8Array([10, 20, 30, 40, 50]);
      const base64 = uint8ArrayToBase64(original);
      const result = base64ToUint8Array(base64);
      
      expect(result).toEqual(original);
    });

    test('should handle empty arrays', () => {
      const empty = new Uint8Array([]);
      const base64 = uint8ArrayToBase64(empty);
      const result = base64ToUint8Array(base64);
      
      expect(result.length).toBe(0);
    });
  });

  describe('Password Operations', () => {
    // Note: These tests would require proper WebCrypto API mocking
    // In a real test environment, you would need to mock crypto.subtle methods
    
    test('hashPassword should handle different passwords', async () => {
      // Mock responses are already set up in setup.js
      const salt = generateSalt();
      const hash1 = await hashPassword('password1', salt);
      const hash2 = await hashPassword('password2', salt);
      
      expect(hash1).toBeInstanceOf(Uint8Array);
      expect(hash2).toBeInstanceOf(Uint8Array);
      expect(global.crypto.subtle.importKey).toHaveBeenCalled();
      expect(global.crypto.subtle.deriveBits).toHaveBeenCalled();
    });

    test('verifyPassword should work correctly', async () => {
      const testHash = new Uint8Array([1, 2, 3, 4]);
      
      const salt = generateSalt();
      const password = 'testpassword';
      
      const isValid = await verifyPassword(password, salt, testHash);
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('File Encryption', () => {
    test('encryptFile should return a Blob', async () => {
      const testFile = new Blob(['test content'], { type: 'text/plain' });
      const salt = generateSalt();
      const password = 'testpassword';
      
      const encryptedFile = await encryptFile(testFile, password, salt);
      expect(encryptedFile).toBeInstanceOf(Blob);
      expect(encryptedFile.type).toBe('application/octet-stream');
    });

    test('decryptFile should return a Blob with original type', async () => {
      const encryptedBlob = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
      const salt = generateSalt();
      const password = 'testpassword';
      const originalType = 'text/plain';
      
      const decryptedFile = await decryptFile(encryptedBlob, password, salt, originalType);
      expect(decryptedFile).toBeInstanceOf(Blob);
      expect(decryptedFile.type).toBe(originalType);
    });
  });

  describe('Data Encryption', () => {
    test('encryptData should handle string input', async () => {
      const testData = 'Hello, World!';
      const salt = generateSalt();
      const password = 'testpassword';
      
      const encrypted = await encryptData(testData, password, salt);
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(12); // At least IV length
    });

    test('encryptData should handle Blob input', async () => {
      const testBlob = new Blob(['test content']);
      const salt = generateSalt();
      const password = 'testpassword';
      
      const encrypted = await encryptData(testBlob, password, salt);
      expect(encrypted).toBeInstanceOf(Uint8Array);
    });

    test('encryptData should handle ArrayBuffer input', async () => {
      const testBuffer = new TextEncoder().encode('test').buffer;
      const salt = generateSalt();
      const password = 'testpassword';
      
      const encrypted = await encryptData(testBuffer, password, salt);
      expect(encrypted).toBeInstanceOf(Uint8Array);
    });

    test('encryptData should throw for unsupported types', async () => {
      const salt = generateSalt();
      const password = 'testpassword';
      
      await expect(encryptData(123, password, salt)).rejects.toThrow('Unsupported data type for encryption');
      await expect(encryptData(null, password, salt)).rejects.toThrow('Unsupported data type for encryption');
      await expect(encryptData(undefined, password, salt)).rejects.toThrow('Unsupported data type for encryption');
    });
  });

  describe('Error Handling', () => {
    test('decryptData should throw on invalid password', async () => {
      // Mock decrypt to fail
      global.crypto.subtle.decrypt = jest.fn().mockRejectedValue(new Error('Decrypt failed'));

      const fakeEncryptedData = new Uint8Array(20); // 12 bytes IV + 8 bytes data
      const salt = generateSalt();
      const password = 'wrongpassword';
      
      await expect(decryptData(fakeEncryptedData, password, salt))
        .rejects.toThrow('Decryption failed - invalid password or corrupted data');
    });
  });
});

// Test utilities for integration tests
export const TestUtils = {
  async createTestFile(content = 'test content', type = 'text/plain') {
    return new Blob([content], { type });
  },

  async createEncryptedTestFile(content = 'test content', password = 'testpass') {
    const file = await this.createTestFile(content);
    const salt = generateSalt();
    
    // Mock encryption for testing
    crypto.subtle.importKey = jest.fn().mockResolvedValue({});
    crypto.subtle.deriveKey = jest.fn().mockResolvedValue({});
    crypto.subtle.encrypt = jest.fn().mockResolvedValue(new TextEncoder().encode(content).buffer);
    
    return {
      file: await encryptFile(file, password, salt),
      salt,
      password,
      originalType: 'text/plain'
    };
  },

  generateTestSalt() {
    return generateSalt();
  }
};
