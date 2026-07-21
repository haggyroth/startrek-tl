/**
 * Build data/events.json for the full 2233–2402 range.
 *
 * Memory Alpha supplies event density; the Wikipedia overlay supplies timeline
 * classification and landmark tiers. Everything is served from the local cache
 * after the first run, so re-running costs no network requests.
 *
 * Usage: node scripts/build-events.js [--force] [--from YEAR] [--to YEAR]
 */

import { readFile, writeFile } from "node:fs/promises";
import { fetchWikitext, isCached, saveCache } from "./lib/api.js";
import { parseYearPage } from "./lib/parse-year.js";
import { parseCenturyPage } from "./lib/parse-century.js";
import { fetchOverlay } from "./lib/wikipedia.js";
import {
  applyOverlay,
  assignBaselineSignificance,
  applyTimelineOverrides,
  OVERLAY_SOURCE,
} from "./lib/overlay.js";
import { loadSummaries, applySummaries } from "./lib/summaries.js";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const FROM = Number(flag("from", 2063));
const TO = Number(flag("to", 2410));

/**
 * Where canon is thin Memory Alpha keeps no per-year pages — 3189 redirects to
 * "32nd century#3189" — so those eras are read from century pages instead.
 * They only contribute years beyond the per-year range, so nothing is counted
 * twice.
 */
const CENTURY_PAGES = [
  "25th century", "26th century", "27th century", "28th century",
  "29th century", "30th century", "31st century", "32nd century",
  "33rd century",
];
const FORCE = args.includes("--force");
/** Strict builds refuse to emit scraped prose — see lib/summaries.js. */
const STRICT = args.includes("--strict");

const events = [];
const years = [];
const missing = [];

console.log(`Fetching Memory Alpha year pages ${FROM}–${TO}…`);

for (let year = FROM; year <= TO; year++) {
  const cached = await isCached(String(year));
  const wikitext = await fetchWikitext(String(year), { force: FORCE });

  // Sparse years redirect to their century page; the century pass picks them up.
  if (!wikitext || /^\s*#redirect/i.test(wikitext)) {
    missing.push(year);
    continue;
  }

  const parsed = parseYearPage(wikitext, year);
  events.push(...parsed.events);
  years.push({ year, stardateRange: parsed.stardateRange, count: parsed.events.length });

  const mark = cached ? " " : "↓";
  if (parsed.events.length) {
    process.stdout.write(`\r${mark} ${year}: ${parsed.events.length} events   `);
  }
}

console.log(`\n\nFetching century pages…`);
let centuryEvents = 0;
for (const title of CENTURY_PAGES) {
  const wikitext = await fetchWikitext(title);
  if (!wikitext) continue;
  const url = `https://memory-alpha.fandom.com/wiki/${encodeURIComponent(title)}`;
  const parsed = parseCenturyPage(wikitext, url, { minYear: TO + 1 });
  events.push(...parsed.events);
  centuryEvents += parsed.events.length;
  if (parsed.events.length) process.stdout.write(`\r  ${title}: ${parsed.events.length} events   `);
}
console.log(`\n  ${centuryEvents} events from century pages`);

// Flush whatever the checkpointing left pending.
await saveCache();

console.log(`\n\nFetching Wikipedia overlay…`);
const overlay = await fetchOverlay({ minYear: FROM, maxYear: TO });
console.log(`  ${overlay.length} overlay entries`);

const { matched, unmatched, reclassified, conflicts } = applyOverlay(events, overlay);
assignBaselineSignificance(events);

const overrides = JSON.parse(await readFile("data/timeline-overrides.json", "utf8"));
const resolved = applyTimelineOverrides(events, overrides);

const authored = await loadSummaries();
const coverage = applySummaries(events, authored, { strict: STRICT });

// Stable ordering: chronological, then by id so unchanged records never move.
events.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

const timelines = {};
const seriesCounts = {};
for (const e of events) {
  timelines[e.timeline] = (timelines[e.timeline] ?? 0) + 1;
  for (const s of e.series) seriesCounts[s] = (seriesCounts[s] ?? 0) + 1;
}

const output = {
  meta: {
    generated: new Date().toISOString().slice(0, 10),
    range: [FROM, events.length ? Math.max(...events.map((e) => e.year)) : TO],
    eventCount: events.length,
    strict: STRICT,
    authoredSummaries: coverage.covered,
    sources: [
      {
        name: "Memory Alpha",
        url: "https://memory-alpha.fandom.com/",
        license: "CC BY-NC-SA",
        role: "event data",
      },
      {
        name: "Wikipedia — Timeline of Star Trek",
        url: OVERLAY_SOURCE,
        license: "CC BY-SA 4.0",
        role: "timeline classification and landmark tiers",
      },
    ],
  },
  years,
  events,
};

await saveCache();
await writeFile("data/events.json", JSON.stringify(output, null, 2) + "\n");

console.log(`\n=== summary ===`);
console.log(`events        : ${events.length}`);
console.log(`years covered : ${years.length}${missing.length ? ` (${missing.length} with no page or redirecting)` : ""}`);
console.log(`century pages : ${centuryEvents} events beyond ${TO}`);
console.log(`landmarks     : ${matched} matched, ${unmatched.length} overlay entries unmatched`);
console.log(`reclassified  : ${reclassified} events moved off the prime timeline`);
console.log(`conflicts     : ${conflicts} flagged, ${resolved.applied} resolved by hand, ${resolved.unresolved.length} open`);
if (resolved.stale.length) {
  console.log(`  stale overrides (no such event): ${resolved.stale.join(", ")}`);
}
console.log(`timelines     : ${Object.entries(timelines).map(([k, v]) => `${k}=${v}`).join("  ")}`);
console.log(`series        : ${Object.entries(seriesCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  ")}`);
const pct = ((100 * coverage.covered) / coverage.total).toFixed(1);
console.log(`authored      : ${coverage.covered}/${coverage.total} summaries (${pct}%)${STRICT ? " — strict" : ""}`);
console.log(`\nWrote data/events.json`);

if (unmatched.length) {
  await writeFile("data/unmatched-overlay.json", JSON.stringify(unmatched, null, 2) + "\n");
  console.log(`Wrote data/unmatched-overlay.json for review`);
}
