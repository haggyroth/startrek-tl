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
import { introducedTokens, isStardateOutOfRange } from "./lib/verify-text.js";

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
  const sourceText = `${source.summary} ${(source.entities ?? []).join(" ")}`;
  const introduced = introducedTokens(event.summary, sourceText);

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

  // Stardates should fall inside the year page's own declared range — but
  // only from 2323 onward. See isStardateOutOfRange for why.
  const range = rangeByYear.get(event.year);
  if (event.stardate && isStardateOutOfRange(event.stardate, event.year, range)) {
    problems.push({
      id: event.id,
      kind: "stardate-range",
      detail: `${event.stardate} outside ${range.start}–${range.end}`,
    });
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
