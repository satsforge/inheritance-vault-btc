// The exportable data each party actually needs, as plain JSON text. None of
// this is secret by itself (it's all public-key/script material, the same
// things an on-chain observer could eventually reconstruct from a spend) -
// encryption on export is offered for the OWNER's privacy (it reveals the
// whole family's allocation plan), not because leaking it would let anyone
// steal funds.
import { hex } from '@scure/base';

export const CLAIM_KIT_VERSION = 1;

/** One heir's own copy: everything needed to build their claim PSBT later,
 * and nothing about any other heir's allocation. */
export function buildHeirClaimKit({ vault, label, heirSigner, heirDerivationIndex, network, amountSatsPlanned }) {
  return {
    kind: 'inheritance-vault-btc/heir-claim-kit',
    version: CLAIM_KIT_VERSION,
    network,
    label,
    vaultAddress: vault.address,
    csvBlocks: vault.csvBlocks,
    leafScriptHex: hex.encode(vault.leafScript),
    ownerXOnlyPubkeyHex: hex.encode(vault.ownerXOnlyPubkey),
    heirXOnlyPubkeyHex: hex.encode(vault.heirXOnlyPubkey),
    heirSignerKeyText: heirSigner.signerKeyText,
    heirDerivationIndex,
    amountSatsPlanned: amountSatsPlanned ?? null,
  };
}

/** The owner's own copy: one registry entry per heir/vault, so the owner can
 * reclaim ANY of them (key-path, any time) without having kept separate
 * per-heir notes. */
export function buildOwnerRegistry({ ownerSignerKeyText, network, entries }) {
  return {
    kind: 'inheritance-vault-btc/owner-registry',
    version: CLAIM_KIT_VERSION,
    network,
    ownerSignerKeyText,
    vaults: entries.map(({ vault, label, ownerDerivationIndex, heirSigner, amountSatsPlanned }) => ({
      label,
      vaultAddress: vault.address,
      csvBlocks: vault.csvBlocks,
      leafScriptHex: hex.encode(vault.leafScript),
      ownerXOnlyPubkeyHex: hex.encode(vault.ownerXOnlyPubkey),
      heirXOnlyPubkeyHex: hex.encode(vault.heirXOnlyPubkey),
      ownerDerivationIndex,
      heirSignerKeyText: heirSigner.signerKeyText,
      amountSatsPlanned: amountSatsPlanned ?? null,
    })),
  };
}

export function parseClaimKitText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('No es un JSON valido - pegá el texto exportado tal cual, sin editarlo.');
  }
  if (!data || typeof data !== 'object' || !data.kind || !String(data.kind).startsWith('inheritance-vault-btc/')) {
    throw new Error('Este texto no es un kit de reclamo/registro de esta herramienta.');
  }
  return data;
}
