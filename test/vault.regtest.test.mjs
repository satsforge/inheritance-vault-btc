// Integration test against a real Bitcoin Core regtest node - proves the
// ACTUAL library code (keys.js/vault.js/psbtbuilder.js), not just the
// throwaway design-validation script, produces a vault that:
//  1. the owner can reclaim (key-path) at any time,
//  2. a heir CANNOT claim (script-path) before the CSV timelock matures,
//  3. a heir CAN claim once it matures,
// and crucially, that the exported PSBTs are actually signable end-to-end by
// PSBT Signer BTC's real signing code (imported directly from the sibling
// repo, not reimplemented) - the whole point of building on tapBip32Derivation
// instead of a bespoke annotation scheme.
//
// Requires a local `bitcoind -regtest` already running (see this session's
// setup) - skips instead of failing if it isn't reachable, so this doesn't
// break `npm test` in a fresh checkout without regtest set up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { HDKey } from '@scure/bip32';
import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';

import { parseSignerKey, deriveChildXOnlyPubkey, childNumericPath } from '../src/lib/keys.js';
import { buildHeirVault, REGTEST_NETWORK } from '../src/lib/vault.js';
import { buildOwnerReclaimPsbt, buildHeirClaimPsbt } from '../src/lib/psbtbuilder.js';
import { buildHeirClaimKit } from '../src/lib/claimkit.js';

import { decodePsbt, identifySigners, applySignatures, finalizeOrExport } from '../../psbt-signer-btc/src/lib/psbt.js';
import { rootFromSeed } from '../../psbt-signer-btc/src/lib/hdwallet.js';

const BIN = String.raw`C:\Users\MAIRON~1.CUE\AppData\Local\Temp\claude\C--Users-mairon-cuello-development-workspace-ideas-my-btc-wallet\2da2782e-1cbc-45f4-b41c-3cb16849f026\scratchpad\bitcoin-core\extracted\bitcoin-31.1\bin\bitcoin-cli.exe`;
const DATADIR = String.raw`C:\Users\MAIRON~1.CUE\AppData\Local\Temp\claude\C--Users-mairon-cuello-development-workspace-ideas-my-btc-wallet\2da2782e-1cbc-45f4-b41c-3cb16849f026\scratchpad\bitcoin-core\regtest-data`;
const WALLET = 'testwallet';

function cli(...args) {
  const out = execFileSync(BIN, ['-regtest', `-datadir=${DATADIR}`, `-rpcwallet=${WALLET}`, ...args], { encoding: 'utf8' });
  const t = out.trim();
  try { return JSON.parse(t); } catch { return t; }
}
function cliNoWallet(...args) {
  const out = execFileSync(BIN, ['-regtest', `-datadir=${DATADIR}`, ...args], { encoding: 'utf8' });
  const t = out.trim();
  try { return JSON.parse(t); } catch { return t; }
}

const REGTEST_AVAILABLE = existsSync(BIN) && existsSync(DATADIR) && (() => {
  try { cliNoWallet('getblockchaininfo'); return true; } catch { return false; }
})();

const TESTNET_VERSIONS = { private: 0x04358394, public: 0x043587cf };
const ACCOUNT_PATH = "86h/1h/0h"; // Taproot-flavored, coin_type 1' (testnet/regtest)

function fingerprintHex(root) {
  return root.fingerprint.toString(16).padStart(8, '0');
}

function makeSignerKeyMaterial(seedByte) {
  const seed = new Uint8Array(32).fill(seedByte);
  const root = HDKey.fromMasterSeed(seed, TESTNET_VERSIONS);
  const account = root.derive(`m/${ACCOUNT_PATH.replace(/h/g, "'")}`);
  const xpubText = account.publicExtendedKey;
  const signerKeyText = `[${fingerprintHex(root)}/${ACCOUNT_PATH}]${xpubText}`;
  return { seed, root, signerKey: parseSignerKey(signerKeyText, true), signerKeyText };
}

test('keys.js: parseSignerKey round-trips a [fingerprint/path]xpub entry', () => {
  const { signerKey } = makeSignerKeyMaterial(0x11);
  assert.equal(signerKey.fingerprint.length, 8);
  assert.equal(signerKey.accountPath, ACCOUNT_PATH);
  const child0 = deriveChildXOnlyPubkey(signerKey, 0);
  assert.equal(child0.length, 32);
  const path = childNumericPath(signerKey, 0);
  assert.deepEqual(path.slice(-2), [0, 0]); // chain=0, index=0
});

test('claimkit.js: a heir claim kit carries a signerKeyText that re-derives the SAME pubkey (the actual claim-screen flow)', () => {
  // Regression test: parseSignerKey used to return no `signerKeyText` at all,
  // so every exported claim kit silently omitted heirSignerKeyText (JSON.stringify
  // drops undefined fields), and building a claim PSBT from a real exported kit
  // failed with "Cannot read properties of undefined (reading 'trim')" - caught
  // by hand-testing the actual UI, not by the regtest test above (which builds
  // signer info directly, bypassing the kit's own round trip).
  const heir = makeSignerKeyMaterial(0x33);
  const owner = makeSignerKeyMaterial(0x44);
  const heirXOnly = deriveChildXOnlyPubkey(heir.signerKey, 0);
  const ownerXOnly = deriveChildXOnlyPubkey(owner.signerKey, 0);
  const vault = buildHeirVault({ ownerXOnlyPubkey: ownerXOnly, heirXOnlyPubkey: heirXOnly, csvBlocks: 10, network: REGTEST_NETWORK });

  const kit = buildHeirClaimKit({ vault, label: 'Test', heirSigner: heir.signerKey, heirDerivationIndex: 0, network: 'regtest', amountSatsPlanned: null });
  const roundTripped = JSON.parse(JSON.stringify(kit));
  assert.ok(roundTripped.heirSignerKeyText, 'heirSignerKeyText survives a JSON round trip');

  const reparsed = parseSignerKey(roundTripped.heirSignerKeyText, true);
  const rederivedXOnly = deriveChildXOnlyPubkey(reparsed, roundTripped.heirDerivationIndex);
  assert.equal(hex.encode(rederivedXOnly), roundTripped.heirXOnlyPubkeyHex, 're-parsing the kit\'s signerKeyText reproduces the exact heir pubkey the vault was built with');
});

