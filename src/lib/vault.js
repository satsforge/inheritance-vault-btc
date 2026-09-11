// The core, highest-risk file in this tool - see the PoC design notes this
// is built from: key-path = owner (always spendable), script-path = ONE
// fixed leaf `<csvBlocks> CHECKSEQUENCEVERIFY DROP <heir_pubkey> CHECKSIG`.
// Deliberately one hand-built template, not a general script/miniscript
// compiler - less surface area for a catastrophic, undiscoverable bug.
// Validated end to end against a real Bitcoin Core regtest node before this
// file existed (see test/vault.regtest.test.mjs, which re-validates the
// same claim through THIS code, not the throwaway PoC).
import * as btc from '@scure/btc-signer';

// @scure/btc-signer ships NETWORK (mainnet) and TEST_NETWORK (testnet,
// bech32 "tb") but no REGTEST constant - regtest reuses testnet's address
// version bytes with bech32 HRP "bcrt".
export const REGTEST_NETWORK = { ...btc.TEST_NETWORK, bech32: 'bcrt' };

export const MIN_CSV_BLOCKS = 1;
export const MAX_CSV_BLOCKS = 0xffff; // BIP68: block-based relative locktime fits 16 bits

export function csvLeafScript(heirXOnlyPubkey, csvBlocks) {
  if (!Number.isInteger(csvBlocks) || csvBlocks < MIN_CSV_BLOCKS || csvBlocks > MAX_CSV_BLOCKS) {
    throw new Error(`csvBlocks debe ser un entero entre ${MIN_CSV_BLOCKS} y ${MAX_CSV_BLOCKS}.`);
  }
  if (!(heirXOnlyPubkey instanceof Uint8Array) || heirXOnlyPubkey.length !== 32) {
    throw new Error('heirXOnlyPubkey debe ser una clave x-only de 32 bytes.');
  }
  return btc.Script.encode([csvBlocks, 'CHECKSEQUENCEVERIFY', 'DROP', heirXOnlyPubkey, 'CHECKSIG']);
}

/**
 * Builds one heir's vault: a Taproot output whose key-path is the owner
 * (spendable immediately, any time) and whose sole script-path leaf lets the
 * heir spend once csvBlocks confirmations have passed on the funding tx.
 * Pure public-key construction - no private key anywhere in this call.
 */
export function buildHeirVault({ ownerXOnlyPubkey, heirXOnlyPubkey, csvBlocks, network }) {
  const leafScript = csvLeafScript(heirXOnlyPubkey, csvBlocks);
  // allowUnknownOutputs=true: this CSV leaf isn't one of the library's
  // recognized script templates (pk/ms/ns), so it must be explicitly allowed.
  const payment = btc.p2tr(ownerXOnlyPubkey, { script: leafScript }, network, true);
  return {
    ...payment,
    leafScript,
    csvBlocks,
    ownerXOnlyPubkey,
    heirXOnlyPubkey,
    network,
  };
}

/** Rough, deliberately-approximate days estimate for a block count - real
 * block times vary, this is only for helping a human pick a sane CSV value,
 * never used in any consensus-facing calculation. */
export function csvBlocksToApproxDays(csvBlocks) {
  return csvBlocks / 144;
}

export function approxDaysToCsvBlocks(days) {
  return Math.max(MIN_CSV_BLOCKS, Math.round(days * 144));
}
