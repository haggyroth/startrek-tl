/**
 * Invariants over the real scrape.
 *
 * The cache (data/events.raw.json) is gitignored — it is large and holds
 * Memory Alpha wikitext verbatim — so these tests skip when it is absent. That
 * means they run locally and not in CI, which is deliberate: the committed
 * fixture covers structure, and this covers the messy reality of the corpus.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { parseYearPage } from "../scripts/lib/parse-year.js";

const CACHE = "data/events.raw.json";
const skip = existsSync(CACHE) ? false : "no local scrape cache";

const pages = skip
  ? []
  : Object.entries(JSON.parse(readFileSync(CACHE, "utf8")))
      .filter(([key, value]) => key.startsWith("ma:") && value)
      .map(([key, value]) => [Number(key.slice(3)), value])
      .filter(([year]) => Number.isFinite(year));

const parsed = pages.flatMap(([year, wikitext]) => parseYearPage(wikitext, year).events);

test("the cache parses without throwing", { skip }, () => {
  assert.ok(pages.length > 100, `expected the full range, got ${pages.length} pages`);
  assert.ok(parsed.length > 1500, `expected >1500 events, got ${parsed.length}`);
});

test("no summary leaks wiki markup", { skip }, () => {
  const bad = parsed.filter((e) => /\{\{|\}\}|\[\[|\]\]|\|/.test(e.summary));
  assert.deepEqual(bad.map((e) => e.id).slice(0, 5), []);
});

test("no summary is left holding citation debris", { skip }, () => {
  const bad = parsed.filter((e) => /\(\s*[;,]|\(\s*\)/.test(e.summary));
  assert.deepEqual(bad.map((e) => e.summary).slice(0, 5), []);
});

test("ids are unique across the whole corpus", { skip }, () => {
  const seen = new Set();
  const dupes = [];
  for (const e of parsed) {
    if (seen.has(e.id)) dupes.push(e.id);
    seen.add(e.id);
  }
  assert.deepEqual(dupes.slice(0, 5), []);
});

test("every event has the fields the UI depends on", { skip }, () => {
  for (const e of parsed) {
    assert.ok(Number.isInteger(e.year), e.id);
    assert.ok(typeof e.summary === "string" && e.summary.length > 0, e.id);
    assert.ok(Array.isArray(e.series), e.id);
    assert.ok(Array.isArray(e.episodes), e.id);
    assert.ok(["prime", "kelvin", "mirror", "alternate"].includes(e.timeline), e.id);
  }
});

test("dates are ISO and never widened past what is known", { skip }, () => {
  for (const e of parsed) {
    if (!e.date) continue;
    assert.match(e.date, /^\d{4}(-\d{2}){1,2}$/, `${e.id}: ${e.date}`);
    assert.ok(e.date.startsWith(String(e.year)), `${e.id}: ${e.date} vs year ${e.year}`);
  }
});

// Stardates are literal strings taken from the episode, never computed. A
// numeric type here would invite arithmetic that the TOS era cannot support.
test("stardates are literal strings", { skip }, () => {
  for (const e of parsed) {
    if (e.stardate == null) continue;
    assert.equal(typeof e.stardate, "string", e.id);
    assert.match(e.stardate, /^\d+(\.\d+)?$/, `${e.id}: ${e.stardate}`);
  }
});

test("parsing the corpus twice gives identical output", { skip }, () => {
  const again = pages.flatMap(([year, wikitext]) => parseYearPage(wikitext, year).events);
  assert.equal(again.length, parsed.length);
  assert.deepEqual(again.map((e) => e.id), parsed.map((e) => e.id));
});
