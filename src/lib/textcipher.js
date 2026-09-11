import { scryptAsync } from '@noble/hashes/scrypt.js';
import { gcm } from '@noble/ciphers/aes.js';
import { utf8ToBytes, randomBytes, concatBytes } from '@noble/hashes/utils.js';
import { base64 } from '@scure/base';

// Same KDF params and blob layout (salt || nonce || ciphertext) as
// paper-wallet-btc's seedCipher.js and my_btc_wallet's seedcipher.js -
// deliberately, not by coincidence. Those encrypt a mnemonic specifically;
// this encrypts arbitrary plan text. Since the format is otherwise
// identical, a blob from any of the three decrypts correctly in any of the
// three (see textcipher.test.mjs) - not the point of this tool, but a nice
// side effect of not inventing a new format for the same underlying need.
const SCRYPT_OPTS = { N: 65536, r: 8, p: 1, dkLen: 32 };
const SALT_LEN = 16;
const NONCE_LEN = 12;

async function deriveKey(password, salt) {
  return scryptAsync(utf8ToBytes(password.normalize('NFC')), salt, SCRYPT_OPTS);
}

/** Encrypts arbitrary text with a password. Returns a base64 blob. */
export async function encryptText(text, password) {
  const salt = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const key = await deriveKey(password, salt);
  const ciphertext = gcm(key, nonce).encrypt(utf8ToBytes(text));
  return base64.encode(concatBytes(salt, nonce, ciphertext));
}

/**
 * Decrypts a blob produced by encryptText (or by paper-wallet-btc/
 * my_btc_wallet's own seed cipher, since the format matches). Throws if the
 * password is wrong or the blob is malformed - GCM's auth tag fails loudly
 * instead of returning garbage. Strips whitespace first: an exported blob
 * copy-pasted from a printed page or wrapped in an email will very likely
 * pick up line breaks that aren't part of the actual base64 data.
 */
export async function decryptText(blob, password) {
  let payload;
  try {
    payload = base64.decode(blob.replace(/\s+/g, ''));
  } catch {
    throw new Error('El bloque cifrado no es un base64 valido.');
  }
  if (payload.length <= SALT_LEN + NONCE_LEN) {
    throw new Error('El bloque cifrado esta incompleto.');
  }
  const salt = payload.slice(0, SALT_LEN);
  const nonce = payload.slice(SALT_LEN, SALT_LEN + NONCE_LEN);
  const ciphertext = payload.slice(SALT_LEN + NONCE_LEN);
  const key = await deriveKey(password, salt);
  let plaintext;
  try {
    plaintext = gcm(key, nonce).decrypt(ciphertext);
  } catch {
    throw new Error('Contrasena incorrecta o bloque cifrado invalido.');
  }
  return new TextDecoder().decode(plaintext);
}
