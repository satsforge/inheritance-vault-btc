# Bóveda de Herencia BTC

Herramienta 100% del lado del cliente y **watch-only** que arma una dirección
Taproot por heredero: el **owner** puede gastarla en cualquier momento
(key-path), y cada **heredero** puede reclamar su parte recién después de que
pase el tiempo de espera (timelock CSV) que el owner le haya asignado — sin
oráculo, sin backend, sin que nadie tenga que "avisar" que algo pasó.

> ⚠️ **Es la herramienta de mayor riesgo del suite.** Las direcciones que
> genera usan un script Taproot no estándar (un único leaf script-path
> `<N> OP_CHECKSEQUENCEVERIFY OP_DROP <heir_pubkey> OP_CHECKSIG`, no un
> simple 1-de-1 ni una multifirma clásica). La mayoría de las wallets **no
> van a reconocer** los fondos enviados a esas direcciones — solo se pueden
> gastar con un PSBT armado por esta misma herramienta y firmado en
> [PSBT Signer BTC](https://github.com/satsforge/psbt-signer-btc). Probá
> primero con montos chicos en **testnet o regtest** antes de usar mainnet
> con fondos reales.

## Diseño: por qué esta forma y no otra

Se evaluaron y descartaron tres alternativas antes de llegar a este diseño
(ver el historial de diseño en memoria del proyecto):

- **La app ejecuta y reparte los fondos automáticamente** — arquitectónicamente
  imposible: este suite es 100% archivos estáticos sin backend, y no existe
  ningún oráculo on-chain confiable para "el owner murió".
- **Un solo UTXO/script multi-heredero compartido** — no soporta reparto por
  montos distintos por heredero sin covenants (CTV) que no están desplegados
  en mainnet.
- **Un compilador Miniscript general** — se descartó a favor de una única
  plantilla de script fija y hecha a mano, para minimizar la superficie de un
  bug catastrófico e indetectable hasta que ya sea tarde.

Validado end-to-end contra un nodo **Bitcoin Core real en regtest** (no solo
contra el propio código): el owner puede gastar por key-path en cualquier
momento, un heredero es rechazado (`non-BIP68-final`) antes de que madure el
timelock, y es aceptado una vez minados los bloques necesarios — con ambos
PSBTs firmados por el código real (parcheado) de PSBT Signer BTC, no una
reimplementación.

## Modelo de seguridad

- **100% watch-only, siempre**: el owner entrega su **xpub**, cada heredero
  genera su propio par de claves por su cuenta (su propia seed, en su propia
  wallet) y solo comparte su **pubkey pública** — igual que el intercambio de
  xpubs entre cosigners en
  [Multisig Coordinator BTC](https://github.com/satsforge/multisig-coordinator-btc).
  Esta herramienta nunca ve, pide, ni toca ninguna clave privada.
- **Nunca firma nada**: solo arma direcciones y **PSBTs sin firmar**. Firmar
  sigue siendo trabajo exclusivo de PSBT Signer BTC (ya existente, ya air-gapped) —
  así ninguna clave privada nueva pasa por código sin probar.
- **Cero red, verificable**: `connect-src 'none'` en la CSP. A diferencia de
  las hermanas watch-only del suite, esta herramienta no necesita consultar
  ninguna red — la construcción de direcciones es matemática pública pura, y
  el UTXO real que fondeó una bóveda se ingresa a mano (buscándolo en un
  explorador como mempool.space), no se consulta automáticamente.
- **`tapBip32Derivation` estándar, no un esquema propio**: cada PSBT exportado
  anota la derivación BIP174 correcta para que PSBT Signer BTC (con un parche
  puntual, ver abajo) encuentre solo, sin fuerza bruta, exactamente qué clave
  firma cada input — incluso para el script-path del heredero.

### Parche aplicado a PSBT Signer BTC

Para que el heredero pueda firmar un reclamo real, se le aplicó un parche
chico y acotado a `psbt-signer-btc/src/lib/psbt.js`:

1. `identifySigners` ahora también revisa `input.tapBip32Derivation` (el
   campo BIP174 correcto para Taproot, con x-only pubkeys) — antes solo
   miraba el campo legacy `bip32Derivation`.
2. `decodePsbt` pasa `allowUnknownInputs: true` a `Transaction.fromPSBT`, para
   poder finalizar un input cuyo script-path leaf (nuestra hoja CSV) no es uno
   de los templates que la librería reconoce de fábrica.

Ningún flujo existente de PSBT Signer BTC cambió de comportamiento — los 7
tests que ya tenía siguen pasando sin modificación.

## Cómo usarlo

```bash
npm install
npm run build     # genera dist/index.html e index.html
```

### 1. Crear una bóveda (el owner)

1. Elegí la red (mainnet/testnet/regtest) y pegá tu clave en formato
   `[fingerprint/ruta]xpub` — igual formato que Multisig Coordinator BTC.
2. Por cada heredero: nombre, su clave (que él mismo te pasa), el timelock en
   bloques, y el monto planeado (informativo).
3. Generá las bóvedas: una dirección Taproot por heredero.
4. Fondeá cada dirección con el monto exacto planeado.
5. Descargá **tu registro** (contiene todo lo necesario para reclamar
   cualquier bóveda en cualquier momento — guardalo seguro, opcionalmente
   cifrado) y entregale a **cada heredero solo su propio kit** (no ve las
   demás asignaciones).

### 2. Reclamar (el owner en cualquier momento, o un heredero tras el timelock)

1. Pegá tu kit (heredero) o tu registro (owner).
2. Buscá el UTXO real que fondeó la bóveda en un explorador (mempool.space,
   tu propio nodo, etc.) y completá txid/vout/monto.
3. Completá dirección de destino y fee.
4. Construí el PSBT sin firmar y llevalo a **PSBT Signer BTC** (con tu propia
   seed) para firmarlo y transmitirlo.

## Estructura del proyecto

```
src/
  lib/
    keys.js          parseo/derivacion de claves "[fingerprint/ruta]xpub" (watch-only)
    vault.js          el archivo mas importante: construccion del leaf CSV + direccion Taproot
    psbtbuilder.js     arma PSBTs sin firmar (reclamo owner / reclamo heredero)
    claimkit.js        serializa/parsea el kit exportable (heredero) y el registro (owner)
    networks.js        mainnet/testnet/regtest
    textcipher.js       cifra/descifra el registro del owner (mismo formato AES-256-GCM del suite)
    strength.js         medidor de fortaleza de contraseña (copiado de paper-wallet-btc)
    i18n.js             diccionario ES/EN
  app.js               wizard dinamico de herederos + pantalla de reclamo
test/
  vault.regtest.test.mjs   valida el motor real contra un nodo Bitcoin Core en regtest,
                           incluyendo la firma real via el codigo de psbt-signer-btc
```

## Tests

```bash
npm test
```

`vault.regtest.test.mjs` es el que más importa acá: levanta contra un
`bitcoind -regtest` local (se salta, no falla, si no encuentra uno corriendo)
y prueba, con dinero real de regtest:

- el owner reclama por key-path en cualquier momento,
- un heredero es rechazado por bitcoind (`non-BIP68-final`) antes de la
  maduración del timelock,
- el mismo heredero es aceptado una vez minados los bloques necesarios,
- **ambos PSBTs los firma el código real de PSBT Signer BTC** (importado
  directamente del repo hermano, no reimplementado), probando la
  interoperabilidad real entre ambas herramientas.

Además del test suite, el flujo completo se probó a mano en el navegador:
generación de bóveda con xpubs de testnet reales, verificación de que la
dirección generada coincide byte a byte con la calculada por la librería, y
construcción de PSBT tanto para el rol owner como heredero desde un kit/
registro exportado — que fue justamente como se encontró y corrigió un bug
real (`parseSignerKey` no incluía el texto de la clave en el objeto devuelto,
así que todo kit exportado omitía silenciosamente `heirSignerKeyText`).

## Limitaciones conocidas

- No hay integración con ningún explorador — el UTXO se ingresa a mano, a
  propósito (ver "Modelo de seguridad").
- No genera ni gestiona claves de heredero: cada heredero es responsable de
  generar y resguardar su propia clave por su cuenta.
- El índice de derivación de la clave del heredero se fija en `0` al crear la
  bóveda (un heredero, una clave, una bóveda) — la pantalla de reclamo permite
  ajustarlo manualmente si hiciera falta.
- No hay soporte para "el owner cambia de opinión y cancela/renueva" el
  timelock de un heredero ya creado — reclamar por key-path y volver a crear
  una bóveda nueva es, por ahora, el único camino.

## Licencia

ISC — software "tal cual", sin garantía. Es la herramienta de mayor riesgo
del suite — leé el código fuente (empezando por `src/lib/vault.js`) antes de
usarla con fondos reales.