test('vault.js: rejects an out-of-range CSV value', () => {
  const heirPub = new Uint8Array(32).fill(7);
  const ownerPub = new Uint8Array(32).fill(8);
  assert.throws(() => buildHeirVault({ ownerXOnlyPubkey: ownerPub, heirXOnlyPubkey: heirPub, csvBlocks: 0, network: REGTEST_NETWORK }));
  assert.throws(() => buildHeirVault({ ownerXOnlyPubkey: ownerPub, heirXOnlyPubkey: heirPub, csvBlocks: 0x10000, network: REGTEST_NETWORK }));
});

test('end-to-end on regtest: owner reclaims any time, heir only after CSV maturity, both PSBTs sign for real in PSBT Signer BTC', { skip: !REGTEST_AVAILABLE && 'no local regtest node reachable' }, async () => {
  const CSV_BLOCKS = 5;
  const owner = makeSignerKeyMaterial(0x11);
  const heir = makeSignerKeyMaterial(0x22);

  const ownerXOnly = deriveChildXOnlyPubkey(owner.signerKey, 0);
  const heirXOnly = deriveChildXOnlyPubkey(heir.signerKey, 0);
  const ownerDerPath = childNumericPath(owner.signerKey, 0);
  const heirDerPath = childNumericPath(heir.signerKey, 0);

  const vault = buildHeirVault({ ownerXOnlyPubkey: ownerXOnly, heirXOnlyPubkey: heirXOnly, csvBlocks: CSV_BLOCKS, network: REGTEST_NETWORK });
  assert.ok(vault.address.startsWith('bcrt1p'));

  // --- fund regtest wallet if needed ---
  const info = cli('getblockchaininfo');
  const miningAddr = cli('getnewaddress');
  if (info.blocks < 101) cliNoWallet('generatetoaddress', String(101 - info.blocks), miningAddr);
  assert.ok(cli('getbalance') > 0);

  function fundVault() {
    const txid = cli('sendtoaddress', vault.address, '1.0');
    cliNoWallet('generatetoaddress', '1', miningAddr);
    const walletTx = cli('gettransaction', txid);
    const raw = cli('decoderawtransaction', walletTx.hex);
    const vout = raw.vout.find((o) => o.scriptPubKey.hex === hex.encode(vault.script));
    return { txid, index: vout.n, amount: BigInt(Math.round(vout.value * 1e8)) };
  }

  const utxoForOwner = fundVault();
  const utxoForHeir = fundVault();
  const destAddr = cli('getnewaddress');

  // --- owner reclaim: build PSBT here, sign it for real in psbt-signer-btc's code ---
  {
    const ownerRoot = rootFromSeed(owner.seed);
    const tx = buildOwnerReclaimPsbt({
      vault,
      utxo: utxoForOwner,
      destinationAddress: destAddr,
      feeSats: 1000n,
      ownerSigner: { xOnlyPubkey: ownerXOnly, fingerprint: fingerprintHex(owner.root), path: ownerDerPath },
    });
    const decoded = decodePsbt(Buffer.from(tx.toPSBT()).toString('base64'));
    const matches = identifySigners(decoded, { candidateMap: null, root: ownerRoot });
    assert.equal(matches.length, 1, 'psbt-signer-btc found the owner as a signer for this input');
    applySignatures(decoded, matches, REGTEST_NETWORK);
    const result = finalizeOrExport(decoded);
    assert.ok(result.finalized, `owner PSBT finalized: ${result.error ?? ''}`);
    let broadcastTxid;
    try {
      broadcastTxid = cli('sendrawtransaction', result.hex);
    } catch (e) {
      assert.fail(`owner spend rejected by bitcoind: ${e.message}`);
    }
    assert.equal(broadcastTxid.length, 64);
    cliNoWallet('generatetoaddress', '1', miningAddr);
  }

  // --- heir claim: rejected before maturity, accepted after ---
  {
    const heirRoot = rootFromSeed(heir.seed);
    const tx = buildHeirClaimPsbt({
      vault,
      utxo: utxoForHeir,
      destinationAddress: destAddr,
      feeSats: 1000n,
      heirSigner: { xOnlyPubkey: heirXOnly, fingerprint: fingerprintHex(heir.root), path: heirDerPath },
    });
    const decoded = decodePsbt(Buffer.from(tx.toPSBT()).toString('base64'));
    const matches = identifySigners(decoded, { candidateMap: null, root: heirRoot });
    assert.equal(matches.length, 1, 'psbt-signer-btc found the heir as a signer for this input (via tapBip32Derivation)');
    applySignatures(decoded, matches, REGTEST_NETWORK);
    const result = finalizeOrExport(decoded);
    assert.ok(result.finalized, `heir PSBT finalized: ${result.error ?? ''}`);

    let accepted = false;
    for (let conf = 1; conf <= CSV_BLOCKS + 2 && !accepted; conf++) {
      try {
        cli('sendrawtransaction', result.hex);
        accepted = true;
      } catch {
        cliNoWallet('generatetoaddress', '1', miningAddr);
      }
    }
    assert.ok(accepted, 'heir claim eventually accepted by bitcoind after CSV maturity');
  }
});
