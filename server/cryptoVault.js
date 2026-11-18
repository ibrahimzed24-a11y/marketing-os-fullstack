/**
 * Marketing OS — AES-256-GCM Vault Encryption Utility
 * Encrypts sensitive secrets (LLM API keys, tool credentials, vault secrets) at rest
 * using an externally managed VAULT_ENCRYPTION_KEY environment variable.
 *
 * Ciphertext format: enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */

const crypto = require('crypto');

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

let devWarned = false;

function isProductionEnv() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function getKeyBuffer() {
  const configured = (process.env.VAULT_ENCRYPTION_KEY || '').trim();
  if (isProductionEnv()) {
    if (!configured || configured.length < 32) {
      throw new Error(
        '[FATAL SECURITY] VAULT_ENCRYPTION_KEY (>= 32 chars) must be set in production for secret encryption.'
      );
    }
    return crypto.createHash('sha256').update(configured, 'utf8').digest();
  }

  if (!configured) {
    if (!devWarned) {
      console.warn('[SECURITY WARN] Using local development VAULT_ENCRYPTION_KEY fallback (blocked in production).');
      devWarned = true;
    }
    return crypto.createHash('sha256').update('local-dev-only-vault-key-not-for-production', 'utf8').digest();
  }

  return crypto.createHash('sha256').update(configured, 'utf8').digest();
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const str = String(plaintext);
  if (str.length === 0) return '';
  if (isEncrypted(str)) return str; // Idempotent: do not double-encrypt

  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(stored) {
  if (stored === null || stored === undefined) return stored;
  const str = String(stored);
  if (str.length === 0) return '';
  if (!isEncrypted(str)) {
    // Backward compatibility for legacy unencrypted dev rows
    return str;
  }

  const payload = str.slice(PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('[cryptoVault] Malformed encrypted secret payload');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const key = getKeyBuffer();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

module.exports = {
  PREFIX,
  isEncrypted,
  encryptSecret,
  decryptSecret
};
