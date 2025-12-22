/**
 * Popup UI logic for DocSafe
 */

import app from './app.js';

class PopupUI {
  constructor() {
    this.currentFileId = null;
    this.pendingFolderId = null;
    this.init();
  }

  async init() {
    try {
      await app.init();
      this.setupEventListeners();
      await this.loadFolders();
      await this.selectDefaultFolder();
      await this.updateStorageIndicator();
    } catch (error) {
      this.showToast('Failed to initialize app: ' + error.message, 'error');
    }
  }

  setupEventListeners() {
    // Header actions
    document.getElementById('optionsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    document.getElementById('lockAllBtn').addEventListener('click', () => {
      this.lockAllFolders();
    });

    // Folder management
    document.getElementById('addFolderBtn').addEventListener('click', () => {
      this.showNewFolderModal();
    });

    // File upload
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');

    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    // Drag and drop
    dropArea.addEventListener('dragover', (e) => this.handleDragOver(e));
    dropArea.addEventListener('drop', (e) => this.handleDrop(e));
    dropArea.addEventListener('dragenter', (e) => this.handleDragEnter(e));
    dropArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));

    // Folder deletion
    document.getElementById('deleteFolderBtn').addEventListener('click', () => {
      this.deleteCurrentFolder();
    });

    // Password modal
    document.getElementById('closePasswordModal').addEventListener('click', () => {
      this.hidePasswordModal();
    });
    document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
      this.hidePasswordModal();
    });
    document.getElementById('confirmPasswordBtn').addEventListener('click', () => {
      this.handlePasswordSubmit();
    });
    document.getElementById('passwordInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handlePasswordSubmit();
    });

    // New folder modal
    document.getElementById('closeNewFolderModal').addEventListener('click', () => {
      this.hideNewFolderModal();
    });
    document.getElementById('cancelNewFolderBtn').addEventListener('click', () => {
      this.hideNewFolderModal();
    });
    document.getElementById('createFolderBtn').addEventListener('click', () => {
      this.handleCreateFolder();
    });
    document.getElementById('protectFolderCheckbox').addEventListener('change', (e) => {
      this.togglePasswordSection(e.target.checked);
    });

    // Rename modal
    document.getElementById('closeRenameModal').addEventListener('click', () => {
      this.hideRenameModal();
    });
    document.getElementById('cancelRenameBtn').addEventListener('click', () => {
      this.hideRenameModal();
    });
    document.getElementById('confirmRenameBtn').addEventListener('click', () => {
      this.handleRename();
    });
    document.getElementById('newFilenameInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleRename();
    });

    // Storage indicator click
    document.getElementById('storageIndicator').addEventListener('click', () => {
      this.showStorageDetails();
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }

  async loadFolders() {
    try {
      const folders = await app.getFolders();
      const folderList = document.getElementById('folderList');
      folderList.innerHTML = '';

      folders.forEach(folder => {
        const folderElement = this.createFolderElement(folder);
        folderList.appendChild(folderElement);
      });
    } catch (error) {
      this.showToast('Failed to load folders: ' + error.message, 'error');
    }
  }

  createFolderElement(folder) {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.dataset.folderId = folder.id;

    const isUnlocked = app.isFolderUnlocked(folder.id);
    const lockIconClass = folder.isProtected ? (isUnlocked ? 'icon-lock-open' : 'icon-lock') : '';

    div.innerHTML = `
      <div class="folder-content">
        <span class="icon icon-folder folder-icon"></span>
        <span class="folder-name">${this.escapeHtml(folder.name)}</span>
        ${lockIconClass ? `<span class="icon ${lockIconClass} lock-icon"></span>` : ''}
      </div>
    `;

    div.addEventListener('click', () => this.selectFolder(folder.id));
    return div;
  }

  async selectFolder(folderId) {
    try {
      const folder = await app.setCurrentFolder(folderId);
      this.updateCurrentFolderDisplay(folder);
      await this.loadFiles();
      this.updateFolderSelection(folderId);
    } catch (error) {
      if (error.message === 'Folder is locked') {
        this.showPasswordModal(folderId);
      } else {
        this.showToast('Failed to select folder: ' + error.message, 'error');
      }
    }
  }

  async selectDefaultFolder() {
    try {
      await this.selectFolder('default');
    } catch (error) {
      // If default folder doesn't exist, try the first available folder
      const folders = await app.getFolders();
      if (folders.length > 0) {
        await this.selectFolder(folders[0].id);
      }
    }
  }

  updateCurrentFolderDisplay(folder) {
    document.getElementById('currentFolderName').textContent = folder.name;
    const deleteBtn = document.getElementById('deleteFolderBtn');
    deleteBtn.style.display = folder.id === 'default' ? 'none' : 'block';
  }

  updateFolderSelection(folderId) {
    document.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('active');
    });

    const selectedItem = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('active');
    }
  }

  async loadFiles() {
    try {
      const files = await app.getFiles();
      const fileList = document.getElementById('fileList');
      const emptyState = document.getElementById('emptyState');

      fileList.innerHTML = '';

      if (files.length === 0) {
        emptyState.style.display = 'flex';
        fileList.style.display = 'none';
      } else {
        emptyState.style.display = 'none';
        fileList.style.display = 'block';

        files.forEach(file => {
          const fileElement = this.createFileElement(file);
          fileList.appendChild(fileElement);
        });
      }
    } catch (error) {
      this.showToast('Failed to load files: ' + error.message, 'error');
    }
  }

  createFileElement(file) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.fileId = file.id;

    const fileIcon = this.getFileIcon(file.originalType);
    const fileSize = this.formatFileSize(file.size);
    const uploadDate = new Date(file.uploadDate).toLocaleDateString();

    div.innerHTML = `
      <div class="file-info">
        <span class="icon ${fileIcon} file-icon"></span>
        <div class="file-details">
          <div class="file-name">${this.escapeHtml(file.filename)}</div>
          <div class="file-meta">${fileSize} • ${uploadDate}</div>
        </div>
        ${file.isEncrypted ? '<span class="icon icon-lock encrypted-icon" title="Encrypted"></span>' : ''}
      </div>
      <div class="file-actions">
        <button class="icon-btn download-btn" title="Download">
          <span class="icon icon-download"></span>
        </button>
        <button class="icon-btn rename-btn" title="Rename">
          <span class="icon icon-edit"></span>
        </button>
        <button class="icon-btn delete-btn" title="Delete">
          <span class="icon icon-delete"></span>
        </button>
      </div>
    `;

    // Add event listeners
    div.querySelector('.download-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.downloadFile(file.id);
    });

    div.querySelector('.rename-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.showRenameModal(file.id, file.filename);
    });

    div.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteFile(file.id);
    });

    return div;
  }

  getFileIcon(mimeType) {
    // Return icon class names instead of Material Icons names
    if (mimeType.startsWith('image/')) return 'icon-file';
    if (mimeType.startsWith('video/')) return 'icon-file';
    if (mimeType.startsWith('audio/')) return 'icon-file';
    if (mimeType.includes('pdf')) return 'icon-file';
    if (mimeType.includes('word')) return 'icon-file';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'icon-file';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'icon-file';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'icon-file';
    return 'icon-file';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // File operations
  async handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      await this.uploadFiles(files);
    }
    event.target.value = ''; // Reset input
  }

  async uploadFiles(files) {
    this.showProgress('Uploading files... (Large files may take a moment)');

    try {
      const total = files.length;
      let count = 0;

      for (const file of files) {
        count++;
        this.showProgress(`Uploading file ${count} of ${total}: ${file.name}`);
        await app.uploadFile(file);
      }

      await this.loadFiles();
      await this.updateStorageIndicator();
      this.showToast(`Successfully uploaded ${files.length} file(s)`, 'success');
    } catch (error) {
      this.hideProgress();
      if (error.message && error.message.includes('LIMIT_REACHED_STORAGE')) {
        this.showToast('Storage limit reached! Please free up system space.', 'warning');
      } else {
        this.showToast('Upload failed: ' + error.message, 'error');
      }
    } finally {
      this.hideProgress();
    }
  }

  async downloadFile(fileId) {
    this.showProgress('Downloading file...');

    try {
      const { blob, filename } = await app.downloadFile(fileId);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast('File downloaded successfully', 'success');
    } catch (error) {
      this.showToast('Download failed: ' + error.message, 'error');
    } finally {
      this.hideProgress();
    }
  }

  async deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await app.deleteFile(fileId);
      await this.loadFiles();
      await this.updateStorageIndicator();
      this.showToast('File deleted successfully', 'success');
    } catch (error) {
      this.showToast('Delete failed: ' + error.message, 'error');
    }
  }

  // Drag and drop handlers
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  handleDragEnter(e) {
    e.preventDefault();
    document.getElementById('dropArea').classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.preventDefault();
    if (!e.relatedTarget || !document.getElementById('dropArea').contains(e.relatedTarget)) {
      document.getElementById('dropArea').classList.remove('drag-over');
    }
  }

  async handleDrop(e) {
    e.preventDefault();
    document.getElementById('dropArea').classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await this.uploadFiles(files);
    }
  }

  // Modal handlers
  showPasswordModal(folderId) {
    this.pendingFolderId = folderId;
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('passwordInput').focus();
    document.getElementById('passwordError').textContent = '';
  }

  hidePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('passwordInput').value = '';
    this.pendingFolderId = null;
  }

  async handlePasswordSubmit() {
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('passwordError');

    if (!password) {
      errorDiv.textContent = 'Please enter a password';
      return;
    }

    if (!this.pendingFolderId) {
      errorDiv.textContent = 'No folder selected';
      return;
    }

    // Store the folder ID before hiding modal (which clears pendingFolderId)
    const folderId = this.pendingFolderId;

    try {
      await app.unlockFolder(folderId, password);
      this.hidePasswordModal();
      await this.selectFolder(folderId);
      await this.loadFolders(); // Refresh folder list to update lock icons
      this.showToast('Folder unlocked successfully', 'success');
    } catch (error) {
      errorDiv.textContent = error.message;
    }
  }

  showNewFolderModal() {
    document.getElementById('newFolderModal').style.display = 'flex';
    document.getElementById('folderNameInput').focus();
    document.getElementById('newFolderError').textContent = '';
    document.getElementById('protectFolderCheckbox').checked = false;
    this.togglePasswordSection(false);
  }

  hideNewFolderModal() {
    document.getElementById('newFolderModal').style.display = 'none';
    document.getElementById('folderNameInput').value = '';
    document.getElementById('newFolderPassword').value = '';
    document.getElementById('confirmFolderPassword').value = '';
  }

  togglePasswordSection(show) {
    document.getElementById('passwordSection').style.display = show ? 'block' : 'none';
  }

  async handleCreateFolder() {
    const name = document.getElementById('folderNameInput').value.trim();
    const isProtected = document.getElementById('protectFolderCheckbox').checked;
    const password = document.getElementById('newFolderPassword').value;
    const confirmPassword = document.getElementById('confirmFolderPassword').value;
    const errorDiv = document.getElementById('newFolderError');

    if (!name) {
      errorDiv.textContent = 'Please enter a folder name';
      return;
    }

    if (isProtected) {
      if (!password) {
        errorDiv.textContent = 'Please enter a password';
        return;
      }
      if (password.length < 8) {
        errorDiv.textContent = 'Password must be at least 8 characters';
        return;
      }
      if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        return;
      }
    }

    try {
      await app.createFolder(name, isProtected ? password : null);
      this.hideNewFolderModal();
      await this.loadFolders();
      this.showToast('Folder created successfully', 'success');
    } catch (error) {
      if (error.message && error.message.includes('LIMIT_REACHED_PROTECTED_FOLDERS')) {
        this.showToast('Protected folder limit reached (Max 5)', 'warning');
        this.hideNewFolderModal();
      } else {
        this.showToast(error.message, 'error');
      }
    }
  }

  showRenameModal(fileId, currentName) {
    this.currentFileId = fileId;
    document.getElementById('renameModal').style.display = 'flex';
    const input = document.getElementById('newFilenameInput');
    input.value = currentName;
    input.focus();
    input.select();
    document.getElementById('renameError').textContent = '';
  }

  hideRenameModal() {
    document.getElementById('renameModal').style.display = 'none';
    document.getElementById('newFilenameInput').value = '';
    this.currentFileId = null;
  }

  async handleRename() {
    const newName = document.getElementById('newFilenameInput').value.trim();
    const errorDiv = document.getElementById('renameError');

    if (!newName) {
      errorDiv.textContent = 'Please enter a filename';
      return;
    }

    try {
      await app.renameFile(this.currentFileId, newName);
      this.hideRenameModal();
      await this.loadFiles();
      this.showToast('File renamed successfully', 'success');
    } catch (error) {
      errorDiv.textContent = error.message;
    }
  }

  async deleteCurrentFolder() {
    if (!app.currentFolder) return;

    const folderName = app.currentFolder.name;
    if (!confirm(`Are you sure you want to delete the folder "${folderName}" and all its files?`)) {
      return;
    }

    try {
      await app.deleteFolder(app.currentFolder.id);
      await this.loadFolders();
      await this.selectDefaultFolder();
      await this.updateStorageIndicator();
      this.showToast('Folder deleted successfully', 'success');
    } catch (error) {
      this.showToast('Delete failed: ' + error.message, 'error');
    }
  }

  lockAllFolders() {
    app.lockAllFolders();
    this.loadFolders();
    this.selectDefaultFolder();
    this.showToast('All folders locked', 'info');
  }

  // UI utilities
  showProgress(text) {
    document.getElementById('progressText').textContent = text;
    document.getElementById('progressIndicator').style.display = 'flex';
  }

  hideProgress() {
    document.getElementById('progressIndicator').style.display = 'none';
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    const container = document.getElementById('toastContainer');
    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Storage indicator methods
  async updateStorageIndicator() {
    try {
      const storageUsage = await app.getStorageUsage();
      const storageText = document.getElementById('storageText');
      const storageBar = document.getElementById('storageBar');

      if (storageUsage.error) {
        storageText.textContent = 'Storage info unavailable';
        storageBar.style.width = '0%';
        return;
      }

      const percentage = Math.min(storageUsage.usagePercentage, 100);
      const statusText = storageUsage.fallback
        ? `${storageUsage.usageFormatted} stored (estimated)`
        : `${percentage.toFixed(1)}% used (${storageUsage.usageFormatted} of ${storageUsage.quotaFormatted})`;

      storageText.textContent = statusText;
      storageBar.style.width = percentage + '%';

      // Update bar color based on usage
      storageBar.classList.remove('low', 'medium', 'high', 'critical');
      if (percentage < 50) {
        storageBar.classList.add('low');
      } else if (percentage < 75) {
        storageBar.classList.add('medium');
      } else if (percentage < 90) {
        storageBar.classList.add('high');
      } else {
        storageBar.classList.add('critical');
      }

    } catch (error) {
      // console.error('Error updating storage indicator:', error); // Removed console.error
      document.getElementById('storageText').textContent = 'Storage calculation failed';
    }
  }

  async showStorageDetails() {
    try {
      const [storageUsage, stats] = await Promise.all([
        app.getStorageUsage(),
        app.getStorageStats()
      ]);

      const details = storageUsage.fallback || storageUsage.error
        ? `Storage Details:

📁 Total Files: ${stats.totalFiles}
📂 Total Folders: ${stats.folderCount}
🔒 Protected Folders: ${stats.protectedFolders}
💾 Total Size: ${app.formatBytes(stats.totalSize)}

Note: Browser storage quota information is not available. The indicator shows your stored data only.`
        : `Storage Details:

📊 Usage: ${storageUsage.usagePercentage.toFixed(1)}% of available space
💾 Used: ${storageUsage.usageFormatted}
🗄️ Available: ${storageUsage.quotaFormatted}

📁 Your Files: ${stats.totalFiles} files
📂 Your Folders: ${stats.folderCount} folders
🔒 Protected Folders: ${stats.protectedFolders}
💾 Your Data: ${app.formatBytes(stats.totalSize)}`;

      alert(details);
    } catch (error) {
      // console.error('Error showing storage details:', error); // Removed console.error
      alert('Unable to load storage details at this time.');
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupUI());
} else {
  new PopupUI();
}
