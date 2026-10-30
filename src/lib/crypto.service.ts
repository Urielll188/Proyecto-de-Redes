import 'server-only'; // Previene fugas accidentales hacia componentes de cliente
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getSecretKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'CONFIG ERROR: TOKEN_ENCRYPTION_KEY no está configurada o no tiene 64 caracteres hexadecimales (32 bytes).'
    );
  }
  
  return Buffer.from(keyHex, 'hex');
}

export interface EncryptedPayload {
  encryptedText: string;
  tokenIv: string;
  tokenAuthTag: string;
}

export function encryptToken(plainText: string): EncryptedPayload {
  const key = getSecretKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encryptedText = cipher.update(plainText, 'utf8', 'hex');
  encryptedText += cipher.final('hex');
  
  const tokenAuthTag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedText,
    tokenIv: iv.toString('hex'),
    tokenAuthTag,
  };
}

export function decryptToken(encryptedText: string, ivHex: string, authTagHex: string): string {
  const key = getSecretKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
