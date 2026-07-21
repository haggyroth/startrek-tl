/**
 * Phase 2 spike: parse a single year and report on the result.
 *
 * 2373 is the deliberate test case — a Dominion War year, so it's dense,
 * multi-series, and includes a film, an alternate timeline, and time travel to
 * two other centuries. If the parser survives 2373 it will survive a quiet
 * decade.
 *
 * Usage: node scripts/spike-2373.js [year]
 */

import { writeFile } from "node:fs/promises";
import { fetchWikitext } from "./lib/api.js";
import { parseYearPage } from "./lib/parse-year.js";

const year = Number(process.argv[2] ?? 2373);

const wikitext = await fetchWikitext(String(year));
if (!wikitext) {
  console.error(`No page found for ${year}`);
  process.exit(1);
}

const result = parseYearPage(wikitext, year);
const { events, stardateRange } = result;

const bySeries = {};
for (const e of events) {
  for (const s of e.series.length ? e.series : ["(none)"]) {
    bySeries[s] = (bySeries[s] ?? 0) + 1;
  }
}

const noCitation = events.filter((e) => e.episodes.length === 0);
const nonPrime = events.filter((e) => e.timeline !== "prime");

console.log(`\n=== ${year} ===`);
console.log(`stardate range : ${stardateRange ? `${stardateRange.start} – ${stardateRange.end}` : "none"}`);
console.log(`events parsed  : ${events.length}`);
console.log(`by series      : ${Object.entries(bySeries).map(([k, v]) => `${k}=${v}`).join("  ")}`);
console.log(`no citation    : ${noCitation.length}`);
console.log(`non-prime      : ${nonPrime.length}`);

console.log(`\n--- sample events ---`);
for (const e of events.slice(0, 8)) {
  const cites = e.episodes.map((x) => `${x.series}: ${x.title}`).join("; ") || "—";
  console.log(`\n[${e.id}]`);
  console.log(`  group   : ${e.group ?? "—"}`);
  console.log(`  summary : ${e.summary}`);
  console.log(`  cites   : ${cites}`);
  console.log(`  timeline: ${e.timeline}`);
}

if (noCitation.length) {
  console.log(`\n--- events with no episode citation (review these) ---`);
  for (const e of noCitation) console.log(`  • ${e.summary.slice(0, 110)}`);
}

if (nonPrime.length) {
  console.log(`\n--- flagged non-prime (heuristic, verify by hand) ---`);
  for (const e of nonPrime) console.log(`  • [${e.timeline}] ${e.summary.slice(0, 100)}`);
}

const out = `data/spike-${year}.json`;
await writeFile(out, JSON.stringify(result, null, 2) + "\n");
console.log(`\nWrote ${out}\n`);
