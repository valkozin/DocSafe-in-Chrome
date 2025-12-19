/**
 * Background script for DocSafe Chrome Extension
 */

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {

  }
});


// Handle extension startup
chrome.runtime.onStartup.addListener(() => {

});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'openOptionsPage':
      chrome.runtime.openOptionsPage();
      break;
    default:

  }
});

