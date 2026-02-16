/**
 * Zero-knowledge encryption utilities using Web Crypto API.
 * AES-256-GCM, PBKDF2 for key derivation.
 */

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const TAG_LENGTH = 128;

function b64Encode(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function b64Decode(str: string): ArrayBuffer {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH
  );
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function generateMasterKey(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function encryptMasterKey(
  masterKey: Uint8Array,
  password: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LENGTH },
    key,
    masterKey as BufferSource
  );

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return b64Encode(combined);
}

export async function decryptMasterKey(
  encryptedMasterKey: string,
  password: string
): Promise<Uint8Array> {
  const combined = new Uint8Array(b64Decode(encryptedMasterKey));
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LENGTH },
    key,
    ciphertext as BufferSource
  );
  return new Uint8Array(decrypted);
}

export async function generateFileKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return key;
}

export async function encryptFileKey(fileKey: CryptoKey, masterKey: Uint8Array): Promise<string> {
  const masterCryptoKey = await crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  );

  const rawKey = await crypto.subtle.exportKey('raw', fileKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LENGTH },
    masterCryptoKey,
    rawKey
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return b64Encode(combined);
}

export async function decryptFileKey(
  encryptedFileKey: string,
  masterKey: Uint8Array
): Promise<CryptoKey> {
  const masterCryptoKey = await crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  );

  const combined = new Uint8Array(b64Decode(encryptedFileKey));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LENGTH },
    masterCryptoKey,
    ciphertext as BufferSource
  );

  return crypto.subtle.importKey('raw', decrypted, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptFile(file: File, fileKey: CryptoKey): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LENGTH },
    fileKey,
    buffer
  );

  const combined = new Blob([iv, encrypted]);
  return combined;
}

export async function encryptFileKeyForShare(
  fileKey: CryptoKey,
  passwordOrToken: string
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passwordOrToken), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('share') as BufferSource, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const key = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt']);

  const rawKey = await crypto.subtle.exportKey('raw', fileKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LENGTH },
    key,
    rawKey
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return b64Encode(combined);
}

export async function decryptFileKeyFromShare(
  shareEncryptedFileKey: string,
  passwordOrToken: string
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passwordOrToken), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('share') as BufferSource, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const key = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt']);

  const combined = new Uint8Array(b64Decode(shareEncryptedFileKey));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LENGTH },
    key,
    ciphertext as BufferSource
  );
  return crypto.subtle.importKey('raw', decrypted, 'AES-GCM', false, ['decrypt', 'encrypt']);
}

export async function decryptFile(
  encryptedBlob: Blob,
  fileKey: CryptoKey
): Promise<Blob> {
  const buffer = await encryptedBlob.arrayBuffer();
  const iv = new Uint8Array(buffer).slice(0, IV_LENGTH);
  const ciphertext = buffer.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LENGTH },
    fileKey,
    ciphertext as BufferSource
  );
  return new Blob([decrypted]);
}
