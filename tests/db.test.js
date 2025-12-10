/**
 * Unit tests for IndexedDB functions
 */

import dbInstance from '../src/db.js';

// Mock IndexedDB for testing
const mockDB = {
  transaction: jest.fn(),
  close: jest.fn(),
  objectStoreNames: {
    contains: jest.fn().mockReturnValue(false)
  }
};

const mockTransaction = {
  objectStore: jest.fn(),
  onsuccess: null,
  onerror: null
};

const mockStore = {
  add: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  getAll: jest.fn(),
  clear: jest.fn(),
  index: jest.fn(),
  createIndex: jest.fn()
};

const mockIndex = {
  getAll: jest.fn()
};

const mockRequest = {
  onsuccess: null,
  onerror: null,
  result: null
};

// Mock IndexedDB global
global.indexedDB = {
  open: jest.fn()
};

describe('DocSafe Database', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockStore);
    mockStore.index.mockReturnValue(mockIndex);

    // Mock successful requests
    mockStore.add.mockReturnValue(mockRequest);
    mockStore.get.mockReturnValue(mockRequest);
    mockStore.put.mockReturnValue(mockRequest);
    mockStore.delete.mockReturnValue(mockRequest);
    mockStore.getAll.mockReturnValue(mockRequest);
    mockStore.clear.mockReturnValue(mockRequest);
    mockIndex.getAll.mockReturnValue(mockRequest);
  });

  describe('Database Initialization', () => {
    test('should initialize database with correct stores', async () => {
      const mockOpenRequest = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: mockDB
      };

      global.indexedDB.open.mockReturnValue(mockOpenRequest);

      const initPromise = dbInstance.init();

      // Simulate successful opening
      mockOpenRequest.onsuccess();

      await expect(initPromise).resolves.toBe(mockDB);
      expect(global.indexedDB.open).toHaveBeenCalledWith('DocSafeDB', 2);
    });

    test('should handle database upgrade', () => {
      const mockOpenRequest = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: mockDB
      };

      const mockEvent = {
        target: {
          result: {
            objectStoreNames: {
              contains: jest.fn().mockReturnValue(false)
            },
            createObjectStore: jest.fn().mockReturnValue({
              createIndex: jest.fn()
            })
          }
        }
      };

      global.indexedDB.open.mockReturnValue(mockOpenRequest);

      dbInstance.init();

      // Simulate upgrade needed
      mockOpenRequest.onupgradeneeded(mockEvent);

      expect(mockEvent.target.result.createObjectStore).toHaveBeenCalledWith('files', { keyPath: 'id' });
      expect(mockEvent.target.result.createObjectStore).toHaveBeenCalledWith('folders', { keyPath: 'id' });
      expect(mockEvent.target.result.createObjectStore).toHaveBeenCalledWith('metadata', { keyPath: 'key' });
    });

    test('should handle database open error', async () => {
      const mockOpenRequest = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        error: new Error('Database error')
      };

      global.indexedDB.open.mockReturnValue(mockOpenRequest);

      const initPromise = dbInstance.init();

      // Simulate error
      mockOpenRequest.onerror();

      await expect(initPromise).rejects.toEqual(mockOpenRequest.error);
    });
  });

  describe('File Operations', () => {
    beforeEach(() => {
      dbInstance.db = mockDB;
    });

    test('addFile should add file to database', async () => {
      const testFile = {
        id: 'test-file-1',
        filename: 'test.txt',
        folderId: 'folder-1',
        size: 1024
      };

      mockStore.add.mockReturnValue(mockRequest);

      dbInstance.addFile(testFile);

      expect(mockDB.transaction).toHaveBeenCalledWith(['files'], 'readwrite');
      expect(mockTransaction.objectStore).toHaveBeenCalledWith('files');
      expect(mockStore.add).toHaveBeenCalledWith(testFile);
    });

    test('getFile should retrieve file by id', async () => {
      const fileId = 'test-file-1';
      const expectedFile = { id: fileId, filename: 'test.txt' };

      mockRequest.result = expectedFile;

      const getPromise = dbInstance.getFile(fileId);

      // Simulate successful request
      setTimeout(() => mockRequest.onsuccess(), 0);

      expect(mockDB.transaction).toHaveBeenCalledWith(['files'], 'readonly');
      expect(mockStore.get).toHaveBeenCalledWith(fileId);

      const result = await getPromise;
      expect(result).toBe(expectedFile);
    });

    test('updateFile should update existing file', async () => {
      const testFile = {
        id: 'test-file-1',
        filename: 'updated.txt',
        folderId: 'folder-1'
      };

      mockStore.put.mockReturnValue(mockRequest);

      dbInstance.updateFile(testFile);

      expect(mockDB.transaction).toHaveBeenCalledWith(['files'], 'readwrite');
      expect(mockStore.put).toHaveBeenCalledWith(testFile);
    });

    test('deleteFile should remove file from database', async () => {
      const fileId = 'test-file-1';

      mockStore.delete.mockReturnValue(mockRequest);

      dbInstance.deleteFile(fileId);

      expect(mockDB.transaction).toHaveBeenCalledWith(['files'], 'readwrite');
      expect(mockStore.delete).toHaveBeenCalledWith(fileId);
    });

    test('getFilesByFolder should return files in folder', async () => {
      const folderId = 'folder-1';
      const expectedFiles = [
        { id: 'file-1', folderId },
        { id: 'file-2', folderId }
      ];

      mockRequest.result = expectedFiles;

      const getPromise = dbInstance.getFilesByFolder(folderId);

      // Simulate successful request
      setTimeout(() => mockRequest.onsuccess(), 0);

      expect(mockDB.transaction).toHaveBeenCalledWith(['files'], 'readonly');
      expect(mockStore.index).toHaveBeenCalledWith('folderId');
      expect(mockIndex.getAll).toHaveBeenCalledWith(folderId);

      const result = await getPromise;
      expect(result).toBe(expectedFiles);
    });
  });

  describe('Folder Operations', () => {
    beforeEach(() => {
      dbInstance.db = mockDB;
    });

    test('addFolder should add folder to database', async () => {
      const testFolder = {
        id: 'folder-1',
        name: 'Test Folder',
        isProtected: false
      };

      mockStore.add.mockReturnValue(mockRequest);

      dbInstance.addFolder(testFolder);

      expect(mockDB.transaction).toHaveBeenCalledWith(['folders'], 'readwrite');
      expect(mockStore.add).toHaveBeenCalledWith(testFolder);
    });

    test('getFolder should retrieve folder by id', async () => {
      const folderId = 'folder-1';
      const expectedFolder = { id: folderId, name: 'Test Folder' };

      mockRequest.result = expectedFolder;

      const getPromise = dbInstance.getFolder(folderId);

      // Simulate successful request
      setTimeout(() => mockRequest.onsuccess(), 0);

      expect(mockDB.transaction).toHaveBeenCalledWith(['folders'], 'readonly');
      expect(mockStore.get).toHaveBeenCalledWith(folderId);

      const result = await getPromise;
      expect(result).toBe(expectedFolder);
    });

    test('getAllFolders should return all folders', async () => {
      const expectedFolders = [
        { id: 'folder-1', name: 'Folder 1' },
        { id: 'folder-2', name: 'Folder 2' }
      ];

      mockRequest.result = expectedFolders;

      const getAllPromise = dbInstance.getAllFolders();

      // Simulate successful request
      setTimeout(() => mockRequest.onsuccess(), 0);

      expect(mockDB.transaction).toHaveBeenCalledWith(['folders'], 'readonly');
      expect(mockStore.getAll).toHaveBeenCalled();

      const result = await getAllPromise;
      expect(result).toBe(expectedFolders);
    });

    test('updateFolder should update existing folder', async () => {
      const testFolder = {
        id: 'folder-1',
        name: 'Updated Folder',
        isProtected: true
      };

      mockStore.put.mockReturnValue(mockRequest);

      dbInstance.updateFolder(testFolder);

      expect(mockDB.transaction).toHaveBeenCalledWith(['folders'], 'readwrite');
      expect(mockStore.put).toHaveBeenCalledWith(testFolder);
    });

    test('deleteFolder should remove folder from database', async () => {
      const folderId = 'folder-1';

      mockStore.delete.mockReturnValue(mockRequest);

      dbInstance.deleteFolder(folderId);

      expect(mockDB.transaction).toHaveBeenCalledWith(['folders'], 'readwrite');
      expect(mockStore.delete).toHaveBeenCalledWith(folderId);
    });
  });

  describe('Metadata Operations', () => {
    beforeEach(() => {
      dbInstance.db = mockDB;
    });

    test('setMetadata should store key-value pair', async () => {
      const key = 'test-key';
      const value = 'test-value';

      mockStore.put.mockReturnValue(mockRequest);

      dbInstance.setMetadata(key, value);

      expect(mockDB.transaction).toHaveBeenCalledWith(['metadata'], 'readwrite');
      expect(mockStore.put).toHaveBeenCalledWith({ key, value });
    });

    test('getMetadata should retrieve value by key', async () => {
      const key = 'test-key';
      const expectedValue = 'test-value';

      mockRequest.result = { key, value: expectedValue };

      const getPromise = dbInstance.getMetadata(key);

      // Simulate successful request
      setTimeout(() => mockRequest.onsuccess(), 0);

      expect(mockDB.transaction).toHaveBeenCalledWith(['metadata'], 'readonly');
      expect(mockStore.get).toHaveBeenCalledWith(key);

      const result = await getPromise;
      expect(result).toBe(expectedValue);
    });

    test('getMetadata should return undefined for non-existent key', async () => {
      const key = 'non-existent-key';

      mockRequest.result = undefined;

      const getPromise = dbInstance.getMetadata(key);

      // Simulate successful request
      setTimeout(() => mockRequest.onsuccess(), 0);

      const result = await getPromise;
      expect(result).toBeUndefined();
    });
  });

  describe('Database Management', () => {
    beforeEach(() => {
      dbInstance.db = mockDB;
    });

    test('clearAll should clear all object stores', async () => {
      const mockClearPromises = [
        Promise.resolve(),
        Promise.resolve(),
        Promise.resolve()
      ];

      mockStore.clear
        .mockReturnValueOnce(mockClearPromises[0])
        .mockReturnValueOnce(mockClearPromises[1])
        .mockReturnValueOnce(mockClearPromises[2]);

      await dbInstance.clearAll();

      expect(mockDB.transaction).toHaveBeenCalledWith(['files', 'folders', 'metadata', 'file_chunks'], 'readwrite');
      expect(mockStore.clear).toHaveBeenCalledTimes(4);
    });

    test('close should close database connection', async () => {
      await dbInstance.close();

      expect(mockDB.close).toHaveBeenCalled();
      expect(dbInstance.db).toBeNull();
    });

    test('close should handle null database', async () => {
      dbInstance.db = null;

      await dbInstance.close();

      expect(mockDB.close).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      dbInstance.db = mockDB;
    });

    test('should handle request errors', async () => {
      const testError = new Error('Database request failed');
      mockRequest.error = testError;

      const getPromise = dbInstance.getFile('test-id');

      // Simulate error
      setTimeout(() => mockRequest.onerror(), 0);

      await expect(getPromise).rejects.toBe(testError);
    });
  });
});
