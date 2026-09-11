import { NETWORK, TEST_NETWORK } from '@scure/btc-signer';
import { REGTEST_NETWORK } from './vault.js';

/** expectedTestnet drives parseExtendedPubkey's xpub/tpub prefix check -
 * regtest reuses testnet's version bytes, so it expects "tpub" too. */
export function networkFor(id) {
  if (id === 'mainnet') return { network: NETWORK, expectedTestnet: false };
  if (id === 'testnet') return { network: TEST_NETWORK, expectedTestnet: true };
  if (id === 'regtest') return { network: REGTEST_NETWORK, expectedTestnet: true };
  throw new Error(`Red desconocida: ${id}`);
}
