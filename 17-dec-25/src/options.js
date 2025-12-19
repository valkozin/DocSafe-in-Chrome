/**
 * Options page logic for DocSafe
 */

import app from './app.js';

class OptionsPage {
  constructor() {
    this.pendingAction = null;
    this.init();
  }

  async init() {
    try {
      await app.init();
      this.setupEventListeners();
      await this.loadSettings();
      await this.loadStorageStats();
    } catch (error) {
      this.showToast('Failed to initialize settings: ' + error.message, 'error');
    }
  }

  setupEventListeners() {
    // Storage stats
    document.getElementById('refreshStatsBtn').addEventListener('click', () => {
      this.loadStorageStats();
    });

    // Security settings
    document.getElementById('autoLockToggle').addEventListener('change', (e) => {
      this.saveSetting('autoLock', e.target.checked);
    });

    // Danger zone


    document.getElementById('resetVaultBtn').addEventListener('click', () => {
      this.showConfirmModal(
        'Reset Vault',
        'Are you sure you want to reset the vault? This will permanently delete all files, folders, and settings. This action cannot be undone.',
        () => this.resetVault()
      );
    });

    // Confirmation modal
    document.getElementById('closeConfirmModal').addEventListener('click', () => {
      this.hideConfirmModal();
    });

    document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
      this.hideConfirmModal();
    });

    document.getElementById('confirmActionBtn').addEventListener('click', () => {
      this.executeConfirmedAction();
    });

    // Close modal on backdrop click
    document.getElementById('confirmModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideConfirmModal();
      }
    });
  }

  async loadSettings() {
    try {
      // Load auto-lock setting
      const autoLock = await this.getSetting('autoLock', true);
      document.getElementById('autoLockToggle').checked = autoLock;
    } catch (error) {
      // Failed to load settings
    }
  }

  async loadStorageStats() {
    try {
      this.showProgress('Loading storage statistics...');

      const stats = await app.getStorageStats();

      document.getElementById('totalFiles').textContent = stats.totalFiles.toLocaleString();
      document.getElementById('totalSize').textContent = this.formatFileSize(stats.totalSize);
      document.getElementById('folderCount').textContent = stats.folderCount.toLocaleString();
      document.getElementById('protectedFolders').textContent = stats.protectedFolders.toLocaleString();
    } catch (error) {
      this.showToast('Failed to load storage stats: ' + error.message, 'error');
    } finally {
      this.hideProgress();
    }
  }

  async getSetting(key, defaultValue) {
    try {
      const value = await app.getMetadata(`setting_${key}`);
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      // Failed to get setting
      return defaultValue;
    }
  }

  async saveSetting(key, value) {
    try {
      await app.setMetadata(`setting_${key}`, value);
      this.showToast('Setting saved', 'success');
    } catch (error) {
      this.showToast('Failed to save setting: ' + error.message, 'error');
    }
  }





  async resetVault() {
    try {
      this.showProgress('Resetting vault...');

      await app.resetVault();
      await this.loadStorageStats();

      this.showToast('Vault reset successfully', 'success');
    } catch (error) {
      this.showToast('Reset failed: ' + error.message, 'error');
    } finally {
      this.hideProgress();
    }
  }

  showConfirmModal(title, message, action) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').style.display = 'flex';
    this.pendingAction = action;
  }

  hideConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    this.pendingAction = null;
  }

  executeConfirmedAction() {
    if (this.pendingAction && typeof this.pendingAction === 'function') {
      const action = this.pendingAction;
      this.hideConfirmModal();
      action();
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

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
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new OptionsPage());
} else {
  new OptionsPage();
}
