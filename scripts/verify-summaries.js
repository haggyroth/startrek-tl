/**
 * Verify authored summaries against the source they were written from.
 *
 * Authored prose is written from the fact record rather than paraphrased, which
 * is the point — but it also means nothing structural stops a summary from
 * drifting: a mistyped name, a wrong year, a detail imported from the wrong
 * event. This checks the two things that can be checked mechanically:
 *
 *   1. Every proper noun and number in the authored text also appears in the
 *      source bullet. New ones are the signature of a fabrication or a typo.
 *   2. Dates and stardates agree with the year page they came from.
 *
 * It cannot check that the summary means the same thing — that needs a human,
 * and the sampling procedure for it is documented in the README.
 *
 * Needs the local scrape cache, so it runs locally and not in CI.
 *
 * Usage: node scripts/verify-summaries.js [--verbose]
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { parseYearPage } from "./lib/parse-year.js";
import { parseCenturyPage } from "./lib/parse-century.js";

const VERBOSE = process.argv.includes("--verbose");
const CACHE = "data/events.raw.json";

if (!existsSync(CACHE)) {
  console.error(`No scrape cache at ${CACHE}. Run: node scripts/build-events.js`);
  process.exit(2);
}

const cache = JSON.parse(await readFile(CACHE, "utf8"));
const dataset = JSON.parse(await readFile("data/events.json", "utf8"));

/**
 * Reviewed deviations, each with its reasoning — same pattern as
 * data/timeline-overrides.json. A token here has been looked at and accepted,
 * usually because the source itself is inconsistent.
 */
const exceptions = JSON.parse(await readFile("data/verify-exceptions.json", "utf8"));

// ---- rebuild the source text for every event ----

const sourceById = new Map();
const rangeByYear = new Map();

for (const [key, wikitext] of Object.entries(cache)) {
  if (!key.startsWith("ma:") || !wikitext) continue;
  const title = key.slice(3);
  const year = Number(title);

  if (Number.isFinite(year)) {
    const parsed = parseYearPage(wikitext, year);
    if (parsed.stardateRange) rangeByYear.set(year, parsed.stardateRange);
    for (const e of parsed.events) sourceById.set(e.id, e);
  } else if (/century$/i.test(title)) {
    const url = `https://memory-alpha.fandom.com/wiki/${encodeURIComponent(title)}`;
    for (const e of parseCenturyPage(wikitext, url).events) sourceById.set(e.id, e);
  }
}

// ---- checks ----

/**
 * Tokens worth tracing: proper nouns and numbers. Lowercase words are ordinary
 * vocabulary and say nothing about whether the facts match.
 */
function significantTokens(text) {
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

/** Split text into comparable words, keeping internal hyphens and apostrophes. */
function words(text) {
  return text
    .split(/[\s(),;:"]+/)
    .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9']+$/g, ""))
    .filter(Boolean);
}

/** Numbers written as words in one text and digits in the other, and vice versa. */
const NUMBER_WORDS = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7",
  eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13",
  twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60",
  seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000",
  million: "1000000", billion: "1000000000",
};

function normalise(text) {
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
function stem(token) {
  return token
    .toLowerCase()
    // "13th" and "23rd" are the same fact as "13" and "23".
    .replace(/^(\d+)(?:st|nd|rd|th)$/, "$1")
    .replace(/[^a-z0-9]/g, "")
    .replace(/(?:s|es|ns|ian|ians|an|ans)$/, "");
}

/** True if either stem contains the other — enough to call it the same name. */
function related(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

const problems = [];
let checked = 0;
let missingSource = 0;

for (const event of dataset.events) {
  if (event.prose !== "authored") continue;

  const source = sourceById.get(event.id);
  if (!source) {
    missingSource++;
    continue;
  }
  checked++;

  // The entity list is part of the fact record, so a name drawn from it is
  // traceable even when the cleaned prose spells it differently.
  const haystack = normalise(`${source.summary} ${(source.entities ?? []).join(" ")}`);

  // Stem the source with the same tokenizer, so both sides reduce identically.
  const sourceStems = new Set(
    words(`${source.summary} ${(source.entities ?? []).join(" ")}`)
      .map(stem)
      .filter(Boolean),
  );

  const introduced = [];
  for (const token of significantTokens(event.summary)) {
    const needle = normalise(token).trim();
    if (!needle) continue;
    if (haystack.includes(` ${needle} `)) continue;

    const target = stem(token);
    if (!target) continue;
    if ([...sourceStems].some((s) => related(s, target))) continue;

    introduced.push(token);
  }

  const allowed = new Set(exceptions[event.id]?.tokens ?? []);
  const unexplained = introduced.filter((t) => !allowed.has(t));

  if (unexplained.length) {
    problems.push({
      id: event.id,
      kind: "introduced",
      detail: unexplained.join(", "),
      authored: event.summary,
      source: source.summary,
    });
  }

  // Dates must agree with the year the event is filed under.
  if (event.date && !event.date.startsWith(String(event.year))) {
    problems.push({ id: event.id, kind: "date-year", detail: event.date });
  }

  // Stardates should fall inside the year page's own declared range. A sidebar
  // giving a single value is not a range — 2233 lists only 2233.04 while its
  // events carry others — so it constrains nothing.
  const range = rangeByYear.get(event.year);
  if (event.stardate && range && range.start !== range.end) {
    const value = Number(event.stardate);
    const lo = Number(range.start);
    const hi = Number(range.end);
    // TOS-era ranges run backwards within a year, so compare against both ends.
    const min = Math.min(lo, hi);
    const max = Math.max(lo, hi);
    if (Number.isFinite(value) && Number.isFinite(min) && (value < min || value > max)) {
      problems.push({
        id: event.id,
        kind: "stardate-range",
        detail: `${event.stardate} outside ${range.start}–${range.end}`,
      });
    }
  }
}

// ---- report ----

const byKind = {};
for (const p of problems) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;

console.log(`authored checked : ${checked}`);
if (missingSource) console.log(`no source found  : ${missingSource} (id changed since authoring?)`);
console.log(`flagged          : ${problems.length}`);
for (const [kind, n] of Object.entries(byKind)) console.log(`  ${kind}: ${n}`);

if (problems.length) {
  console.log();
  for (const p of problems.slice(0, VERBOSE ? problems.length : 25)) {
    console.log(`[${p.kind}] ${p.id}`);
    console.log(`   ${p.detail}`);
    if (p.authored) {
      console.log(`   authored: ${p.authored.slice(0, 110)}`);
      console.log(`   source  : ${p.source.slice(0, 110)}`);
    }
  }
  if (!VERBOSE && problems.length > 25) {
    console.log(`\n… ${problems.length - 25} more (use --verbose)`);
  }
}

// Flagged items need a human decision, so this reports rather than gates.
process.exit(0);
