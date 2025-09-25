/**
 * Jest test setup file
 */

// Mock Chrome APIs globally
global.chrome = {
  runtime: {
    openOptionsPage: jest.fn(),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        callback({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      })
    }
  },
  action: {
    onClicked: {
      addListener: jest.fn()
    }
  }
};

// Mock IndexedDB
const mockIDBRequest = {
  onsuccess: null,
  onerror: null,
  result: null,
  error: null
};

const mockIDBObjectStore = {
  add: jest.fn(() => mockIDBRequest),
  get: jest.fn(() => mockIDBRequest),
  put: jest.fn(() => mockIDBRequest),
  delete: jest.fn(() => mockIDBRequest),
  getAll: jest.fn(() => mockIDBRequest),
  clear: jest.fn(() => mockIDBRequest),
  index: jest.fn(() => ({
    getAll: jest.fn(() => mockIDBRequest)
  })),
  createIndex: jest.fn()
};

const mockIDBTransaction = {
  objectStore: jest.fn(() => mockIDBObjectStore),
  onsuccess: null,
  onerror: null
};

const mockIDBDatabase = {
  transaction: jest.fn(() => mockIDBTransaction),
  close: jest.fn(),
  objectStoreNames: {
    contains: jest.fn(() => false)
  },
  createObjectStore: jest.fn(() => mockIDBObjectStore)
};

const mockIDBOpenRequest = {
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null,
  result: mockIDBDatabase,
  error: null
};

global.indexedDB = {
  open: jest.fn(() => mockIDBOpenRequest),
  deleteDatabase: jest.fn(() => mockIDBRequest)
};

// Mock WebCrypto API
global.crypto = {
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    importKey: jest.fn().mockResolvedValue({}),
    deriveKey: jest.fn().mockResolvedValue({}),
    deriveBits: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    exportKey: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
    decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(50))
  }
};

// Mock TextEncoder/TextDecoder
global.TextEncoder = class TextEncoder {
  encode(str) {
    return new Uint8Array(str.split('').map(char => char.charCodeAt(0)));
  }
};

global.TextDecoder = class TextDecoder {
  decode(buffer) {
    return String.fromCharCode(...new Uint8Array(buffer));
  }
};

// Mock Blob constructor
global.Blob = class Blob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((size, part) => {
      if (typeof part === 'string') return size + part.length;
      if (part instanceof ArrayBuffer) return size + part.byteLength;
      if (part instanceof Uint8Array) return size + part.length;
      return size;
    }, 0);
  }

  async arrayBuffer() {
    const totalSize = this.size;
    const buffer = new ArrayBuffer(totalSize);
    const view = new Uint8Array(buffer);
    let offset = 0;

    for (const part of this.parts) {
      if (typeof part === 'string') {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(part);
        view.set(encoded, offset);
        offset += encoded.length;
      } else if (part instanceof ArrayBuffer) {
        view.set(new Uint8Array(part), offset);
        offset += part.byteLength;
      } else if (part instanceof Uint8Array) {
        view.set(part, offset);
        offset += part.length;
      }
    }

    return buffer;
  }

  async text() {
    const buffer = await this.arrayBuffer();
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
  }
};

// Mock File constructor
global.File = class File extends global.Blob {
  constructor(parts, name, options = {}) {
    super(parts, options);
    this.name = name;
    this.lastModified = options.lastModified || Date.now();
  }
};

// Mock URL
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn()
};

// Mock FileReader
global.FileReader = class FileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
    this.error = null;
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
    this.onloadstart = null;
    this.onloadend = null;
    this.onprogress = null;
  }

  readAsArrayBuffer(blob) {
    setTimeout(async () => {
      try {
        this.readyState = 2;
        this.result = await blob.arrayBuffer();
        if (this.onload) this.onload({ target: this });
      } catch (error) {
        this.error = error;
        if (this.onerror) this.onerror({ target: this });
      }
    }, 0);
  }

  readAsText(blob) {
    setTimeout(async () => {
      try {
        this.readyState = 2;
        this.result = await blob.text();
        if (this.onload) this.onload({ target: this });
      } catch (error) {
        this.error = error;
        if (this.onerror) this.onerror({ target: this });
      }
    }, 0);
  }
};

// Mock atob/btoa for base64 operations
global.atob = jest.fn((str) => {
  try {
    return Buffer.from(str, 'base64').toString('binary');
  } catch (e) {
    throw new Error('Invalid base64 string');
  }
});

global.btoa = jest.fn((str) => {
  try {
    return Buffer.from(str, 'binary').toString('base64');
  } catch (e) {
    throw new Error('Invalid string');
  }
});

// Helper to trigger async IDB operations
global.triggerIDBSuccess = (result = null) => {
  setTimeout(() => {
    mockIDBRequest.result = result;
    if (mockIDBRequest.onsuccess) {
      mockIDBRequest.onsuccess();
    }
  }, 0);
};

global.triggerIDBError = (error = new Error('IDB Error')) => {
  setTimeout(() => {
    mockIDBRequest.error = error;
    if (mockIDBRequest.onerror) {
      mockIDBRequest.onerror();
    }
  }, 0);
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset IDB request state
  mockIDBRequest.result = null;
  mockIDBRequest.error = null;
  mockIDBRequest.onsuccess = null;
  mockIDBRequest.onerror = null;
  
  // Reset crypto mock implementations
  if (global.crypto && global.crypto.subtle) {
    if (global.crypto.subtle.encrypt && global.crypto.subtle.encrypt.mockResolvedValue) {
      global.crypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(100));
    }
    if (global.crypto.subtle.decrypt && global.crypto.subtle.decrypt.mockResolvedValue) {
      global.crypto.subtle.decrypt.mockResolvedValue(new ArrayBuffer(50));
    }
    if (global.crypto.subtle.exportKey && global.crypto.subtle.exportKey.mockResolvedValue) {
      global.crypto.subtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
    }
    if (global.crypto.subtle.deriveBits && global.crypto.subtle.deriveBits.mockResolvedValue) {
      global.crypto.subtle.deriveBits.mockResolvedValue(new ArrayBuffer(32));
    }
  }
});

// Cleanup after each test
afterEach(() => {
  // Clear any timers
  jest.clearAllTimers();
});

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  // Don't fail tests for expected rejections in error scenarios
});

// Console suppression for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};
