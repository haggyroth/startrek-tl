/**
 * Pure text-matching helpers behind scripts/verify-summaries.js.
 *
 * Split out from the runnable script so they can be unit tested directly —
 * verify-summaries.js reads files and exits early when the scrape cache is
 * missing, which makes it an awkward thing to import in a test, the same
 * reason build-events.js and validate-data.js have no direct unit tests
 * either. This file has no side effects.
 */

/** Split text into comparable words, keeping internal hyphens and apostrophes. */
export function words(text) {
  return text
    .split(/[\s(),;:"]+/)
    .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9']+$/g, ""))
    .filter(Boolean);
}

/**
 * Tokens worth tracing: proper nouns and numbers. Lowercase words are ordinary
 * vocabulary and say nothing about whether the facts match.
 */
export function significantTokens(text) {
  const tokens = new Set();

  for (const [i, word] of words(text).entries()) {
    // Numbers, including years. "13th" yields "13". A mixed designation like
    // "917G" is a name, not a number, and is handled below.
    const number = word.match(/^(\d[\d.,]*)(?:st|nd|rd|th)?$/);
    if (number) {
      tokens.add(number[1].replace(/[.,]$/, ""));
      continue;
    }
    // A sentence-initial capital is grammar, not a name. Single letters are
    // initials ("James T. Kirk") and carry no fact of their own.
    if (i === 0 || word.length < 2) continue;
    if (/^[A-Z]/.test(word)) tokens.add(word);
  }

  return tokens;
}

/** Numbers written as words in one text and digits in the other, and vice versa. */
const NUMBER_WORDS = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7",
  eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13",
  twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60",
  seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000",
  million: "1000000", billion: "1000000000",
};

export function normalise(text) {
  let s = text.toLowerCase();
  for (const [word, digits] of Object.entries(NUMBER_WORDS)) {
    s = s.replaceAll(word, ` ${word} ${digits} `);
  }
  // Strip punctuation that differs between renderings.
  return ` ${s.replace(/[^a-z0-9']+/g, " ")} `;
}

/**
 * Reduce a token to a comparable stem.
 *
 * Possessives and plural or adjectival forms are the same fact stated
 * differently — "Archer's" for Archer, "Andoria" for Andorians, "Klingons" for
 * the Klingon Empire. Without this the check is almost all false positives.
 */
export function stem(token) {
  return token
    .toLowerCase()
    // "13th" and "23rd" are the same fact as "13" and "23".
    .replace(/^(\d+)(?:st|nd|rd|th)$/, "$1")
    // Strip a possessive before punctuation removal, not after. "Pike's" must
    // reduce to "pike", not merge into "pikes" and then have the generic "es"
    // suffix rule (meant for plurals like "colonies") over-strip it to "pik" —
    // any name ending in a silent "e" hit this once punctuation was gone first.
    .replace(/['’]s$/, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/(?:s|es|ns|ian|ians|an|ans)$/, "");
}

/** True if either stem contains the other — enough to call it the same name. */
export function related(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/**
 * Proper nouns or numbers in `authoredText` that cannot be traced back to
 * `sourceText` (summary plus entity list), after stemming. Used to catch a
 * fabricated or mistyped detail before it reaches the dataset.
 */
export function introducedTokens(authoredText, sourceText) {
  const haystack = normalise(sourceText);
  const sourceStems = new Set(words(sourceText).map(stem).filter(Boolean));

  const introduced = [];
  for (const token of significantTokens(authoredText)) {
    const needle = normalise(token).trim();
    if (!needle) continue;
    if (haystack.includes(` ${needle} `)) continue;

    const target = stem(token);
    if (!target) continue;
    if ([...sourceStems].some((s) => related(s, target))) continue;

    introduced.push(token);
  }
  return introduced;
}

/**
 * Stardates are linear only from 2323 onward (see src/js/data.js and
 * CLAUDE.md). Kept as a local copy rather than imported from the browser-side
 * module, so the Node pipeline in scripts/ doesn't reach into src/js/ — the
 * two are meant to stay decoupled.
 */
export const STARDATE_EPOCH_YEAR = 2323;

/**
 * Whether an event's stardate falls outside its year page's declared range —
 * but only from the epoch onward. Before it, stardates are inconsistent by
 * design (TOS-era stardates run non-monotonically within a year, sometimes
 * backward), so a year page's own declared range constrains nothing there;
 * checking it produced false positives on every pre-epoch year with a real
 * range, which is most of them.
 *
 * A range where start equals end is not a real range either — some sidebars
 * (2233, for instance) give a single value while their events carry others.
 *
 * @param {string} stardate literal stardate from the event
 * @param {number} year the event's year
 * @param {{start: string, end: string}|undefined} range the year page's sidebar range
 */
export function isStardateOutOfRange(stardate, year, range) {
  if (year < STARDATE_EPOCH_YEAR) return false;
  if (!range || range.start === range.end) return false;

  const value = Number(stardate);
  const lo = Math.min(Number(range.start), Number(range.end));
  const hi = Math.max(Number(range.start), Number(range.end));
  if (!Number.isFinite(value) || !Number.isFinite(lo)) return false;

  return value < lo || value > hi;
}
