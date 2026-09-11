import zxcvbn from 'zxcvbn';

// Copied from paper-wallet-btc's src/lib/strength.js verbatim - same
// reasoning applies unchanged to this tool's encryption password field.

/**
 * Upper-bound entropy per word for a diceware-style passphrase: log2(7776)
 * ~= 12.9 bits, assuming words are drawn uniformly from the EFF large
 * wordlist. This is the "right" rate for randomly chosen words.
 */
const DICEWARE_BITS_PER_WORD = 12.9;

/**
 * Natural-language sentences carry far less entropy than the same number of
 * randomly chosen words (~1-2 bits/word once word order and grammar are
 * predictable). Deliberately low so a sentence can never read as "strong".
 */
const NATURAL_BITS_PER_WORD = 2;

/** Letters only, Latin-1 (covers Spanish precomposed accents and ñ/Ñ). */
const LETTER_ONLY = /^[A-Za-zÀ-ÿ]+$/;

/**
 * Rough entropy estimate for a passphrase/password, in bits. Deliberately
 * conservative: for a security meter, underestimating is safer than
 * overestimating - the failure mode we must avoid is telling a user that a
 * weak phrase is "strong".
 *
 * Strategy:
 *   - Multi-word phrases are scored by word count, not character count. A
 *     long sentence is not a strong secret, and character-based formulas
 *     (length x log2(charset)) grossly overestimate natural language.
 *   - "Natural sentence" is detected by the share of 1-3 letter function
 *     words ("el, la, de, es, y, a, the, is, of, but..."), which is
 *     language-agnostic. Diceware words are almost always 4+ letters.
 *   - Single-token inputs (or anything with digits/symbols) fall through to
 *     zxcvbn, which reliably catches common passwords, keyboard patterns,
 *     repeats, sequences and dates - but whose dictionaries are
 *     English-only, so it is not trusted for space-separated phrases.
 */
export function estimatePassphraseBits(pass) {
  if (!pass) return 0;

  const words = pass.trim().split(/\s+/);

  if (words.length >= 2 && words.every((w) => LETTER_ONLY.test(w))) {
    const shortWords = words.filter((w) => w.length <= 3).length;
    const natural = shortWords / words.length >= 0.25;
    return words.length * (natural ? NATURAL_BITS_PER_WORD : DICEWARE_BITS_PER_WORD);
  }

  return zxcvbn(pass).guesses_log10 * Math.log2(10);
}
