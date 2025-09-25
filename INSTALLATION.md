# DocSafe Installation Guide

This guide will walk you through installing and setting up the DocSafe Chrome Extension.

## 📋 Prerequisites

- **Google Chrome** version 88 or higher
- **Developer mode** access (for unpacked installation)
- **Basic file management** knowledge

## 🔧 Installation Methods

### Method 1: Load Unpacked Extension (Development)

This method is perfect for trying out DocSafe or development purposes.

1. **Download the Extension**
   ```bash
   # Clone the repository
   git clone https://github.com/your-username/docsafe-chrome-extension.git
   
   # Or download and extract the ZIP file
   ```

2. **Open Chrome Extensions Page**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Or click the puzzle piece icon → "Manage extensions"

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner
   - New buttons will appear: "Load unpacked", "Pack extension", "Update"

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the DocSafe extension folder (the one containing `manifest.json`)
   - The extension will be loaded and appear in your extensions list

5. **Pin the Extension**
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "DocSafe" in the list
   - Click the pin icon to keep it visible in the toolbar

### Method 2: Install from Chrome Web Store (Future)

*Note: This extension is not yet published to the Chrome Web Store.*

1. Visit the Chrome Web Store
2. Search for "DocSafe Document Vault"
3. Click "Add to Chrome"
4. Confirm the installation

### Method 3: Install Packaged Extension

If you have a `.crx` file:

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"

2. **Install the Package**
   - Drag and drop the `.crx` file onto the extensions page
   - Or use "Load unpacked" and select the extracted folder

## ✅ Verification

After installation, verify DocSafe is working:

1. **Check Extension Icon**
   - Look for the DocSafe lock icon in your toolbar
   - If not visible, click the puzzle piece icon and pin it

2. **Open the Extension**
   - Click the DocSafe icon
   - You should see the main interface with a "General" folder

3. **Test Basic Functionality**
   - Try uploading a small text file
   - Create a new folder
   - Access the settings page

## 🎯 Initial Setup

### First Launch

1. **Click the DocSafe icon** in your toolbar
2. **Familiarize yourself** with the interface:
   - Left sidebar: Folder list
   - Center: File upload area and file list
   - Top: Settings and lock buttons

### Create Your First Protected Folder

1. **Click the "+" button** next to "Folders"
2. **Enter a folder name** (e.g., "Personal Documents")
3. **Check "Password protect this folder"**
4. **Enter a strong password** (remember this - it cannot be recovered!)
5. **Confirm the password**
6. **Click "Create"**

### Upload Your First File

1. **Select a folder** from the sidebar
2. **Drag and drop a file** into the upload area, or
3. **Click the upload area** to browse for files
4. **Wait for upload confirmation**

## ⚙️ Configuration

### Access Settings

1. **Click the settings icon** (gear) in the popup header
2. **Or right-click** the extension icon and select "Options"

### Recommended Settings

1. **Auto-lock folders**: Enable for better security
2. **Session timeout**: Set to 15 minutes for balance of security and convenience
3. **Review storage statistics**: Monitor your usage

## 🔒 Security Setup

### Password Best Practices

1. **Use strong passwords** for protected folders:
   - At least 12 characters
   - Mix of letters, numbers, and symbols
   - Unique for each folder

2. **Password Management**:
   - Use a password manager
   - Don't write passwords down in plain text
   - Don't share passwords

### Privacy Settings

1. **Lock folders** when not in use
2. **Set session timeout** to automatically lock folders
3. **Use protected folders** for sensitive documents
4. **Regular backups** of important files

## 🗂️ Organizing Your Vault

### Folder Structure Examples

**Personal Use:**
```
📁 General (unprotected)
📁 Work Documents (protected)
📁 Financial Records (protected)
📁 Personal Photos (protected)
📁 Quick Access (unprotected)
```

**Business Use:**
```
📁 Public Documents (unprotected)
📁 Client Files (protected)
📁 Contracts (protected)
📁 Internal Docs (protected)
📁 Archived Projects (protected)
```

### File Organization Tips

1. **Use descriptive filenames**
2. **Group related files** in appropriate folders
3. **Protect sensitive data** with password-protected folders
4. **Keep frequently accessed files** in easily accessible folders

## 🔧 Troubleshooting Installation

### Common Issues

**Extension doesn't appear after installation**
- Refresh the extensions page
- Check if Developer mode is enabled
- Restart Chrome

**Can't load unpacked extension**
- Verify the folder contains `manifest.json`
- Check for file permission issues
- Try a different folder location

**Extension icon is grayed out**
- The extension might be disabled
- Check Chrome extensions page
- Re-enable the extension

**Popup doesn't open**
- Check browser console for errors
- Try reloading the extension
- Restart Chrome

### File Permission Issues

On some systems, you might encounter permission issues:

**Windows:**
- Ensure the extension folder is not in a restricted location
- Try copying to your Desktop first

**macOS:**
- Grant Chrome permission to access files if prompted
- Check Security & Privacy settings

**Linux:**
- Ensure proper file permissions (`chmod 755`)
- Check if the folder is in a restricted directory

## 🔄 Updating the Extension

### For Unpacked Extensions

1. **Download the new version**
2. **Replace the old files** with new ones
3. **Go to extensions page** (`chrome://extensions/`)
4. **Click the refresh icon** on the DocSafe extension
5. **Verify the update** by checking the version number

### For Web Store Extensions

Updates will be automatic when published to the Chrome Web Store.

## 📊 System Requirements

### Minimum Requirements

- **Chrome**: Version 88+
- **RAM**: 2GB available memory
- **Storage**: 100MB available disk space
- **Permissions**: File system access for uploads/downloads

### Recommended Requirements

- **Chrome**: Latest version
- **RAM**: 4GB+ for better performance with large files
- **Storage**: 1GB+ for extensive document storage
- **Network**: Not required (works completely offline)

## 🚫 Uninstallation

If you need to remove DocSafe:

1. **Backup important files** first (download from the extension)
2. **Go to Chrome extensions** (`chrome://extensions/`)
3. **Find DocSafe** in the list
4. **Click "Remove"**
5. **Confirm removal**

**⚠️ Warning**: All stored files and folders will be permanently deleted upon uninstallation.

## 📞 Getting Help

If you encounter issues during installation:

1. **Check this guide** for common solutions
2. **Review the main README** for additional troubleshooting
3. **Check browser console** for error messages
4. **Create an issue** on GitHub with:
   - Chrome version
   - Operating system
   - Error messages
   - Steps to reproduce

## 🎉 Next Steps

After successful installation:

1. **Read the user guide** in the main README
2. **Explore the features** with test files
3. **Set up your folder structure**
4. **Configure security settings**
5. **Start organizing your documents securely**

Welcome to DocSafe - your documents are now secure! 🔒
