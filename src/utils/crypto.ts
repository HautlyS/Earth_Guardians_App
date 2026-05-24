/**
 * Earth Guardians App - Crypto Utilities
 */

// ============================================================
// UUID GENERATION
// ============================================================

export function generateUUID(): string {
  return crypto.randomUUID();
}

// Fallback for environments without crypto.randomUUID
export function generateUUIDFallback(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================
// BASE64 UTILITIES
// ============================================================

export function arrayToBase64(array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

export function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function stringToBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export function base64ToString(base64: string): string {
  return decodeURIComponent(escape(atob(base64)));
}

// ============================================================
// HASHING
// ============================================================

export async function sha256(data: string | Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = data instanceof Uint8Array ? data : encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return arrayToBase64(new Uint8Array(hashBuffer));
}

export async function sha512(data: string | Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = data instanceof Uint8Array ? data : encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
  return arrayToBase64(new Uint8Array(hashBuffer));
}

// ============================================================
// KEY GENERATION
// ============================================================

export async function generateRandomBytes(length: number): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(length));
}

export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-384' },
    true,
    ['deriveBits']
  );
}

// ============================================================
// ENCRYPTION HELPERS
// ============================================================

export async function encryptString(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    data
  );

  return {
    ciphertext: arrayToBase64(new Uint8Array(ciphertext)),
    iv: arrayToBase64(iv),
  };
}

export async function decryptString(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const ciphertextArray = base64ToArray(ciphertext);
  const ivArray = base64ToArray(iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArray, tagLength: 128 },
    key,
    ciphertextArray
  );

  return new TextDecoder().decode(decrypted);
}

// ============================================================
// COMPRESSION (Simple LZ77)
// ============================================================

export function compress(data: Uint8Array): Uint8Array {
  const output: number[] = [];
  let i = 0;

  while (i < data.length) {
    let longestMatch = -1;
    let matchLength = 0;
    let matchPosition = 0;

    const windowStart = Math.max(0, i - 4096);
    const window = data.slice(windowStart, i);
    const remaining = data.slice(i, i + 258);

    for (let j = 0; j < window.length; j++) {
      let matchLen = 0;
      while (matchLen < remaining.length && window[j + matchLen] === remaining[matchLen]) {
        matchLen++;
        if (j + matchLen >= window.length) break;
      }

      if (matchLen > matchLength) {
        longestMatch = windowStart + j;
        matchLength = matchLen;
        matchPosition = i - longestMatch;
      }
    }

    if (matchLength > 3) {
      output.push(0x80 | Math.min(matchLength - 4, 127));
      output.push(matchPosition >> 8);
      output.push(matchPosition & 0xFF);
      i += matchLength;
    } else {
      output.push(data[i]);
      i++;
    }
  }

  return new Uint8Array(output);
}

export function decompress(data: Uint8Array): Uint8Array {
  const output: number[] = [];
  let i = 0;

  while (i < data.length) {
    const byte = data[i];

    if (byte < 0x80) {
      output.push(byte);
      i++;
    } else {
      const length = (byte & 0x7F) + 4;
      i++;
      if (i + 1 >= data.length) break;
      const position = (data[i] << 8) | data[i + 1];
      i += 2;

      for (let j = 0; j < length; j++) {
        output.push(output[output.length - position] || 0);
      }
    }
  }

  return new Uint8Array(output);
}

// ============================================================
// FILE UTILITIES
// ============================================================

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  const mimeTypes: Record<string, string> = {
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    // Archives
    zip: 'application/zip',
    '7z': 'application/x-7z-compressed',
    rar: 'application/x-rar-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================================
// DATE UTILITIES
// ============================================================

export function formatDate(date: Date | string, format: 'short' | 'long' | 'time' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  switch (format) {
    case 'long':
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'time':
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    default:
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
  }
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
}

// ============================================================
// DEBOUNCE & THROTTLE
// ============================================================

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================================
// VALIDATION
// ============================================================

export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

export function isValidPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// STORAGE HELPERS
// ============================================================

export const localStorage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch {
      return defaultValue || null;
    }
  },
  
  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  },
  
  remove(key: string): void {
    window.localStorage.removeItem(key);
  },
  
  clear(): void {
    window.localStorage.clear();
  },
};

export const sessionStorage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch {
      return defaultValue || null;
    }
  },
  
  set<T>(key: string, value: T): void {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to save to sessionStorage:', e);
    }
  },
  
  remove(key: string): void {
    window.sessionStorage.removeItem(key);
  },
};

// ============================================================
// EXPORTS
// ============================================================

export default {
  generateUUID,
  generateUUIDFallback,
  arrayToBase64,
  base64ToArray,
  stringToBase64,
  base64ToString,
  sha256,
  sha512,
  generateRandomBytes,
  generateAESKey,
  generateECDHKeyPair,
  encryptString,
  decryptString,
  compress,
  decompress,
  formatFileSize,
  getFileExtension,
  getMimeType,
  formatDate,
  timeAgo,
  debounce,
  throttle,
  isValidEmail,
  isValidUsername,
  isValidPassword,
  localStorage,
  sessionStorage,
};