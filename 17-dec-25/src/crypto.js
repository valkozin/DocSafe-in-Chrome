/**
 * Cryptographic utilities for DocSafe
 * Uses WebCrypto API for AES-GCM encryption and PBKDF2 key derivation
 */

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 600_000;

/**
 * Generate a random salt
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a random IV for AES-GCM
 */
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Derive a key from password using PBKDF2
 */
export async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Hash password with salt for storage
 */
export async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    importedKey,
    KEY_LENGTH
  );

  return new Uint8Array(derivedBits);
}

/**
 * Verify password against stored hash
 */
export async function verifyPassword(password, salt, storedHash) {
  const computedHash = await hashPassword(password, salt);

  if (computedHash.length !== storedHash.length) {
    return false;
  }

  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash[i] ^ storedHash[i];
  }

  return result === 0;
}

/**
 * Encrypt data using AES-GCM
 */
export async function encryptData(data, password, salt) {
  const key = await deriveKey(password, salt);
  const iv = generateIV();

  let dataBuffer;
  if (data instanceof Blob) {
    dataBuffer = await data.arrayBuffer();
  } else if (typeof data === 'string') {
    const encoder = new TextEncoder();
    dataBuffer = encoder.encode(data);
  } else if (data instanceof ArrayBuffer) {
    dataBuffer = data;
  } else {
    throw new Error('Unsupported data type for encryption');
  }

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    dataBuffer
  );

  // Combine IV and encrypted data
  const result = new Uint8Array(IV_LENGTH + encryptedData.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encryptedData), IV_LENGTH);

  return result;
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(encryptedData, password, salt) {
  const key = await deriveKey(password, salt);

  // Extract IV and encrypted data
  const iv = encryptedData.slice(0, IV_LENGTH);
  const data = encryptedData.slice(IV_LENGTH);

  try {
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );

    return decryptedData;
  } catch (error) {
    throw new Error('Decryption failed - invalid password or corrupted data');
  }
}

/**
 * Encrypt a file blob
 */
export async function encryptFile(file, password, salt) {
  const encryptedData = await encryptData(file, password, salt);
  return new Blob([encryptedData], { type: 'application/octet-stream' });
}

/**
 * Decrypt a file blob
 */
export async function decryptFile(encryptedBlob, password, salt, originalType) {
  const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();
  const encryptedData = new Uint8Array(encryptedArrayBuffer);

  const decryptedArrayBuffer = await decryptData(encryptedData, password, salt);
  return new Blob([decryptedArrayBuffer], { type: originalType });
}

/**
 * Convert ArrayBuffer to base64 string for storage
 */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(uint8Array) {
  return arrayBufferToBase64(uint8Array.buffer);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64) {
  return new Uint8Array(base64ToArrayBuffer(base64));
}
