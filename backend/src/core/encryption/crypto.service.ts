/**
 * Crypto Service — Token Encryption
 * 
 * Encrypts sensitive data like OAuth tokens at rest using AES-256-GCM.
 * Uses a dedicated encryption key from environment variables.
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Derive encryption key from environment variable
function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required for token encryption');
  }
  
  // If key is hex-encoded, decode it
  if (encryptionKey.match(/^[0-9a-f]{64}$/i)) {
    return Buffer.from(encryptionKey, 'hex');
  }
  
  // Otherwise, derive key from passphrase using PBKDF2
  const salt = Buffer.from('leadcrm-token-encryption-salt', 'utf8');
  return crypto.pbkdf2Sync(encryptionKey, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt sensitive text (OAuth tokens, etc.)
 * Returns format: iv:tag:encrypted_data (all base64-encoded)
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty token');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from('leadcrm-oauth-token', 'utf8'));
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const tag = cipher.getAuthTag();
  
  // Format: iv:tag:encrypted_data
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted,
  ].join(':');
}

/**
 * Decrypt sensitive text
 * Expects format: iv:tag:encrypted_data (all base64-encoded)
 */
export function decryptToken(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty data');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivB64, tagB64, encryptedB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from('leadcrm-oauth-token', 'utf8'));
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedB64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a secure encryption key (for initial setup)
 * Run this once and store the result in ENCRYPTION_KEY env var
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}