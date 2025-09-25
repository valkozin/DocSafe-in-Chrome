/**
 * Background script for DocSafe Chrome Extension
 */

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('DocSafe extension installed');
    // Set default settings
    chrome.storage.local.set({
      'setting_autoLock': true,
      'setting_sessionTimeout': 15
    });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('DocSafe extension started');
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'openOptionsPage':
      chrome.runtime.openOptionsPage();
      break;
    default:
      console.log('Unknown message:', request);
  }
});

// Auto-lock functionality (if enabled)
let lockTimer = null;

function startLockTimer() {
  chrome.storage.local.get(['setting_sessionTimeout'], (result) => {
    const timeout = result.setting_sessionTimeout || 15;
    
    if (timeout > 0) {
      if (lockTimer) {
        clearTimeout(lockTimer);
      }
      
      lockTimer = setTimeout(() => {
        // Send message to popup to lock all folders
        chrome.runtime.sendMessage({ action: 'autoLock' });
      }, timeout * 60 * 1000); // Convert minutes to milliseconds
    }
  });
}

function resetLockTimer() {
  if (lockTimer) {
    clearTimeout(lockTimer);
    startLockTimer();
  }
}

// Monitor user activity
chrome.action.onClicked.addListener(() => {
  resetLockTimer();
});

// Start the lock timer when the extension starts
startLockTimer();
