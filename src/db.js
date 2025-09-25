/**
 * IndexedDB helper functions for DocSafe
 */

const DB_NAME = 'DocSafeDB';
const DB_VERSION = 1;
const STORES = {
  FILES: 'files',
  FOLDERS: 'folders',
  METADATA: 'metadata'
};

class DocSafeDB {
  constructor() {
    this.db = null;
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
      };
    });
  }

  async addFile(file) {
    const transaction = this.db.transaction([STORES.FILES], 'readwrite');
    const store = transaction.objectStore(STORES.FILES);
    return store.add(file);
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
    return store.put(file);
  }

  async deleteFile(id) {
    const transaction = this.db.transaction([STORES.FILES], 'readwrite');
    const store = transaction.objectStore(STORES.FILES);
    return store.delete(id);
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
    return store.add(folder);
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
    return store.put(folder);
  }

  async deleteFolder(id) {
    const transaction = this.db.transaction([STORES.FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORES.FOLDERS);
    return store.delete(id);
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
    return store.put({ key, value });
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
    const transaction = this.db.transaction([STORES.FILES, STORES.FOLDERS, STORES.METADATA], 'readwrite');
    
    await Promise.all([
      transaction.objectStore(STORES.FILES).clear(),
      transaction.objectStore(STORES.FOLDERS).clear(),
      transaction.objectStore(STORES.METADATA).clear()
    ]);
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
const dbInstance = new DocSafeDB();

export default dbInstance;
