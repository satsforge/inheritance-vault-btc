import { hex } from '@scure/base';
import { parseSignerKey, deriveChildXOnlyPubkey, childNumericPath } from './lib/keys.js';
import { buildHeirVault, csvBlocksToApproxDays } from './lib/vault.js';
import { buildOwnerReclaimPsbt, buildHeirClaimPsbt, psbtBase64 } from './lib/psbtbuilder.js';
import { buildHeirClaimKit, buildOwnerRegistry, parseClaimKitText } from './lib/claimkit.js';
import { networkFor } from './lib/networks.js';
import { encryptText } from './lib/textcipher.js';
import { estimatePassphraseBits } from './lib/strength.js';
import { t, DEFAULT_LANG } from './lib/i18n.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['intro', 'setup', 'result', 'claim'];

const state = {
  lang: DEFAULT_LANG,
  network: 'mainnet',
  ownerKeyText: '',
  heirs: [], // { id, label, keyText, csvBlocks, amountBtc }
  nextHeirId: 1,
  vaults: [], // built on generate: { label, vault, ownerSigner, heirSigner, ownerDerivationIndex, heirDerivationIndex, amountSatsPlanned }
  ownerSignerKeyText: '',
  claim: { data: null, entries: [], selectedIndex: 0 },
};

function tr(key, vars) { return t(key, state.lang, vars); }

function showScreen(name) {
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
}

function setError(elId, message) {
  const el = $(elId);
  el.textContent = message ?? '';
  el.hidden = !message;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function btcToSats(btcAmount) {
  if (!btcAmount) return null;
  return BigInt(Math.round(Number(btcAmount) * 1e8));
}

// ---------- Topbar ----------

function updateThemeButtonLabel() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  $('theme-toggle').textContent = tr(isLight ? 'topbar.theme.toDark' : 'topbar.theme.toLight');
}
function updateLangButtonLabel() {
  $('lang-toggle').textContent = tr(state.lang === 'es' ? 'topbar.lang.toEnglish' : 'topbar.lang.toSpanish');
}

