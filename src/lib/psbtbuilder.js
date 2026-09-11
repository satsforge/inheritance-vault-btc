// Builds UNSIGNED PSBTs only - this tool never sees a private key. The
// owner's reclaim PSBT and each heir's claim PSBT are meant to be opened and
// signed in PSBT Signer BTC (already exists, already air-gapped), which is
// why every input here carries a standard BIP174 tapBip32Derivation entry:
// it's the only thing a signer needs to recognize "this key is mine" without
// re-deriving every possible address by brute force (impossible here anyway,
// since a vault's output key is tweaked by a script tree, not a plain
// key-path-only address).
import * as btc from '@scure/btc-signer';
import { base64 } from '@scure/base';

function tapDerivationEntry(xOnlyPubkey, fingerprintHex, path, leafHashes) {
  return [xOnlyPubkey, { hashes: leafHashes, der: { fingerprint: parseInt(fingerprintHex, 16), path } }];
}

function outputAmount(utxo, feeSats) {
  const send = utxo.amount - feeSats;
  if (send <= 0n) throw new Error('El fee es mayor o igual al monto disponible en la boveda.');
  return send;
}

/**
 * Owner's key-path reclaim: spendable any time, no CSV involved. `ownerSigner`
 * is `{ xOnlyPubkey, fingerprint, path }` - the exact child key that built
 * this vault (see keys.js's deriveChildXOnlyPubkey/childNumericPath).
 */
export function buildOwnerReclaimPsbt({ vault, utxo, destinationAddress, feeSats, ownerSigner }) {
  const tx = new btc.Transaction();
  tx.addInput({
    txid: utxo.txid,
    index: utxo.index,
    witnessUtxo: { amount: utxo.amount, script: vault.script },
    tapInternalKey: vault.tapInternalKey,
    tapMerkleRoot: vault.tapMerkleRoot,
    tapBip32Derivation: [tapDerivationEntry(ownerSigner.xOnlyPubkey, ownerSigner.fingerprint, ownerSigner.path, [])],
  });
  tx.addOutputAddress(destinationAddress, outputAmount(utxo, feeSats), vault.network);
  return tx;
}

/**
 * Heir's script-path claim: only valid once `vault.csvBlocks` confirmations
 * have passed on the funding tx - bitcoind enforces this at the consensus
 * level (BIP68), this tool just has to set `sequence` correctly for it to
 * even be possible to broadcast once mature.
 */
export function buildHeirClaimPsbt({ vault, utxo, destinationAddress, feeSats, heirSigner }) {
  const tx = new btc.Transaction({ allowUnknownInputs: true });
  const leafHash = vault.leaves[0].hash;
  tx.addInput({
    txid: utxo.txid,
    index: utxo.index,
    witnessUtxo: { amount: utxo.amount, script: vault.script },
    tapLeafScript: vault.tapLeafScript,
    sequence: vault.csvBlocks,
    tapBip32Derivation: [tapDerivationEntry(heirSigner.xOnlyPubkey, heirSigner.fingerprint, heirSigner.path, [leafHash])],
  });
  tx.addOutputAddress(destinationAddress, outputAmount(utxo, feeSats), vault.network);
  return tx;
}

export function psbtBase64(tx) {
  return base64.encode(tx.toPSBT());
}
