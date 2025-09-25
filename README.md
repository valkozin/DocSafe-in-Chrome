# DocSafe - Secure Document Vault Chrome Extension

DocSafe is a powerful Chrome extension that provides secure, encrypted document storage directly in your browser. With support for password-protected folders, AES-GCM encryption, and intuitive file management, DocSafe ensures your sensitive documents remain private and accessible only to you.

## 🔐 Key Features

- **🛡️ Strong Encryption**: AES-GCM encryption with PBKDF2 key derivation
- **📁 Folder Organization**: Create unlimited folders with optional password protection
- **📤 Drag & Drop Upload**: Intuitive file upload with drag-and-drop support
- **🔒 Password Protection**: Individual folder-level encryption with secure password hashing
- **📱 All File Types**: Support for any file type - documents, images, videos, archives
- **🔄 File Management**: Rename, delete, and download files with ease
- **💾 Local Storage**: 100% local storage using IndexedDB - no cloud dependency
- **🎨 Modern UI**: Clean, intuitive interface with Material Design icons
- **⚙️ Settings Page**: Comprehensive settings and vault management

## 🚀 Installation

### Development Installation

1. **Clone or download** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** by toggling the switch in the top right
4. **Click "Load unpacked"** and select the extension folder
5. The DocSafe extension will appear in your extensions toolbar

### Production Installation

1. **Package the extension** by running `npm run package`
2. **Upload to Chrome Web Store** (for distribution) or
3. **Load the packaged ZIP** file as an unpacked extension

## 📖 Usage Guide

### Getting Started

1. **Click the DocSafe icon** in your Chrome toolbar to open the popup
2. **Default folder**: A "General" folder is created automatically for unprotected files
3. **Upload files**: Drag and drop files or click the upload area to browse

### Creating Folders

1. **Click the "+" button** next to "Folders" in the sidebar
2. **Enter folder name** and optionally check "Password protect this folder"
3. **Set password**: If protecting, enter and confirm your password
4. **Create**: Your folder will appear in the sidebar

### Uploading Files

1. **Select a folder** from the sidebar (unlock if password-protected)
2. **Drag and drop files** into the upload area, or
3. **Click the upload area** to browse and select files
4. Files are automatically encrypted if uploaded to a protected folder

### Managing Files

- **Download**: Click the download icon next to any file
- **Rename**: Click the edit icon to rename files
- **Delete**: Click the delete icon to remove files permanently

### Password-Protected Folders

1. **Create** a password-protected folder (see above)
2. **Access**: Click the folder to be prompted for the password
3. **Unlock**: Enter the correct password to access encrypted files
4. **Lock**: Use the lock button in the header to lock all folders

### Settings & Options

1. **Click the settings icon** in the popup header, or
2. **Right-click the extension icon** and select "Options"
3. **Available options**:
   - View storage statistics
   - Configure auto-lock settings
   - Export/import vault settings
   - Reset vault (⚠️ permanently deletes all data)

## 🔧 Technical Details

### Security Implementation

- **Encryption**: AES-GCM with 256-bit keys
- **Key Derivation**: PBKDF2 with 100,000 iterations and SHA-256
- **Password Storage**: Only salted hashes stored, never plain text passwords
- **Session Management**: Passwords cached in memory only during session

### Storage

- **Database**: IndexedDB for local file storage
- **Capacity**: Limited by browser storage quotas (typically several GB)
- **Data Structure**: Separate stores for files, folders, and metadata

### Browser Compatibility

- **Chrome**: Version 88+ (Manifest V3 support)
- **Edge**: Chromium-based versions
- **Other browsers**: May work with minor modifications

## 🧪 Development & Testing

### Prerequisites

```bash
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Building

```bash
# Prepare for distribution
npm run package
```

## 📁 Project Structure

```
docsafe-chrome-extension/
├── manifest.json           # Extension manifest
├── popup.html             # Main popup interface
├── options.html           # Settings page
├── background.js          # Service worker
├── src/                   # Source code
│   ├── app.js            # Main application logic
│   ├── db.js             # IndexedDB interface
│   ├── crypto.js         # Encryption utilities
│   ├── popup.js          # Popup UI logic
│   └── options.js        # Options page logic
├── css/                   # Stylesheets
│   ├── popup.css         # Popup styles
│   └── options.css       # Options page styles
├── icons/                 # Extension icons
├── tests/                 # Test suite
│   ├── setup.js          # Test configuration
│   ├── crypto.test.js    # Crypto function tests
│   ├── db.test.js        # Database tests
│   ├── app.test.js       # Application logic tests
│   └── integration.test.js # End-to-end tests
└── package.json          # Dependencies and scripts
```

## ⚠️ Security Considerations

### Important Notes

- **Passwords**: Never forget your folder passwords - they cannot be recovered
- **Backups**: Regularly export your vault settings (files are not included)
- **Local Storage**: All data is stored locally; browser data clearing will delete everything
- **Session Security**: Lock folders when not in use, especially on shared computers

### Best Practices

1. **Use strong passwords** for protected folders
2. **Don't share passwords** with unauthorized users
3. **Regular backups** of important files outside the extension
4. **Lock folders** after use for maximum security
5. **Keep Chrome updated** for latest security patches

## 🐛 Troubleshooting

### Common Issues

**Extension not loading**
- Ensure Developer mode is enabled
- Check for console errors in extension management page

**Files not uploading**
- Check available storage quota in Chrome settings
- Verify file isn't corrupted or too large

**Can't unlock protected folder**
- Ensure password is entered correctly (case-sensitive)
- Try refreshing the extension popup

**Missing files after browser restart**
- Check if browser data was cleared
- Verify extension is still installed and enabled

### Storage Limitations

- **Browser quota**: Typically 10% of available disk space
- **Individual files**: No specific limit, but large files may affect performance
- **Total files**: No hard limit, depends on available storage

## 🤝 Contributing

We welcome contributions! Please:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Write tests** for new functionality
4. **Ensure all tests pass**: `npm test`
5. **Submit a pull request**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Material Icons** for the beautiful icon set
- **IndexedDB** for reliable local storage
- **WebCrypto API** for secure encryption
- **Chrome Extension APIs** for seamless browser integration

## 📞 Support

For issues, questions, or feature requests:

1. **Check the troubleshooting section** above
2. **Search existing issues** in the repository
3. **Create a new issue** with detailed description
4. **Include browser version** and error messages if applicable

---

**🔒 Keep your documents safe with DocSafe!**
