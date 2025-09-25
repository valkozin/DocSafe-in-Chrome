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
    const lockIcon = folder.isProtected ? (isUnlocked ? 'lock_open' : 'lock') : '';

    div.innerHTML = `
      <div class="folder-content">
        <span class="material-icons folder-icon">folder</span>
        <span class="folder-name">${this.escapeHtml(folder.name)}</span>
        ${lockIcon ? `<span class="material-icons lock-icon">${lockIcon}</span>` : ''}
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
        <span class="material-icons file-icon">${fileIcon}</span>
        <div class="file-details">
          <div class="file-name">${this.escapeHtml(file.filename)}</div>
          <div class="file-meta">${fileSize} • ${uploadDate}</div>
        </div>
        ${file.isEncrypted ? '<span class="material-icons encrypted-icon" title="Encrypted">lock</span>' : ''}
      </div>
      <div class="file-actions">
        <button class="icon-btn download-btn" title="Download">
          <span class="material-icons">download</span>
        </button>
        <button class="icon-btn rename-btn" title="Rename">
          <span class="material-icons">edit</span>
        </button>
        <button class="icon-btn delete-btn" title="Delete">
          <span class="material-icons">delete</span>
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
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'movie';
    if (mimeType.startsWith('audio/')) return 'music_note';
    if (mimeType.includes('pdf')) return 'picture_as_pdf';
    if (mimeType.includes('word')) return 'description';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'table_chart';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'slideshow';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
    return 'insert_drive_file';
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
    this.showProgress('Uploading files...');
    
    try {
      for (const file of files) {
        await app.uploadFile(file);
      }
      
      await this.loadFiles();
      this.showToast(`Successfully uploaded ${files.length} file(s)`, 'success');
    } catch (error) {
      this.showToast('Upload failed: ' + error.message, 'error');
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
      errorDiv.textContent = error.message;
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupUI());
} else {
  new PopupUI();
}
