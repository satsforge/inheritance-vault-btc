export const LANGS = ['es', 'en'];
export const DEFAULT_LANG = 'es';

const dict = {
  'meta.title': { es: 'Bóveda de Herencia BTC', en: 'BTC Inheritance Vault' },
  'topbar.brand': { es: 'Bóveda de Herencia BTC', en: 'BTC Inheritance Vault' },
  'topbar.theme.toLight': { es: '☀ Modo claro', en: '☀ Light mode' },
  'topbar.theme.toDark': { es: '🌙 Modo oscuro', en: '🌙 Dark mode' },
  'topbar.lang.toEnglish': { es: '🌐 English', en: '🌐 English' },
  'topbar.lang.toSpanish': { es: '🌐 Español', en: '🌐 Español' },

  'notice.intro': {
    es: 'Arma una dirección Taproot por heredero: vos (el owner) podés gastarla en cualquier momento (key-path), y cada heredero puede reclamar SU parte recién después de que pase el tiempo de espera (timelock) que le asignes — sin oráculo, sin backend, sin que nadie tenga que "avisar" que algo pasó. Esta herramienta es <strong>100% watch-only</strong>: nunca ve ni pide ninguna clave privada, ni la tuya ni la de tus herederos. Solo arma direcciones y PSBTs sin firmar — firmar sigue siendo trabajo de <strong>PSBT Signer BTC</strong>.',
    en: 'Builds one Taproot address per heir: you (the owner) can spend it at any time (key-path), and each heir can claim THEIR share only after the timelock you set for them has passed — no oracle, no backend, nobody has to "report" anything happened. This tool is <strong>100% watch-only</strong>: it never sees or asks for any private key, yours or your heirs\'. It only builds addresses and unsigned PSBTs — signing is still <strong>PSBT Signer BTC</strong>\'s job.',
  },
  'notice.warning': {
    es: '⚠️ <strong>Es la herramienta de mayor riesgo del suite.</strong> Las direcciones que genera usan un script no estándar (no un simple 1-de-1 ni multifirma clásica) — la mayoría de las wallets NO van a reconocer los fondos enviados ahí, y solo se pueden gastar con PSBTs armados por esta misma herramienta y firmados en PSBT Signer BTC. Probá primero con montos chicos y en <strong>testnet o regtest</strong> antes de usar mainnet con fondos reales.',
    en: '⚠️ <strong>The highest-risk tool in this suite.</strong> The addresses it generates use a non-standard script (not a plain 1-of-1 or classic multisig) — most wallets will NOT recognize funds sent there, and they can only be spent with PSBTs built by this same tool and signed in PSBT Signer BTC. Test first with small amounts on <strong>testnet or regtest</strong> before using mainnet with real funds.',
  },

  'nav.setup': { es: 'Crear una bóveda', en: 'Create a vault' },
  'nav.claim': { es: 'Armar un reclamo (PSBT)', en: 'Build a claim (PSBT)' },
  'nav.back': { es: '← Atrás', en: '← Back' },

  'setup.title': { es: 'Datos del owner', en: 'Owner details' },
  'setup.network.label': { es: 'Red', en: 'Network' },
  'setup.network.mainnet': { es: 'Mainnet', en: 'Mainnet' },
  'setup.network.testnet': { es: 'Testnet', en: 'Testnet' },
  'setup.network.regtest': { es: 'Regtest (pruebas locales)', en: 'Regtest (local testing)' },
  'setup.ownerKey.label': { es: 'Tu clave (owner)', en: 'Your key (owner)' },
  'setup.ownerKey.hint': {
    es: 'Formato [fingerprint/ruta]xpub — igual que en Coordinador Multifirma. Es SOLO tu clave pública, nunca pegues acá una clave privada ni una seed.',
    en: 'Format [fingerprint/path]xpub — same as in Multisig Coordinator. This is ONLY your public key, never paste a private key or seed here.',
  },
  'setup.heirs.title': { es: 'Herederos', en: 'Heirs' },
  'setup.heirs.add': { es: '+ Agregar heredero', en: '+ Add heir' },
  'setup.generate': { es: 'Generar bóvedas', en: 'Generate vaults' },

  'heir.number': { es: 'Heredero {n}', en: 'Heir {n}' },
  'heir.remove': { es: 'Quitar', en: 'Remove' },
  'heir.label.label': { es: 'Nombre o referencia', en: 'Name or label' },
  'heir.key.label': { es: 'Clave del heredero', en: "Heir's key" },
  'heir.key.hint': {
    es: 'El heredero genera esta clave por su cuenta (su propia seed, en su propia wallet) y solo te pasa esto — nunca su clave privada.',
    en: 'The heir generates this key on their own (their own seed, their own wallet) and only shares this with you — never their private key.',
  },
  'heir.csvBlocks.label': { es: 'Timelock (bloques)', en: 'Timelock (blocks)' },
  'heir.csvBlocks.hint': { es: '≈ {days} días (a ~144 bloques/día)', en: '≈ {days} days (at ~144 blocks/day)' },
  'heir.amount.label': { es: 'Monto planeado (BTC, informativo)', en: 'Planned amount (BTC, informational)' },

  'error.ownerKeyInvalid': { es: 'Clave del owner inválida: {msg}', en: "Owner key invalid: {msg}" },
  'error.heirKeyInvalid': { es: 'Clave del heredero "{label}" inválida: {msg}', en: 'Heir "{label}" key invalid: {msg}' },
  'error.noHeirs': { es: 'Agregá al menos un heredero.', en: 'Add at least one heir.' },
  'error.csvInvalid': { es: 'El timelock de "{label}" debe ser un entero entre 1 y 65535 bloques.', en: 'The timelock for "{label}" must be an integer between 1 and 65535 blocks.' },
  'error.emptyPassword': { es: 'Ingresá una contraseña.', en: 'Enter a password.' },
  'error.fileReadFailed': { es: 'No se pudo leer el archivo: {msg}', en: 'Could not read the file: {msg}' },
  'error.claimKitInvalid': { es: 'No se pudo leer el kit: {msg}', en: 'Could not read the kit: {msg}' },
  'error.buildFailed': { es: 'No se pudo construir el PSBT: {msg}', en: 'Could not build the PSBT: {msg}' },

  'result.title': { es: 'Tus bóvedas', en: 'Your vaults' },
  'result.warning': {
    es: 'Fondeá cada dirección exactamente con el monto planeado, en la red que elegiste. Guardá el registro del owner en un lugar seguro (contiene todo lo necesario para reclamar cualquier bóveda en cualquier momento) y entregale a cada heredero SOLO su propio kit.',
    en: "Fund each address with exactly the planned amount, on the network you chose. Keep the owner's registry somewhere safe (it holds everything needed to reclaim any vault at any time) and give each heir ONLY their own kit.",
  },
  'result.downloadRegistry': { es: '⬇ Descargar mi registro (owner)', en: "⬇ Download my registry (owner)" },
  'result.restart': { es: 'Volver a empezar', en: 'Start over' },
  'result.encrypt.title': { es: 'Exportar mi registro cifrado (opcional)', en: 'Export my registry encrypted (optional)' },
  'result.encrypt.hint': {
    es: 'El registro revela cuánto planeás dejarle a cada heredero — si lo vas a guardar en un lugar menos controlado, cifralo. Mismo formato AES-256-GCM que el resto del suite.',
    en: "The registry reveals how much you plan to leave each heir — if you'll store it somewhere less controlled, encrypt it. Same AES-256-GCM format as the rest of the suite.",
  },
  'result.encrypt.password.label': { es: 'Contraseña de cifrado', en: 'Encryption password' },
  'result.encrypt.download': { es: '⬇ Descargar registro cifrado (.txt)', en: '⬇ Download encrypted registry (.txt)' },
  'strength.emptyPassphrase': { es: 'Sin contraseña', en: 'No password' },
  'strength.weak': { es: 'Débil', en: 'Weak' },
  'strength.fair': { es: 'Aceptable', en: 'Fair' },
  'strength.good': { es: 'Buena', en: 'Good' },
  'strength.strong': { es: 'Fuerte', en: 'Strong' },

  'vault.address.label': { es: 'Dirección para fondear', en: 'Address to fund' },
  'vault.csv.label': { es: 'Timelock del heredero', en: "Heir's timelock" },
  'vault.csv.value': { es: '{blocks} bloques (≈ {days} días)', en: '{blocks} blocks (≈ {days} days)' },
  'vault.amount.label': { es: 'Monto planeado', en: 'Planned amount' },
  'vault.download.kit': { es: '⬇ Descargar kit del heredero', en: "⬇ Download heir's kit" },

  'claim.title': { es: 'Armar un reclamo', en: 'Build a claim' },
  'claim.hint': {
    es: 'Pegá tu kit (de heredero) o tu registro (de owner), completá los datos del UTXO real que fondeó la bóveda (buscalo en un explorador como mempool.space) y esta herramienta arma un PSBT sin firmar, listo para llevarlo a PSBT Signer BTC.',
    en: 'Paste your (heir) kit or your (owner) registry, fill in the real UTXO that funded the vault (look it up in an explorer like mempool.space) and this tool builds an unsigned PSBT, ready to take to PSBT Signer BTC.',
  },
  'claim.kit.label': { es: 'Kit / registro (JSON)', en: 'Kit / registry (JSON)' },
  'fileLoad.button': { es: '📁 Cargar desde archivo', en: '📁 Load from file' },
  'claim.vaultSelect.label': { es: 'Bóveda', en: 'Vault' },
  'claim.details.title': { es: 'Datos del UTXO y del reclamo', en: 'UTXO and claim details' },
  'claim.details.hint': {
    es: 'El UTXO es la transacción real que fondeó esta bóveda en la blockchain — esta herramienta no consulta ninguna red, tenés que buscarlo vos mismo.',
    en: "The UTXO is the real on-chain transaction that funded this vault — this tool doesn't query any network, you have to look it up yourself.",
  },
  'claim.txid.label': { es: 'Txid de la transacción que fondeó la bóveda', en: 'Txid of the transaction that funded the vault' },
  'claim.vout.label': { es: 'Índice del output (vout)', en: 'Output index (vout)' },
  'claim.amount.label': { es: 'Monto del UTXO (sats)', en: 'UTXO amount (sats)' },
  'claim.destination.label': { es: 'Dirección de destino', en: 'Destination address' },
  'claim.fee.label': { es: 'Fee (sats)', en: 'Fee (sats)' },
  'claim.derivationIndex.label': { es: 'Índice de derivación de tu clave', en: 'Your key\'s derivation index' },
  'claim.build': { es: 'Construir PSBT sin firmar', en: 'Build unsigned PSBT' },
  'claim.output.title': { es: 'PSBT sin firmar', en: 'Unsigned PSBT' },
  'claim.output.hint': {
    es: 'Copiá o descargá esto y abrilo en PSBT Signer BTC (con tu propia seed) para firmarlo. Esta herramienta nunca vio tu clave privada.',
    en: "Copy or download this and open it in PSBT Signer BTC (with your own seed) to sign it. This tool never saw your private key.",
  },
  'claim.output.download': { es: '⬇ Descargar PSBT (.txt)', en: '⬇ Download PSBT (.txt)' },

  'footer.note': {
    es: 'Watch-only — nunca ve una clave privada. Firmar es trabajo de PSBT Signer BTC.',
    en: "Watch-only — never sees a private key. Signing is PSBT Signer BTC's job.",
  },
};

export function t(key, lang, vars) {
  const entry = dict[key];
  let str = entry ? (entry[lang] ?? entry[DEFAULT_LANG]) : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}
