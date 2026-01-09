/**
 * IndexedDB helper functions for File Safe
 */

const DB_NAME = 'DocSafeDB';
const DB_VERSION = 2;
const STORES = {
  FILES: 'files',
  FOLDERS: 'folders',
  METADATA: 'metadata',
  FILE_CHUNKS: 'file_chunks'
};

class LocalFileVaultDB {
  constructor() {
    this.dbName = 'LocalFileVaultDB';
    this.dbVersion = 2;
    this.db = null;
  }

  /**
   * Helper to wrap IDBRequest in a Promise
   */
  promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Request failed'));
    });
  }

  /**
   * Helper to wait for transaction completion
   */
  async awaitTransaction(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Transaction failed'));
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Files store - stores actual file blobs
        if (!db.objectStoreNames.contains(STORES.FILES)) {
          const filesStore = db.createObjectStore(STORES.FILES, { keyPath: 'id' });
          filesStore.createIndex('folderId', 'folderId', { unique: false });
          filesStore.createIndex('filename', 'filename', { unique: false });
        }

        // Folders store - stores folder metadata and password hashes
        if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
          const foldersStore = db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' });
          foldersStore.createIndex('name', 'name', { unique: false });
        }

        // Metadata store - stores app-level metadata
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }

        // File Chunks store (v2) - stores encrypted file parts
        if (!db.objectStoreNames.contains(STORES.FILE_CHUNKS)) {
          const chunksStore = db.createObjectStore(STORES.FILE_CHUNKS, { keyPath: ['fileId', 'chunkIndex'] });
          chunksStore.createIndex('fileId', 'fileId', { unique: false });
        }
      };
    });
  }

  async addFile(file) {
    const transaction = this.db.transaction([STORES.FILES], 'readwrite');
    const store = transaction.objectStore(STORES.FILES);
    const request = store.add(file);
    await this.awaitTransaction(transaction);
    return request.result;
  }

  async getFile(id) {
    if (!id) {
      throw new Error('File ID is required');
    }

    const transaction = this.db.transaction([STORES.FILES], 'readonly');
    const store = transaction.objectStore(STORES.FILES);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateFile(file) {
    const transaction = this.db.transaction([STORES.FILES], 'readwrite');
    const store = transaction.objectStore(STORES.FILES);
    const request = store.put(file);
    await this.awaitTransaction(transaction);
    return request.result;
  }

  async deleteFile(id) {
    const transaction = this.db.transaction([STORES.FILES], 'readwrite');
    const store = transaction.objectStore(STORES.FILES);
    store.delete(id);
    return this.awaitTransaction(transaction);
  }

  async getFilesByFolder(folderId) {
    const transaction = this.db.transaction([STORES.FILES], 'readonly');
    const store = transaction.objectStore(STORES.FILES);
    const index = store.index('folderId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(folderId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addFolder(folder) {
    const transaction = this.db.transaction([STORES.FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORES.FOLDERS);
    const request = store.add(folder);
    await this.awaitTransaction(transaction);
    return request.result;
  }

  async getFolder(id) {
    if (!id) {
      throw new Error('Folder ID is required');
    }

    const transaction = this.db.transaction([STORES.FOLDERS], 'readonly');
    const store = transaction.objectStore(STORES.FOLDERS);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateFolder(folder) {
    const transaction = this.db.transaction([STORES.FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORES.FOLDERS);
    const request = store.put(folder);
    await this.awaitTransaction(transaction);
    return request.result;
  }

  async deleteFolder(id) {
    const transaction = this.db.transaction([STORES.FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORES.FOLDERS);
    store.delete(id);
    return this.awaitTransaction(transaction);
  }

  async getAllFolders() {
    const transaction = this.db.transaction([STORES.FOLDERS], 'readonly');
    const store = transaction.objectStore(STORES.FOLDERS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async setMetadata(key, value) {
    const transaction = this.db.transaction([STORES.METADATA], 'readwrite');
    const store = transaction.objectStore(STORES.METADATA);
    store.put({ key, value });
    return this.awaitTransaction(transaction);
  }

  async addFileChunk(chunk) {
    const transaction = this.db.transaction([STORES.FILE_CHUNKS], 'readwrite');
    const store = transaction.objectStore(STORES.FILE_CHUNKS);
    store.put(chunk);
    return this.awaitTransaction(transaction);
  }

  async getFileChunks(fileId) {
    const transaction = this.db.transaction([STORES.FILE_CHUNKS], 'readonly');
    const store = transaction.objectStore(STORES.FILE_CHUNKS);
    const index = store.index('fileId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(fileId);
      request.onsuccess = () => {
        // Sort by chunkIndex to ensure order
        const chunks = request.result.sort((a, b) => a.chunkIndex - b.chunkIndex);
        resolve(chunks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteChunksByFile(fileId) {
    const transaction = this.db.transaction([STORES.FILE_CHUNKS], 'readwrite');
    const store = transaction.objectStore(STORES.FILE_CHUNKS);
    const index = store.index('fileId');

    return new Promise((resolve, reject) => {
      const request = index.openKeyCursor(IDBKeyRange.only(fileId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(key) {
    const transaction = this.db.transaction([STORES.METADATA], 'readonly');
    const store = transaction.objectStore(STORES.METADATA);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll() {
    const transaction = this.db.transaction([STORES.FILES, STORES.FOLDERS, STORES.METADATA, STORES.FILE_CHUNKS], 'readwrite');

    transaction.objectStore(STORES.FILES).clear();
    transaction.objectStore(STORES.FOLDERS).clear();
    transaction.objectStore(STORES.METADATA).clear();
    transaction.objectStore(STORES.FILE_CHUNKS).clear();

    return this.awaitTransaction(transaction);
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
const dbInstance = new LocalFileVaultDB();

export default dbInstance;
