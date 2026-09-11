// Descriptor-style key parsing/derivation, watch-only end to end - never
// touches a private key. Reuses the exact "[fingerprint/path]xpub" syntax
// multisig-coordinator-btc already uses for cosigner exchange, so the same
// mental model (and the same copy/paste habits) carry over: the owner's
// vault key and each heir's claim key are both expressed this way.
import { HDKey } from '@scure/bip32';
import { base58check } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';

const b58c = base58check(sha256);

const KNOWN_VERSIONS = {
  0x0488b21e: { isTestnet: false, label: 'xpub' },
  0x043587cf: { isTestnet: true, label: 'tpub' },
};
const PRIVATE_VERSION = { false: 0x0488ade4, true: 0x04358394 };

export function parseExtendedPubkey(text, expectedTestnet) {
  const trimmed = text.trim();
  let payload;
  try {
    payload = b58c.decode(trimmed);
  } catch {
    throw new Error('No es una clave publica extendida valida (xpub/tpub...).');
  }
  if (payload.length < 4) throw new Error('No es una clave publica extendida valida (xpub/tpub...).');
  const version = ((payload[0] << 24) | (payload[1] << 16) | (payload[2] << 8) | payload[3]) >>> 0;
  const known = KNOWN_VERSIONS[version];
  if (!known) throw new Error('Prefijo de clave publica extendida no reconocido.');
  if (known.isTestnet !== expectedTestnet) {
    throw new Error(
      `Esta clave (${known.label}) es de ${known.isTestnet ? 'testnet' : 'mainnet'}, pero elegiste ${expectedTestnet ? 'testnet' : 'mainnet'}.`
    );
  }
  let node;
  try {
    node = HDKey.fromExtendedKey(trimmed, { public: version, private: PRIVATE_VERSION[known.isTestnet] });
  } catch (err) {
    throw new Error(`No se pudo leer la clave publica: ${err.message}`);
  }
  if (node.privateKey) throw new Error('Esto es una clave privada, no publica.');
  if (!node.publicKey) throw new Error('No se pudo leer la clave publica.');
  return node;
}

/** Parses "86h/0h/0h" or "86'/0'/0'" (with or without a leading "m/"). */
export function parsePath(pathText) {
  const cleaned = pathText.trim().replace(/^m\/?/i, '');
  if (!cleaned) return [];
  return cleaned.split('/').map((segment) => {
    const hardened = /[h']$/i.test(segment);
    const index = parseInt(hardened ? segment.slice(0, -1) : segment, 10);
    if (!Number.isInteger(index) || index < 0 || index >= 0x80000000) {
      throw new Error(`Segmento de ruta invalido: "${segment}"`);
    }
    return { index, hardened };
  });
}

export function formatPathForDescriptor(pathText) {
  return parsePath(pathText)
    .map((s) => `${s.index}${s.hardened ? 'h' : ''}`)
    .join('/');
}

const HARDENED_OFFSET = 0x80000000;
export function numericPath(pathText) {
  return parsePath(pathText).map(({ index, hardened }) => (hardened ? index + HARDENED_OFFSET : index));
}

const SIGNER_KEY_RE = /^\[([0-9a-fA-F]{8})((?:\/[0-9]+[h']?)*)\]([A-Za-z0-9]+)$/;

/**
 * Parses one "[fingerprint/account-path]xpub" entry - the owner's vault key
 * or one heir's claim key. Returns the account-level node plus enough
 * metadata (fingerprint + account path, both as they'll appear in a PSBT's
 * tapBip32Derivation) to later point a signer at exactly which child key to
 * derive, without them having to guess a path.
 */
export function parseSignerKey(text, expectedTestnet) {
  const trimmed = text.trim();
  const match = SIGNER_KEY_RE.exec(trimmed);
  if (!match) {
    throw new Error('Formato esperado: [fingerprint/86h/0h/0h]xpub... (8 caracteres hex + ruta + clave publica extendida).');
  }
  const [, fingerprintHex, pathRaw, xpub] = match;
  const accountPath = pathRaw.replace(/^\//, '');
  const accountNode = parseExtendedPubkey(xpub, expectedTestnet);
  const fingerprint = fingerprintHex.toLowerCase();
  const trimmedXpub = xpub.trim();
  return {
    fingerprint,
    accountPath,
    accountNode,
    xpub: trimmedXpub,
    // The exact "[fingerprint/path]xpub" text, reconstructed rather than
    // kept verbatim from input (trims whitespace/casing) - this is what
    // claimkit.js embeds so a later claim can re-derive the same signer
    // without the owner/heir having to re-paste their key by hand.
    signerKeyText: formatSignerKey({ fingerprint, accountPath, xpub: trimmedXpub }),
  };
}

export function formatSignerKey({ fingerprint, accountPath, xpub }) {
  return `[${fingerprint.toLowerCase()}/${formatPathForDescriptor(accountPath)}]${xpub}`;
}

/**
 * Derives the child x-only (32-byte, BIP340) public key at chain/index below
 * a parsed signer key's account node - pure public-key derivation, exactly
 * like multisig-coordinator-btc's deriveMultisigPayment. `chain` is always 0
 * here (no change branch - vault addresses aren't a receive wallet, each one
 * is a single fixed destination).
 */
export function deriveChildXOnlyPubkey(signerKey, index, chain = 0) {
  const child = signerKey.accountNode.deriveChild(chain).deriveChild(index);
  return child.publicKey.slice(1, 33); // drop the 0x02/0x03 parity prefix -> x-only
}

/** Full numeric derivation path (from master) for a derived child, for the
 * PSBT's tapBip32Derivation.der.path - master fingerprint + this path is
 * how a signer with the matching seed finds the exact private key later. */
export function childNumericPath(signerKey, index, chain = 0) {
  return [...numericPath(signerKey.accountPath), chain, index];
}
