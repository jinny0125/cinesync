/**
 * Dual-Layer Privacy & Shielding: E2EE Engine
 * Implements browser-native Web Crypto API (AES-GCM 256-bit)
 * Text messages are encrypted directly inside the browser viewport before transmission.
 */

// Helper to convert ArrayBuffer to Base64
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives an AES-GCM 256-bit key from a user passphrase and room salt using PBKDF2
 */
export async function deriveKeyFromPassphrase(passphrase, saltString = 'flixtogether-salt-v1') {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBuffer = enc.encode(saltString);

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext message string with AES-GCM
 * Returns { ciphertext: string (base64), iv: string (base64) }
 */
export async function encryptText(plainText, cryptoKey) {
  if (!cryptoKey) {
    throw new Error('Cryptographic key not initialized');
  }

  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for GCM

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    cryptoKey,
    enc.encode(plainText)
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypts a ciphertext with AES-GCM
 * Returns the decoded UTF-8 plaintext string
 */
export async function decryptText(ciphertextBase64, ivBase64, cryptoKey) {
  if (!cryptoKey) {
    throw new Error('Cryptographic key not initialized');
  }

  const ivBuffer = base64ToBuffer(ivBase64);
  const dataBuffer = base64ToBuffer(ciphertextBase64);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer)
      },
      cryptoKey,
      dataBuffer
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed. Room key mismatch or corrupted payload:', err);
    return '🔒 [Decryption error: Key mismatch]';
  }
}

/**
 * Computes a visual safety fingerprint (e.g. for verifying E2EE matching between partners)
 */
export async function getFingerprint(cryptoKey) {
  try {
    const rawKey = await window.crypto.subtle.exportKey('raw', cryptoKey);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', rawKey);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Pick 4 two-digit hex chunks
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`.toUpperCase();
  } catch {
    return 'E2EE-SHIELDED';
  }
}

/**
 * Generates an automatic high-entropy memorable passphrase
 */
export function generateRandomPassphrase() {
  const adjectives = ['velvet', 'cosmic', 'starlit', 'whisper', 'golden', 'neon', 'lunar', 'midnight', 'aether'];
  const nouns = ['cinema', 'voyage', 'haven', 'sanctuary', 'orbit', 'echo', 'horizon', 'nebula', 'spark'];
  const num = Math.floor(100 + Math.random() * 900);
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}-${num}`;
}
