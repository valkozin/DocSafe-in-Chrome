/**
 * Main application logic for DocSafe
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

class DocSafeApp {
  constructor() {
    this.currentFolder = null;
    this.unlockedFolders = new Set();
    this.sessionPasswords = new Map(); // Store passwords for session
  }

  async init() {
    await dbInstance.init();
    await this.ensureDefaultFolder();
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
      await dbInstance.deleteFile(file.id);
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
   * Upload a file to the current folder
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

    const fileData = {
      id: this.generateId(),
      filename: file.name,
      originalType: file.type,
      size: file.size,
      folderId: targetFolderId,
      uploadDate: new Date().toISOString(),
      isEncrypted: folder.isProtected
    };

    let fileBlob = file;
    
    if (folder.isProtected) {
      const password = this.sessionPasswords.get(targetFolderId);
      if (!password) {
        throw new Error('Password not available for encrypted folder');
      }
      
      const salt = base64ToUint8Array(folder.salt);
      fileBlob = await encryptFile(file, password, salt);
    }

    fileData.blob = fileBlob;
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
   * Download a file
   */
  async downloadFile(fileId) {
    const fileData = await dbInstance.getFile(fileId);
    if (!fileData) {
      throw new Error('File not found');
    }

    const folder = await dbInstance.getFolder(fileData.folderId);
    let fileBlob = fileData.blob;

    if (fileData.isEncrypted && folder.isProtected) {
      const password = this.sessionPasswords.get(fileData.folderId);
      if (!password) {
        throw new Error('Password not available for encrypted file');
      }

      const salt = base64ToUint8Array(folder.salt);
      fileBlob = await decryptFile(fileData.blob, password, salt, fileData.originalType);
    }

    return {
      blob: fileBlob,
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
   * Delete a file
   */
  async deleteFile(fileId) {
    const fileData = await dbInstance.getFile(fileId);
    if (!fileData) {
      throw new Error('File not found');
    }

    await dbInstance.deleteFile(fileId);
  }

  /**
   * Lock a folder (remove from unlocked set)
   */
  lockFolder(folderId) {
    this.unlockedFolders.delete(folderId);
    this.sessionPasswords.delete(folderId);
  }

  /**
   * Lock all folders
   */
  lockAllFolders() {
    this.unlockedFolders.clear();
    this.sessionPasswords.clear();
    this.currentFolder = null;
  }

  /**
   * Reset entire vault (delete all data)
   */
  async resetVault() {
    await dbInstance.clearAll();
    this.unlockedFolders.clear();
    this.sessionPasswords.clear();
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
}

// Singleton instance
const app = new DocSafeApp();

export default app;
