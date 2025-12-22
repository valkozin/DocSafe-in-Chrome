/**
 * Unit tests for main application logic
 */

import app from '../src/app.js';
import dbInstance from '../src/db.js';
import * as crypto from '../src/crypto.js';

// Mock dependencies
jest.mock('../src/db.js');
jest.mock('../src/crypto.js');

describe('DocSafe Application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app.currentFolder = null;
    app.unlockedFolders.clear();
    app.sessionPasswords.clear();
  });

  describe('Initialization', () => {
    test('should initialize database and create default folder', async () => {
      dbInstance.init.mockResolvedValue();
      dbInstance.getAllFolders.mockResolvedValue([]);
      dbInstance.addFolder.mockResolvedValue();

      await app.init();

      expect(dbInstance.init).toHaveBeenCalled();
      expect(dbInstance.getAllFolders).toHaveBeenCalled();
      expect(dbInstance.addFolder).toHaveBeenCalledWith({
        id: 'default',
        name: 'General',
        isProtected: false,
        createdAt: expect.any(String)
      });
    });

    test('should not create default folder if it exists', async () => {
      const existingFolders = [
        { id: 'default', name: 'General', isProtected: false }
      ];

      dbInstance.init.mockResolvedValue();
      dbInstance.getAllFolders.mockResolvedValue(existingFolders);

      await app.init();

      expect(dbInstance.addFolder).not.toHaveBeenCalled();
    });
  });

  describe('Folder Management', () => {
    test('createFolder should create unprotected folder', async () => {
      const folderName = 'Test Folder';
      dbInstance.getAllFolders.mockResolvedValue([]);
      dbInstance.addFolder.mockResolvedValue();

      const result = await app.createFolder(folderName);

      expect(result).toEqual({
        id: expect.any(String),
        name: folderName,
        isProtected: false,
        createdAt: expect.any(String)
      });

      expect(dbInstance.addFolder).toHaveBeenCalledWith(result);
    });

    test('createFolder should create protected folder with password', async () => {
      const folderName = 'Secret Folder';
      const password = 'secretpass';
      const mockSalt = new Uint8Array([1, 2, 3]);
      const mockHash = new Uint8Array([4, 5, 6]);

      dbInstance.getAllFolders.mockResolvedValue([]);
      dbInstance.addFolder.mockResolvedValue();
      crypto.generateSalt.mockReturnValue(mockSalt);
      crypto.hashPassword.mockResolvedValue(mockHash);
      crypto.uint8ArrayToBase64.mockReturnValue('base64string');

      const result = await app.createFolder(folderName, password);

      expect(result.isProtected).toBe(true);
      expect(result.salt).toBe('base64string');
      expect(result.passwordHash).toBe('base64string');
      expect(crypto.generateSalt).toHaveBeenCalled();
      expect(crypto.hashPassword).toHaveBeenCalledWith(password, mockSalt);
    });

    test('createFolder should reject duplicate names', async () => {
      const folderName = 'Existing Folder';
      const existingFolders = [
        { id: 'folder1', name: folderName }
      ];

      dbInstance.getAllFolders.mockResolvedValue(existingFolders);

      await expect(app.createFolder(folderName)).rejects.toThrow('Folder with this name already exists');
    });

    test('createFolder should reject empty names', async () => {
      await expect(app.createFolder('')).rejects.toThrow('Folder name cannot be empty');
      await expect(app.createFolder('   ')).rejects.toThrow('Folder name cannot be empty');
    });

    test('deleteFolder should delete folder and files', async () => {
      const folderId = 'test-folder';
      const folderFiles = [
        { id: 'file1', folderId },
        { id: 'file2', folderId }
      ];

      dbInstance.getFilesByFolder.mockResolvedValue(folderFiles);
      // Ensure getFile returns something so deleteFile proceeds
      dbInstance.getFile.mockResolvedValue({ id: 'file1' });
      dbInstance.deleteFile.mockResolvedValue();
      dbInstance.deleteChunksByFile.mockResolvedValue(); // Mock chunks cleanup
      dbInstance.deleteFolder.mockResolvedValue();

      await app.deleteFolder(folderId);

      expect(dbInstance.getFilesByFolder).toHaveBeenCalledWith(folderId);
      expect(dbInstance.deleteFile).toHaveBeenCalledTimes(2);
      expect(dbInstance.deleteFolder).toHaveBeenCalledWith(folderId);
    });

    test('deleteFolder should not delete default folder', async () => {
      await expect(app.deleteFolder('default')).rejects.toThrow('Cannot delete the default folder');
    });

    test('getFolders should return all folders', async () => {
      const mockFolders = [
        { id: 'folder1', name: 'Folder 1' },
        { id: 'folder2', name: 'Folder 2' }
      ];

      dbInstance.getAllFolders.mockResolvedValue(mockFolders);

      const result = await app.getFolders();

      expect(result).toBe(mockFolders);
      expect(dbInstance.getAllFolders).toHaveBeenCalled();
    });

    test('renameFolder should update folder name', async () => {
      const folderId = 'folder1';
      const oldName = 'Old Folder';
      const newName = 'New Folder';
      const mockFolders = [{ id: folderId, name: oldName }];

      dbInstance.getAllFolders.mockResolvedValue(mockFolders);
      dbInstance.updateFolder.mockResolvedValue();

      const result = await app.renameFolder(folderId, newName);

      expect(result.name).toBe(newName);
      expect(dbInstance.updateFolder).toHaveBeenCalledWith(expect.objectContaining({
        id: folderId,
        name: newName
      }));
    });

    test('renameFolder should reject renaming default folder', async () => {
      await expect(app.renameFolder('default', 'New Name')).rejects.toThrow('Cannot rename the default folder');
    });

    test('renameFolder should reject empty name', async () => {
      await expect(app.renameFolder('folder1', '')).rejects.toThrow('Folder name cannot be empty');
      await expect(app.renameFolder('folder1', '   ')).rejects.toThrow('Folder name cannot be empty');
    });

    test('renameFolder should reject duplicate name', async () => {
      const folderId = 'folder1';
      const mockFolders = [
        { id: folderId, name: 'Folder 1' },
        { id: 'folder2', name: 'Folder 2' }
      ];

      dbInstance.getAllFolders.mockResolvedValue(mockFolders);

      await expect(app.renameFolder(folderId, 'Folder 2')).rejects.toThrow('Folder with this name already exists');
    });
  });

  describe('Folder Unlocking', () => {
    test('unlockFolder should unlock unprotected folder', async () => {
      const folder = { id: 'folder1', isProtected: false };
      dbInstance.getFolder.mockResolvedValue(folder);

      const result = await app.unlockFolder('folder1', 'anypassword');

      expect(result).toBe(true);
      expect(app.unlockedFolders.has('folder1')).toBe(true);
    });

    test('unlockFolder should unlock protected folder with correct password', async () => {
      const folder = {
        id: 'folder1',
        isProtected: true,
        salt: 'salt-base64',
        passwordHash: 'hash-base64'
      };
      const password = 'correctpassword';
      const mockSalt = new Uint8Array([1, 2, 3]);
      const mockHash = new Uint8Array([4, 5, 6]);

      dbInstance.getFolder.mockResolvedValue(folder);
      crypto.base64ToUint8Array.mockReturnValueOnce(mockSalt).mockReturnValueOnce(mockHash);
      crypto.verifyPassword.mockResolvedValue(true);

      const result = await app.unlockFolder('folder1', password);

      expect(result).toBe(true);
      expect(app.unlockedFolders.has('folder1')).toBe(true);
      expect(app.sessionPasswords.get('folder1')).toBe(password);
      expect(crypto.verifyPassword).toHaveBeenCalledWith(password, mockSalt, mockHash);
    });

    test('unlockFolder should reject protected folder with wrong password', async () => {
      const folder = {
        id: 'folder1',
        isProtected: true,
        salt: 'salt-base64',
        passwordHash: 'hash-base64'
      };
      const password = 'wrongpassword';

      dbInstance.getFolder.mockResolvedValue(folder);
      crypto.base64ToUint8Array.mockReturnValue(new Uint8Array([1, 2, 3]));
      crypto.verifyPassword.mockResolvedValue(false);

      await expect(app.unlockFolder('folder1', password)).rejects.toThrow('Invalid password');
    });

    test('unlockFolder should reject non-existent folder', async () => {
      dbInstance.getFolder.mockResolvedValue(null);

      await expect(app.unlockFolder('nonexistent', 'password')).rejects.toThrow('Folder not found');
    });
  });

  describe('File Operations', () => {
    beforeEach(() => {
      app.currentFolder = { id: 'folder1', isProtected: false };
      app.unlockedFolders.add('folder1');
    });

    test('uploadFile should upload to current folder', async () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const folder = { id: 'folder1', isProtected: false };

      app.currentFolder = folder; // Set current folder to avoid defaults

      dbInstance.getFolder.mockResolvedValue(folder);
      dbInstance.addFile.mockResolvedValue();
      dbInstance.addFileChunk.mockResolvedValue(); // Mock chunk addition

      const result = await app.uploadFile(testFile);

      expect(result).toMatchObject({
        id: expect.any(String),
        filename: 'test.txt',
        originalType: 'text/plain',
        size: testFile.size,
        folderId: 'folder1',
        uploadDate: expect.any(String),
        isEncrypted: false,
        chunkCount: 1
      });

      expect(dbInstance.addFileChunk).toHaveBeenCalled();
      expect(dbInstance.addFile).toHaveBeenCalledWith(result);
    });

    test('uploadFile should encrypt file for protected folder', async () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const folder = {
        id: 'folder1',
        isProtected: true,
        salt: 'salt-base64'
      };
      const password = 'testpassword';
      const mockEncryptedBlob = new Blob(['encrypted']);

      app.currentFolder = folder;

      app.sessionPasswords.set('folder1', password);
      dbInstance.getFolder.mockResolvedValue(folder);
      crypto.base64ToUint8Array.mockReturnValue(new Uint8Array([1, 2, 3]));
      crypto.encryptFile.mockResolvedValue(mockEncryptedBlob);
      dbInstance.addFile.mockResolvedValue();
      dbInstance.addFileChunk.mockResolvedValue();

      const result = await app.uploadFile(testFile);

      expect(result.isEncrypted).toBe(true);
      expect(crypto.encryptFile).toHaveBeenCalledWith(expect.anything(), password, expect.any(Uint8Array));
      expect(dbInstance.addFileChunk).toHaveBeenCalledWith(expect.objectContaining({
        data: mockEncryptedBlob
      }));
    });

    test('uploadFile should reject upload to locked folder', async () => {
      const testFile = new Blob(['test content'], { type: 'text/plain' });
      const folder = { id: 'locked-folder', isProtected: true };

      dbInstance.getFolder.mockResolvedValue(folder);

      await expect(app.uploadFile(testFile, 'locked-folder')).rejects.toThrow('Folder is locked');
    });

    test('getFiles should return file metadata', async () => {
      const mockFiles = [
        {
          id: 'file1',
          filename: 'test.txt',
          originalType: 'text/plain',
          size: 1024,
          folderId: 'folder1',
          uploadDate: '2023-01-01',
          isEncrypted: false,
          blob: new Blob(['content'])
        }
      ];

      dbInstance.getFilesByFolder.mockResolvedValue(mockFiles);

      const result = await app.getFiles();

      expect(result).toEqual([{
        id: 'file1',
        filename: 'test.txt',
        originalType: 'text/plain',
        size: 1024,
        folderId: 'folder1',
        uploadDate: '2023-01-01',
        isEncrypted: false
      }]);
    });

    test('downloadFile should return decrypted file', async () => {
      const fileData = {
        id: 'file1',
        filename: 'test.txt',
        originalType: 'text/plain',
        folderId: 'folder1',
        isEncrypted: true,
        // No blob here
      };
      const folder = {
        id: 'folder1',
        isProtected: true,
        salt: 'salt-base64'
      };
      const password = 'testpassword';
      const mockEncryptedChunk = new Blob(['encrypted']);
      const decryptedBlob = new Blob(['decrypted'], { type: 'text/plain' });

      app.sessionPasswords.set('folder1', password);
      dbInstance.getFile.mockResolvedValue(fileData);
      dbInstance.getFolder.mockResolvedValue(folder);
      dbInstance.getFileChunks.mockResolvedValue([{ data: mockEncryptedChunk }]); // Mock chunks

      crypto.base64ToUint8Array.mockReturnValue(new Uint8Array([1, 2, 3]));
      crypto.decryptFile.mockResolvedValue(decryptedBlob);

      const result = await app.downloadFile('file1');

      expect(result).toMatchObject({
        filename: 'test.txt',
        type: 'text/plain'
      });
      // The blob should be composed of decrypted parts. 
      // Since we mocked decryptFile to return 'decryptedBlob', the result.blob should contain that content.

      expect(crypto.decryptFile).toHaveBeenCalled();
    });

    test('renameFile should update filename', async () => {
      const fileData = {
        id: 'file1',
        filename: 'old-name.txt'
      };
      const newName = 'new-name.txt';

      dbInstance.getFile.mockResolvedValue(fileData);
      dbInstance.updateFile.mockResolvedValue();

      const result = await app.renameFile('file1', newName);

      expect(result.filename).toBe(newName);
      expect(dbInstance.updateFile).toHaveBeenCalledWith({
        ...fileData,
        filename: newName
      });
    });

    test('renameFile should reject empty names', async () => {
      await expect(app.renameFile('file1', '')).rejects.toThrow('Filename cannot be empty');
      await expect(app.renameFile('file1', '   ')).rejects.toThrow('Filename cannot be empty');
    });

    test('deleteFile should remove file', async () => {
      const fileData = { id: 'file1' };

      dbInstance.getFile.mockResolvedValue(fileData);
      dbInstance.deleteFile.mockResolvedValue();

      await app.deleteFile('file1');

      expect(dbInstance.deleteFile).toHaveBeenCalledWith('file1');
    });
  });

  describe('Security Operations', () => {
    test('lockFolder should remove from unlocked set', () => {
      app.unlockedFolders.add('folder1');
      app.sessionPasswords.set('folder1', 'password');

      app.lockFolder('folder1');

      expect(app.unlockedFolders.has('folder1')).toBe(false);
      expect(app.sessionPasswords.has('folder1')).toBe(false);
    });

    test('lockAllFolders should clear all session data', () => {
      app.unlockedFolders.add('folder1');
      app.unlockedFolders.add('folder2');
      app.sessionPasswords.set('folder1', 'password1');
      app.sessionPasswords.set('folder2', 'password2');
      app.currentFolder = { id: 'folder1' };

      app.lockAllFolders();

      expect(app.unlockedFolders.size).toBe(0);
      expect(app.sessionPasswords.size).toBe(0);
      expect(app.currentFolder).toBeNull();
    });

    test('resetVault should clear all data', async () => {
      app.unlockedFolders.add('folder1');
      app.sessionPasswords.set('folder1', 'password');
      app.currentFolder = { id: 'folder1' };

      dbInstance.clearAll.mockResolvedValue();
      dbInstance.getAllFolders.mockResolvedValue([]);
      dbInstance.addFolder.mockResolvedValue();

      await app.resetVault();

      expect(dbInstance.clearAll).toHaveBeenCalled();
      expect(app.unlockedFolders.size).toBe(0);
      expect(app.sessionPasswords.size).toBe(0);
      expect(app.currentFolder).toBeNull();
    });
  });

  describe('Utility Functions', () => {
    test('generateId should return unique strings', () => {
      const id1 = app.generateId();
      const id2 = app.generateId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
    });

    test('isFolderUnlocked should check unlock status', () => {
      app.unlockedFolders.add('folder1');

      expect(app.isFolderUnlocked('folder1')).toBe(true);
      expect(app.isFolderUnlocked('folder2')).toBe(false);
    });

    test('getStorageStats should return statistics', async () => {
      const mockFolders = [
        { id: 'folder1', isProtected: false },
        { id: 'folder2', isProtected: true }
      ];
      const mockFiles = [
        { size: 1024 },
        { size: 2048 }
      ];

      dbInstance.getAllFolders.mockResolvedValue(mockFolders);
      dbInstance.getFilesByFolder.mockResolvedValue(mockFiles);

      const stats = await app.getStorageStats();

      expect(stats).toEqual({
        totalFiles: 4, // 2 files per folder
        totalSize: 6144, // (1024 + 2048) * 2
        folderCount: 2,
        protectedFolders: 1
      });
    });
  });

  describe('Error Handling', () => {
    test('setCurrentFolder should reject non-existent folder', async () => {
      dbInstance.getFolder.mockResolvedValue(null);

      await expect(app.setCurrentFolder('nonexistent')).rejects.toThrow('Folder not found');
    });

    test('setCurrentFolder should reject locked protected folder', async () => {
      const folder = { id: 'folder1', isProtected: true };
      dbInstance.getFolder.mockResolvedValue(folder);

      await expect(app.setCurrentFolder('folder1')).rejects.toThrow('Folder is locked');
    });

    test('uploadFile should reject missing password for encrypted folder', async () => {
      const testFile = new File(['test'], 'name.txt');
      const folder = { id: 'folder1', isProtected: true };

      app.currentFolder = folder; // Ensure we target the right folder
      app.unlockedFolders.add('folder1');
      // Don't set session password
      dbInstance.getFolder.mockResolvedValue(folder);

      await expect(app.uploadFile(testFile)).rejects.toThrow('Password not available');
    });

    test('downloadFile should reject missing password for encrypted file', async () => {
      const fileData = {
        id: 'file1',
        isEncrypted: true,
        folderId: 'folder1'
      };
      const folder = { id: 'folder1', isProtected: true };

      dbInstance.getFile.mockResolvedValue(fileData);
      dbInstance.getFolder.mockResolvedValue(folder);
      // Don't set session password

      await expect(app.downloadFile('file1')).rejects.toThrow('Password not available for encrypted file');
    });
  });
});
