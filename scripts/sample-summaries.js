/**
 * Print a fixed-seed, era-stratified sample of authored summaries next to the
 * source bullet each was written from, for a human meaning-check.
 *
 * `verify:summaries` is exhaustive but mechanical — it can't tell whether a
 * sentence *means* the same thing as its source, only whether the proper
 * nouns, numbers, and dates line up. That judgment needs a person reading
 * pairs side by side, which doesn't scale to all ~2,000 records. This script
 * draws a reproducible sample instead: fixed seed, weighted toward the 24th
 * century since it's by far the largest era.
 *
 * The seed and era boundaries are deliberately hardcoded rather than exposed
 * as flags — the point is a single reproducible sample to re-run and diff
 * against, not an ad hoc query tool. Bump SEED to draw a fresh sample.
 *
 * Needs the local scrape cache, so it runs locally and not in CI.
 *
 * Usage: node scripts/sample-summaries.js
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { buildSourceIndex } from "./lib/source-index.js";

const CACHE = "data/events.raw.json";

if (!existsSync(CACHE)) {
  console.error(`No scrape cache at ${CACHE}. Run: node scripts/build-events.js`);
  process.exit(2);
}

const cache = JSON.parse(await readFile(CACHE, "utf8"));
const dataset = JSON.parse(await readFile("data/events.json", "utf8"));
const { sourceById } = buildSourceIndex(cache);

/** Mulberry32 — small, seedable, no dependency. */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Matches the era boundaries used throughout AUTHORING.md and ROADMAP.md.
// n is weighted toward the 24th century, which holds most of the dataset.
const ERAS = [
  { name: "2063-2100", from: 2063, to: 2100, n: 15 },
  { name: "ENT 2101-2161", from: 2101, to: 2161, n: 15 },
  { name: "Gap 2162-2232", from: 2162, to: 2232, n: 15 },
  { name: "23rd century 2233-2300", from: 2233, to: 2300, n: 15 },
  { name: "24th century 2301-2410", from: 2301, to: 2410, n: 30 },
  { name: "Far future 2411-3269", from: 2411, to: 3269, n: 15 },
];

const SEED = 20260723; // bump to redraw; document the new date/reasoning where the result is recorded
const rng = mulberry32(SEED);

let sampled = 0;
let unmatched = 0;

for (const era of ERAS) {
  const pool = dataset.events.filter(
    (e) => e.prose === "authored" && e.year >= era.from && e.year <= era.to,
  );
  const picked = shuffle(pool, rng).slice(0, Math.min(era.n, pool.length));
  sampled += picked.length;

  console.log(`\n=== ${era.name} (${picked.length}/${pool.length} sampled) ===`);
  for (const e of picked) {
    const src = sourceById.get(e.id);
    console.log(`\n[${e.id}]`);
    console.log(`  authored: ${e.summary}`);
    if (src) {
      console.log(`  source  : ${src.summary}`);
    } else {
      console.log(`  source  : <no automatic match — id changed since authoring, look up by hand>`);
      unmatched++;
    }
  }
}

console.log(`\n\nsampled   : ${sampled}`);
console.log(`unmatched : ${unmatched}`);
