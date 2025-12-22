/**
 * Main application logic for Local File Vault
 */

import dbInstance from './db.js';
import {
  generateSalt,
  hashPassword,
  verifyPassword,
  encryptFile,
  decryptFile,
  uint8ArrayToBase64,
  base64ToUint8Array
} from './crypto.js';

class LocalFileVaultApp {
  constructor() {
    this.currentFolder = null;
    this.unlockedFolders = new Set();
    this.sessionPasswords = new Map(); // Store passwords for session
    this.initLock = null; // Mutex for initialization

    // Listen for setting changes
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.setting_autoLock) {
          this.handleStorageChange(changes.setting_autoLock.newValue);
        }
      });
    }
  }

  async init() {
    // Basic mutex to prevent race conditions during multiple init calls
    if (this.initLock) {
      return this.initLock;
    }

    this.initLock = (async () => {
      try {
        await dbInstance.init();
        await this.ensureDefaultFolder();

        // Restore session
        await this.loadSessionState();
      } finally {
        this.initLock = null;
      }
    })();

    return this.initLock;
  }

  /**
   * Ensure a default "General" folder exists
   */
  async ensureDefaultFolder() {
    const folders = await dbInstance.getAllFolders();
    const defaultFolder = folders.find(f => f.name === 'General' && !f.isProtected);

    if (!defaultFolder) {
      const folder = {
        id: 'default',
        name: 'General',
        isProtected: false,
        createdAt: new Date().toISOString()
      };
      await dbInstance.addFolder(folder);
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(name, password = null) {
    if (!name || name.trim() === '') {
      throw new Error('Folder name cannot be empty');
    }

    const folders = await dbInstance.getAllFolders();
    if (folders.some(f => f.name === name)) {
      throw new Error('Folder with this name already exists');
    }

    const folder = {
      id: this.generateId(),
      name: name.trim(),
      isProtected: !!password,
      createdAt: new Date().toISOString()
    };


    if (password) {
      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);

      folder.salt = uint8ArrayToBase64(salt);
      folder.passwordHash = uint8ArrayToBase64(passwordHash);
    }

    await dbInstance.addFolder(folder);
    return folder;
  }

  /**
   * Delete a folder and all its files
   */
  async deleteFolder(folderId) {
    if (folderId === 'default') {
      throw new Error('Cannot delete the default folder');
    }

    // Delete all files in the folder
    const files = await dbInstance.getFilesByFolder(folderId);
    for (const file of files) {
      await this.deleteFile(file.id);
    }

    // Delete the folder
    await dbInstance.deleteFolder(folderId);

    // Clean up session data
    this.unlockedFolders.delete(folderId);
    this.sessionPasswords.delete(folderId);

    if (this.currentFolder?.id === folderId) {
      this.currentFolder = null;
    }
  }

  /**
   * Get all folders
   */
  async getFolders() {
    return await dbInstance.getAllFolders();
  }

  /**
   * Unlock a protected folder with password
   */
  async unlockFolder(folderId, password) {
    const folder = await dbInstance.getFolder(folderId);
    if (!folder) {
      throw new Error('Folder not found');
    }

    if (!folder.isProtected) {
      this.unlockedFolders.add(folderId);
      return true;
    }

    const salt = base64ToUint8Array(folder.salt);
    const storedHash = base64ToUint8Array(folder.passwordHash);

    const isValid = await verifyPassword(password, salt, storedHash);
    if (isValid) {
      this.unlockedFolders.add(folderId);
      this.sessionPasswords.set(folderId, password);

      await this.saveSessionState();

      return true;
    }

    throw new Error('Invalid password');
  }

  /**
   * Check if folder is unlocked
   */
  isFolderUnlocked(folderId) {
    const folder = this.currentFolder;
    if (!folder || folder.id !== folderId) {
      return this.unlockedFolders.has(folderId);
    }
    return !folder.isProtected || this.unlockedFolders.has(folderId);
  }

  /**
   * Set current folder
   */
  async setCurrentFolder(folderId) {
    if (!folderId) {
      throw new Error('Folder ID is required');
    }

    const folder = await dbInstance.getFolder(folderId);
    if (!folder) {
      throw new Error('Folder not found');
    }

    if (folder.isProtected && !this.unlockedFolders.has(folderId)) {
      throw new Error('Folder is locked');
    }

    this.currentFolder = folder;
    return folder;
  }

  /**
   * Upload a file to the current folder (Chunked)
   */
  async uploadFile(file, folderId = null) {
    const targetFolderId = folderId || this.currentFolder?.id || 'default';
    const folder = await dbInstance.getFolder(targetFolderId);

    if (!folder) {
      throw new Error('Target folder not found');
    }

    if (folder.isProtected && !this.unlockedFolders.has(targetFolderId)) {
      throw new Error('Folder is locked');
    }

    const fileId = this.generateId();
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

    // Check storage limit
    const storageStats = await this.getStorageUsage();
    // Allow upload if current usage + new file size < quota
    if (storageStats.usage + file.size > storageStats.quota) {
      throw new Error('LIMIT_REACHED_STORAGE');
    }

    // Password preparation
    let password = null;
    let salt = null;
    if (folder.isProtected) {
      password = this.sessionPasswords.get(targetFolderId);
      if (!password) throw new Error('Password not available');
      salt = base64ToUint8Array(folder.salt);
    }

    // Process file in chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);

      let processedChunk = chunkBlob;

      if (folder.isProtected) {
        // We treat each chunk as a standalone encrypted message
        // This is slightly inefficient (IV per chunk) but simple and robust
        processedChunk = await encryptFile(chunkBlob, password, salt);
      }

      await dbInstance.addFileChunk({
        fileId: fileId,
        chunkIndex: i,
        data: processedChunk
      });
    }

    // Save metadata
    const fileData = {
      id: fileId,
      filename: file.name,
      originalType: file.type,
      size: file.size, // Original size
      folderId: targetFolderId,
      uploadDate: new Date().toISOString(),
      isEncrypted: folder.isProtected,
      chunkCount: totalChunks,
      // No 'blob' field anymore - data is in file_chunks
    };

    await dbInstance.addFile(fileData);
    return fileData;
  }

  /**
   * Get files in a folder
   */
  async getFiles(folderId = null) {
    const targetFolderId = folderId || this.currentFolder?.id || 'default';
    const files = await dbInstance.getFilesByFolder(targetFolderId);

    // Return metadata only (no blob data)
    return files.map(file => ({
      id: file.id,
      filename: file.filename,
      originalType: file.originalType,
      size: file.size,
      folderId: file.folderId,
      uploadDate: file.uploadDate,
      isEncrypted: file.isEncrypted
    }));
  }

  /**
   * Download a file (Assembler)
   */
  async downloadFile(fileId) {
    const fileData = await dbInstance.getFile(fileId);
    if (!fileData) {
      throw new Error('File not found');
    }

    const folder = await dbInstance.getFolder(fileData.folderId);
    const chunks = await dbInstance.getFileChunks(fileId);

    if (!chunks || chunks.length === 0) {
      // Fallback for legacy v1 files (if any exist and migration skipped)
      if (fileData.blob) {
        let blob = fileData.blob;
        if (fileData.isEncrypted && folder.isProtected) {
          const password = this.sessionPasswords.get(fileData.folderId);
          if (!password) throw new Error('Password not available');
          const salt = base64ToUint8Array(folder.salt);
          blob = await decryptFile(blob, password, salt, fileData.originalType);
        }
        return { blob, filename: fileData.filename, type: fileData.originalType };
      }
      throw new Error('File content missing');
    }

    // Process chunks
    const decryptedParts = [];

    for (const chunk of chunks) {
      let part = chunk.data;

      if (fileData.isEncrypted && folder.isProtected) {
        const password = this.sessionPasswords.get(fileData.folderId);
        if (!password) {
          throw new Error('Password not available for encrypted file');
        }
        const salt = base64ToUint8Array(folder.salt);

        // Decrypt chunk - we don't know the exact type of the chunk, but it doesn't matter for assembly
        // The Original Type is applied to the final Blob
        part = await decryptFile(part, password, salt, 'application/octet-stream');
      }
      decryptedParts.push(part);
    }

    const finalBlob = new Blob(decryptedParts, { type: fileData.originalType });

    return {
      blob: finalBlob,
      filename: fileData.filename,
      type: fileData.originalType
    };
  }

  /**
   * Rename a file
   */
  async renameFile(fileId, newName) {
    if (!newName || newName.trim() === '') {
      throw new Error('Filename cannot be empty');
    }

    const fileData = await dbInstance.getFile(fileId);
    if (!fileData) {
      throw new Error('File not found');
    }

    fileData.filename = newName.trim();
    await dbInstance.updateFile(fileData);

    return fileData;
  }

  /**
   * Rename a folder
   */
  async renameFolder(folderId, newName) {
    if (folderId === 'default') {
      throw new Error('Cannot rename the default folder');
    }

    const name = newName?.trim();
    if (!name) {
      throw new Error('Folder name cannot be empty');
    }

    const folders = await dbInstance.getAllFolders();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) {
      throw new Error('Folder not found');
    }

    // Check for duplicate name (excluding itself)
    if (folders.some(f => f.name === name && f.id !== folderId)) {
      throw new Error('Folder with this name already exists');
    }

    folder.name = name;
    await dbInstance.updateFolder(folder);

    // If it's the current folder, update it
    if (this.currentFolder?.id === folderId) {
      this.currentFolder = folder;
    }

    return folder;
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId) {
    const fileData = await dbInstance.getFile(fileId);
    if (!fileData) {
      // If metadata missing, still try to cleanup chunks to prevent orphans
      await dbInstance.deleteChunksByFile(fileId);
      return;
    }

    await dbInstance.deleteChunksByFile(fileId);
    await dbInstance.deleteFile(fileId);
  }

  /**
   * Lock a folder (remove from unlocked set)
   */
  lockFolder(folderId) {
    this.unlockedFolders.delete(folderId);
    this.sessionPasswords.delete(folderId);
    this.saveSessionState().catch(() => { });
  }

  /**
   * Lock all folders
   */
  lockAllFolders() {
    this.unlockedFolders.clear();
    this.sessionPasswords.clear();
    this.saveSessionState().catch(() => { });
    this.currentFolder = null;
  }

  /**
   * Reset entire vault (delete all data)
   */
  async resetVault() {
    await dbInstance.clearAll();
    this.unlockedFolders.clear();
    this.sessionPasswords.clear();
    this.clearSessionState().catch(() => { });
    this.currentFolder = null;
    await this.ensureDefaultFolder();
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const folders = await dbInstance.getAllFolders();
    const allFiles = [];

    for (const folder of folders) {
      const files = await dbInstance.getFilesByFolder(folder.id);
      allFiles.push(...files);
    }

    const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);
    const totalFiles = allFiles.length;

    return {
      totalFiles,
      totalSize,
      folderCount: folders.length,
      protectedFolders: folders.filter(f => f.isProtected).length
    };
  }

  /**
   * Get storage usage percentage
   */
  async getStorageUsage() {
    try {
      const stats = await this.getStorageStats();
      let quota = 0;
      let quotaFormatted = 'Unknown';

      // Try to get actual quota from browser
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        quota = estimate.quota;
        quotaFormatted = this.formatBytes(quota);
      }

      // Fallback if estimate failed or returned 0 (unlikely with permissions)
      if (!quota) {
        // Fallback to 1 TB (functionally unlimited for this use case)
        quota = 1024 * 1024 * 1024 * 1024;
        quotaFormatted = 'Unlimited';
      }

      const usagePercentage = (stats.totalSize / quota) * 100;

      return {
        usage: stats.totalSize,
        quota: quota,
        usagePercentage: usagePercentage,
        usageFormatted: this.formatBytes(stats.totalSize),
        quotaFormatted: quotaFormatted,
        fallback: false
      };
    } catch (_error) {
      console.error('Failed to get storage usage:', _error);
      return {
        usage: 0,
        quota: 1,
        usagePercentage: 0,
        usageFormatted: '0 B',
        quotaFormatted: 'Unknown',
        error: true
      };
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get metadata value by key
   */
  async getMetadata(key) {
    return await dbInstance.getMetadata(key);
  }

  /**
   * Set metadata value by key
   */
  async setMetadata(key, value) {
    return await dbInstance.setMetadata(key, value);
  }

  // Session State Management

  async saveSessionState() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    // Check auto-lock setting
    const autoLock = await this.getMetadata('setting_autoLock');
    // Default is true (auto-lock on close enabled)
    const shouldAutoLock = autoLock !== false;

    const state = {
      unlockedFolders: Array.from(this.unlockedFolders),
      sessionPasswords: Object.fromEntries(this.sessionPasswords)
    };

    // Wrap in object to match expected format
    const storageObj = { 'docsafe_session_state': state };

    if (shouldAutoLock) {
      // Auto-lock on extension close: Do NOT persist state.
      // Clear both session and local storage to ensure no persistence.
      // State remains in memory (this.unlockedFolders) until the background/popup context is unloaded.
      if (chrome.storage.session) {
        await chrome.storage.session.remove('docsafe_session_state');
      }
      await chrome.storage.local.remove('docsafe_session_state');
    } else {
      // Save to LOCAL storage (persists forever)
      await chrome.storage.local.set(storageObj);
      // Clean from session to avoid confusion
      if (chrome.storage.session) {
        await chrome.storage.session.remove('docsafe_session_state');
      }
    }
  }

  async loadSessionState() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    try {
      // Try LOCAL first (persistent state)
      let result = await chrome.storage.local.get('docsafe_session_state');
      let state = result.docsafe_session_state;

      // If nothing in local, try SESSION
      if (!state && chrome.storage.session) {
        result = await chrome.storage.session.get('docsafe_session_state');
        state = result.docsafe_session_state;
      }

      if (state) {
        if (state.unlockedFolders) {
          this.unlockedFolders = new Set(state.unlockedFolders);
        }

        if (state.sessionPasswords) {
          this.sessionPasswords = new Map(Object.entries(state.sessionPasswords));
        }
      }
    } catch (_error) {
      // Failed to load session state
    }
  }

  async handleStorageChange(_newValue) {
    // Re-save state according to new setting
    await this.saveSessionState();
  }

  async clearSessionState() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.session) return;
    await chrome.storage.session.remove('docsafe_session_state');
  }
}

// Singleton instance
const app = new LocalFileVaultApp();

export default app;