function applyTranslations() {
  document.documentElement.lang = state.lang;
  document.title = tr('meta.title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = tr(el.dataset.i18n); });
  updateThemeButtonLabel();
  updateLangButtonLabel();
  renderHeirRows();
  if (state.vaults.length) renderResult();
}

function initTopbar() {
  $('lang-toggle').addEventListener('click', () => {
    state.lang = state.lang === 'es' ? 'en' : 'es';
    applyTranslations();
  });
  $('theme-toggle').addEventListener('click', () => {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    updateThemeButtonLabel();
  });
}

// ---------- Intro ----------

function initIntroScreen() {
  $('intro-setup-btn').addEventListener('click', () => showScreen('setup'));
  $('intro-claim-btn').addEventListener('click', () => showScreen('claim'));
}

// ---------- Setup (dynamic heir rows) ----------

function addHeirRow() {
  state.heirs.push({ id: state.nextHeirId++, label: '', keyText: '', csvBlocks: 26280, amountBtc: '' }); // ~6 months default
  renderHeirRows();
}

function readHeirRowsIntoState() {
  for (const heir of state.heirs) {
    const row = document.querySelector(`[data-heir-id="${heir.id}"]`);
    if (!row) continue;
    heir.label = row.querySelector('.heir-label').value;
    heir.keyText = row.querySelector('.heir-key').value;
    heir.csvBlocks = parseInt(row.querySelector('.heir-csv').value, 10);
    heir.amountBtc = row.querySelector('.heir-amount').value;
  }
}

function renderHeirRows() {
  const container = $('heir-rows');
  container.innerHTML = '';
  state.heirs.forEach((heir, idx) => {
    const row = document.createElement('div');
    row.className = 'heir-row';
    row.dataset.heirId = heir.id;
    const days = csvBlocksToApproxDays(heir.csvBlocks || 0).toFixed(1);
    row.innerHTML = `
      <div class="heir-row-head">
        <span>${tr('heir.number', { n: idx + 1 })}</span>
        <button type="button" class="btn-danger heir-remove-btn">${tr('heir.remove')}</button>
      </div>
      <div class="heir-row-grid">
        <label class="field field-full">
          <span>${tr('heir.label.label')}</span>
          <input type="text" class="heir-label" value="${heir.label.replace(/"/g, '&quot;')}" autocomplete="off">
        </label>
        <label class="field field-full">
          <span>${tr('heir.key.label')}</span>
          <input type="text" class="heir-key mono" value="${heir.keyText.replace(/"/g, '&quot;')}" placeholder="[fgp/86h/0h/0h]xpub..." autocomplete="off">
        </label>
        <p class="hint field-full" style="margin:-0.6rem 0 0;">${tr('heir.key.hint')}</p>
        <label class="field">
          <span>${tr('heir.csvBlocks.label')}</span>
          <input type="number" class="heir-csv" min="1" max="65535" step="1" value="${heir.csvBlocks}">
        </label>
        <p class="hint heir-csv-days" style="align-self:end;margin:0 0 0.9rem;">${tr('heir.csvBlocks.hint', { days })}</p>
        <label class="field">
          <span>${tr('heir.amount.label')}</span>
          <input type="number" class="heir-amount" min="0" step="0.00000001" value="${heir.amountBtc}">
        </label>
      </div>
    `;
    row.querySelector('.heir-remove-btn').addEventListener('click', () => {
      readHeirRowsIntoState();
      state.heirs = state.heirs.filter((h) => h.id !== heir.id);
      renderHeirRows();
    });
    row.querySelector('.heir-csv').addEventListener('input', (ev) => {
      const d = csvBlocksToApproxDays(parseInt(ev.target.value, 10) || 0).toFixed(1);
      row.querySelector('.heir-csv-days').textContent = tr('heir.csvBlocks.hint', { days: d });
    });
    container.appendChild(row);
  });
}

function buildVaultsFromForm() {
  setError('setup-error', null);
  state.network = $('network-select').value;
  const { network, expectedTestnet } = networkFor(state.network);
  state.ownerKeyText = $('owner-key-input').value;
  readHeirRowsIntoState();

  let ownerSigner;
  try {
    ownerSigner = parseSignerKey(state.ownerKeyText, expectedTestnet);
  } catch (err) {
    setError('setup-error', tr('error.ownerKeyInvalid', { msg: err.message }));
    return null;
  }
  if (!state.heirs.length) {
    setError('setup-error', tr('error.noHeirs'));
    return null;
  }

  const entries = [];
  for (let i = 0; i < state.heirs.length; i++) {
    const h = state.heirs[i];
    if (!Number.isInteger(h.csvBlocks) || h.csvBlocks < 1 || h.csvBlocks > 0xffff) {
      setError('setup-error', tr('error.csvInvalid', { label: h.label || `#${i + 1}` }));
      return null;
    }
    let heirSigner;
    try {
      heirSigner = parseSignerKey(h.keyText, expectedTestnet);
    } catch (err) {
      setError('setup-error', tr('error.heirKeyInvalid', { label: h.label || `#${i + 1}`, msg: err.message }));
      return null;
    }
    const ownerDerivationIndex = i;
    const heirDerivationIndex = 0;
    const ownerXOnlyPubkey = deriveChildXOnlyPubkey(ownerSigner, ownerDerivationIndex);
    const heirXOnlyPubkey = deriveChildXOnlyPubkey(heirSigner, heirDerivationIndex);
    const vault = buildHeirVault({ ownerXOnlyPubkey, heirXOnlyPubkey, csvBlocks: h.csvBlocks, network });
    entries.push({
      label: h.label || `#${i + 1}`,
      vault,
      ownerSigner,
      heirSigner,
      ownerDerivationIndex,
      heirDerivationIndex,
      amountSatsPlanned: btcToSats(h.amountBtc),
    });
  }
  state.ownerSignerKeyText = state.ownerKeyText.trim();
  return entries;
}

function initSetupScreen() {
  $('add-heir-btn').addEventListener('click', () => { readHeirRowsIntoState(); addHeirRow(); });
  $('setup-back-btn').addEventListener('click', () => showScreen('intro'));
  $('setup-generate-btn').addEventListener('click', () => {
    const entries = buildVaultsFromForm();
    if (!entries) return;
    state.vaults = entries;
    renderResult();
    showScreen('result');
  });
  addHeirRow();
}

// ---------- Result ----------

function renderResult() {
  const list = $('vault-list');
  list.innerHTML = '';
  for (const entry of state.vaults) {
    const days = csvBlocksToApproxDays(entry.vault.csvBlocks).toFixed(1);
    const amountBtc = entry.amountSatsPlanned != null ? (Number(entry.amountSatsPlanned) / 1e8).toFixed(8) : '—';
    const card = document.createElement('div');
    card.className = 'vault-card';
    card.innerHTML = `
      <h3>${entry.label}</h3>
      <dl class="kv">
        <dt>${tr('vault.address.label')}</dt><dd class="mono">${entry.vault.address}</dd>
        <dt>${tr('vault.csv.label')}</dt><dd>${tr('vault.csv.value', { blocks: entry.vault.csvBlocks, days })}</dd>
        <dt>${tr('vault.amount.label')}</dt><dd>${amountBtc} BTC</dd>
      </dl>
      <div class="actions-row">
        <button type="button" class="btn-secondary vault-download-kit-btn">${tr('vault.download.kit')}</button>
      </div>
    `;
    card.querySelector('.vault-download-kit-btn').addEventListener('click', () => {
      const kit = buildHeirClaimKit({
        vault: entry.vault,
        label: entry.label,
        heirSigner: entry.heirSigner,
        heirDerivationIndex: entry.heirDerivationIndex,
        network: state.network,
        amountSatsPlanned: entry.amountSatsPlanned != null ? entry.amountSatsPlanned.toString() : null,
      });
      downloadText(`kit-heredero-${slug(entry.label)}.json`, JSON.stringify(kit, null, 2));
    });
    list.appendChild(card);
  }
  $('encrypt-password-input').value = '';
  paintStrength();
}

function slug(text) {
  return text.toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'heredero';
}

function ownerRegistryJson() {
  const registry = buildOwnerRegistry({
    ownerSignerKeyText: state.ownerSignerKeyText,
    network: state.network,
    entries: state.vaults.map((e) => ({
      vault: e.vault,
      label: e.label,
      ownerDerivationIndex: e.ownerDerivationIndex,
      heirSigner: e.heirSigner,
      amountSatsPlanned: e.amountSatsPlanned != null ? e.amountSatsPlanned.toString() : null,
    })),
  });
  return JSON.stringify(registry, null, 2);
}

function paintStrength() {
  const bits = estimatePassphraseBits($('encrypt-password-input').value);
  const bars = $('encryptStrengthMeter').children;
  let level = 0, label = tr('strength.emptyPassphrase'), color = 'var(--border)';
  if (bits > 0) {
    if (bits < 30) { level = 1; label = tr('strength.weak'); color = 'var(--danger)'; }
    else if (bits < 45) { level = 2; label = tr('strength.fair'); color = '#e0a53e'; }
    else if (bits < 65) { level = 3; label = tr('strength.good'); color = 'var(--accent)'; }
    else { level = 4; label = tr('strength.strong'); color = 'var(--ok)'; }
  }
  Array.from(bars).forEach((bar, i) => { bar.style.background = i < level ? color : 'var(--border)'; });
  $('encryptStrengthLabel').textContent = label;
}

function initResultScreen() {
  $('result-download-registry-btn').addEventListener('click', () => {
    downloadText('registro-owner-boveda-herencia.json', ownerRegistryJson());
  });
  $('result-restart-btn').addEventListener('click', () => {
    state.heirs = [];
    state.vaults = [];
    $('owner-key-input').value = '';
    renderHeirRows();
    addHeirRow();
    showScreen('setup');
  });
  $('encrypt-password-input').addEventListener('input', paintStrength);
  $('result-download-encrypted-btn').addEventListener('click', async () => {
    setError('encrypt-error', null);
    const password = $('encrypt-password-input').value;
    if (!password) { setError('encrypt-error', tr('error.emptyPassword')); return; }
    const blob = await encryptText(ownerRegistryJson(), password);
    downloadText('registro-owner-boveda-herencia-cifrado.txt', blob);
  });
}

// ---------- Claim ----------

function claimEntries(data) {
  if (data.kind === 'inheritance-vault-btc/heir-claim-kit') {
    return [{ role: 'heir', label: data.label, data }];
  }
  if (data.kind === 'inheritance-vault-btc/owner-registry') {
    return data.vaults.map((v) => ({ role: 'owner', label: v.label, data: { ...v, network: data.network, ownerSignerKeyText: data.ownerSignerKeyText } }));
  }
  throw new Error('Tipo de kit desconocido.');
}

function rebuildVaultFromEntry(entry) {
  const { network } = networkFor(entry.data.network);
  const ownerXOnlyPubkey = hex.decode(entry.data.ownerXOnlyPubkeyHex);
  const heirXOnlyPubkey = hex.decode(entry.data.heirXOnlyPubkeyHex);
  const vault = buildHeirVault({ ownerXOnlyPubkey, heirXOnlyPubkey, csvBlocks: entry.data.csvBlocks, network });
  if (vault.address !== entry.data.vaultAddress) {
    throw new Error('La dirección reconstruida no coincide con la del kit - los datos pueden estar corruptos.');
  }
  return vault;
}

function populateVaultSelect() {
  const wrap = $('claim-vault-select-wrap');
  const select = $('claim-vault-select');
  select.innerHTML = '';
  if (state.claim.entries.length <= 1) { wrap.hidden = true; return; }
  wrap.hidden = false;
  state.claim.entries.forEach((entry, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = entry.label;
    select.appendChild(opt);
  });
}

function onClaimKitParsed() {
  setError('claim-kit-error', null);
  try {
    const data = parseClaimKitText($('claim-kit-input').value);
    state.claim.data = data;
    state.claim.entries = claimEntries(data);
    state.claim.selectedIndex = 0;
    populateVaultSelect();
    $('claim-details-panel').hidden = false;
    const entry = state.claim.entries[0];
    $('claim-derivation-index-input').value = entry.role === 'heir' ? entry.data.heirDerivationIndex : entry.data.ownerDerivationIndex;
  } catch (err) {
    setError('claim-kit-error', tr('error.claimKitInvalid', { msg: err.message }));
    $('claim-details-panel').hidden = true;
  }
}

function initClaimScreen() {
  $('claim-kit-input').addEventListener('change', onClaimKitParsed);
  $('claim-vault-select').addEventListener('change', (ev) => {
    state.claim.selectedIndex = parseInt(ev.target.value, 10);
    const entry = state.claim.entries[state.claim.selectedIndex];
    $('claim-derivation-index-input').value = entry.role === 'heir' ? entry.data.heirDerivationIndex : entry.data.ownerDerivationIndex;
  });

  const fileInput = $('claim-kit-file-input');
  $('claim-kit-file-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      $('claim-kit-input').value = (await file.text()).trim();
      onClaimKitParsed();
    } catch (err) {
      setError('claim-kit-error', tr('error.fileReadFailed', { msg: err.message }));
    }
  });

  $('claim-build-btn').addEventListener('click', () => {
    setError('claim-build-error', null);
    $('claim-output-panel').hidden = true;
    try {
      const entry = state.claim.entries[state.claim.selectedIndex];
      const vault = rebuildVaultFromEntry(entry);
      const derivationIndex = parseInt($('claim-derivation-index-input').value, 10);
      const utxo = {
        txid: $('claim-txid-input').value.trim(),
        index: parseInt($('claim-vout-input').value, 10),
        amount: BigInt($('claim-amount-input').value),
      };
      const destinationAddress = $('claim-destination-input').value.trim();
      const feeSats = BigInt($('claim-fee-input').value);

      let tx;
      if (entry.role === 'owner') {
        const signerKey = parseSignerKey(entry.data.ownerSignerKeyText, networkFor(entry.data.network).expectedTestnet);
        const xOnlyPubkey = deriveChildXOnlyPubkey(signerKey, derivationIndex);
        if (hex.encode(xOnlyPubkey) !== entry.data.ownerXOnlyPubkeyHex) {
          throw new Error('El índice de derivación no reconstruye la clave del owner de esta bóveda - revisalo.');
        }
        const ownerSigner = { xOnlyPubkey, fingerprint: signerKey.fingerprint, path: childNumericPath(signerKey, derivationIndex) };
        tx = buildOwnerReclaimPsbt({ vault, utxo, destinationAddress, feeSats, ownerSigner });
      } else {
        const signerKey = parseSignerKey(entry.data.heirSignerKeyText, networkFor(entry.data.network).expectedTestnet);
        const xOnlyPubkey = deriveChildXOnlyPubkey(signerKey, derivationIndex);
        if (hex.encode(xOnlyPubkey) !== entry.data.heirXOnlyPubkeyHex) {
          throw new Error('El índice de derivación no reconstruye tu clave de heredero para esta bóveda - revisalo.');
        }
        const heirSigner = { xOnlyPubkey, fingerprint: signerKey.fingerprint, path: childNumericPath(signerKey, derivationIndex) };
        tx = buildHeirClaimPsbt({ vault, utxo, destinationAddress, feeSats, heirSigner });
      }

      const b64 = psbtBase64(tx);
      $('claim-output').value = b64;
      $('claim-output-panel').hidden = false;
    } catch (err) {
      setError('claim-build-error', tr('error.buildFailed', { msg: err.message }));
    }
  });

  $('claim-download-btn').addEventListener('click', () => {
    downloadText('reclamo-boveda-herencia-psbt.txt', $('claim-output').value);
  });

  $('claim-back-btn').addEventListener('click', () => showScreen('intro'));
}

// ---------- Boot ----------

function init() {
  initTopbar();
  initIntroScreen();
  initSetupScreen();
  initResultScreen();
  initClaimScreen();
  applyTranslations();
  showScreen('intro');
}

init();
