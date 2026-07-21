/**
 * Validate the committed dataset.
 *
 * CI cannot rebuild data/events.json — the scrape cache is gitignored, and
 * re-fetching Memory Alpha on every push would be rude. So instead of checking
 * that the build reproduces, this checks that what is committed is internally
 * consistent and matches the documented schema.
 *
 * Exits non-zero on the first category of failure so CI fails loudly.
 *
 * Usage: node scripts/validate-data.js
 */

import { readFile } from "node:fs/promises";

const TIMELINES = new Set(["prime", "kelvin", "mirror", "alternate"]);
const SERIES = new Set([
  "TOS", "TAS", "TNG", "DS9", "VOY", "ENT",
  "DIS", "PIC", "LD", "PRO", "SNW", "ST", "FILM",
]);

const problems = [];
const fail = (message) => problems.push(message);

const dataset = JSON.parse(await readFile("data/events.json", "utf8"));
const authored = JSON.parse(await readFile("data/summaries.json", "utf8"));
const overrides = JSON.parse(await readFile("data/timeline-overrides.json", "utf8"));
const { events, meta } = dataset;

// ---- shape ----

if (!Array.isArray(events) || !events.length) fail("events array is missing or empty");
if (!meta?.range || meta.range.length !== 2) fail("meta.range is missing");
if (meta.eventCount !== events.length) {
  fail(`meta.eventCount ${meta.eventCount} != actual ${events.length}`);
}

// ---- per-event ----

const seen = new Set();
let prevYear = -Infinity;
let prevId = "";

for (const e of events) {
  const at = e.id ?? "(no id)";

  if (!e.id) fail(`event without an id at year ${e.year}`);
  if (seen.has(e.id)) fail(`duplicate id: ${e.id}`);
  seen.add(e.id);

  if (!Number.isInteger(e.year)) fail(`${at}: year is not an integer`);
  else if (e.year < meta.range[0] || e.year > meta.range[1]) {
    fail(`${at}: year ${e.year} outside meta.range`);
  }

  if (typeof e.summary !== "string" || !e.summary.trim()) fail(`${at}: empty summary`);
  else if (/\{\{|\}\}|\[\[|\]\]/.test(e.summary)) fail(`${at}: summary retains wiki markup`);

  if (!TIMELINES.has(e.timeline)) fail(`${at}: unknown timeline ${e.timeline}`);
  if (!["authored", "source"].includes(e.prose)) fail(`${at}: unknown prose ${e.prose}`);

  if (!Array.isArray(e.series)) fail(`${at}: series is not an array`);
  else for (const s of e.series) if (!SERIES.has(s)) fail(`${at}: unknown series code ${s}`);

  if (!Array.isArray(e.episodes)) fail(`${at}: episodes is not an array`);
  if (!Array.isArray(e.sources) || !e.sources.length) fail(`${at}: no sources`);

  if (e.date != null) {
    if (!/^\d{4}(-\d{2}){1,2}$/.test(e.date)) fail(`${at}: malformed date ${e.date}`);
    else if (!e.date.startsWith(String(e.year))) fail(`${at}: date ${e.date} contradicts year`);
  }

  // Literal, never computed — see CLAUDE.md on stardate non-linearity.
  if (e.stardate != null && typeof e.stardate !== "string") {
    fail(`${at}: stardate must be a string, got ${typeof e.stardate}`);
  }

  if (!Number.isInteger(e.significance) || e.significance < 1 || e.significance > 5) {
    fail(`${at}: significance out of range (${e.significance})`);
  }

  // Ordering must be stable so regenerating produces a reviewable diff.
  if (e.year < prevYear || (e.year === prevYear && e.id < prevId)) {
    fail(`${at}: dataset is not sorted by (year, id)`);
  }
  prevYear = e.year;
  prevId = e.id;
}

// ---- authored summaries ----

const ids = new Set(events.map((e) => e.id));
for (const id of Object.keys(authored)) {
  if (!ids.has(id)) fail(`summaries.json references an unknown event: ${id}`);
  if (!authored[id]?.trim()) fail(`summaries.json has an empty summary for ${id}`);
}

const authoredEvents = events.filter((e) => e.prose === "authored");
for (const e of authoredEvents) {
  if (!authored[e.id]) fail(`${e.id}: marked authored but absent from summaries.json`);
  else if (authored[e.id] !== e.summary) fail(`${e.id}: summary differs from summaries.json`);
}

// Landmarks are the events readers actually hover; they must be rewritten.
const unauthoredLandmarks = events.filter((e) => e.significance >= 4 && e.prose !== "authored");
if (unauthoredLandmarks.length) {
  fail(
    `${unauthoredLandmarks.length} events at significance >=4 still carry scraped prose ` +
      `(first: ${unauthoredLandmarks[0].id})`,
  );
}

// ---- hand-reviewed timeline resolutions ----

for (const [id, decision] of Object.entries(overrides)) {
  if (!ids.has(id)) fail(`timeline-overrides.json references an unknown event: ${id}`);
  if (!TIMELINES.has(decision?.timeline)) fail(`${id}: override has an invalid timeline`);
  // The reasoning is the point of the file — an override without it is just an
  // unexplained edit that nobody can review later.
  if (!decision?.note?.trim()) fail(`${id}: override has no explanatory note`);
}

const openConflicts = events.filter((e) => e.timelineConflict);
if (openConflicts.length) {
  fail(
    `${openConflicts.length} unresolved timelineConflict event(s); resolve them in ` +
      `data/timeline-overrides.json (first: ${openConflicts[0].id})`,
  );
}

// ---- report ----

const coverage = ((100 * authoredEvents.length) / events.length).toFixed(1);
console.log(`events    : ${events.length}`);
console.log(`authored  : ${authoredEvents.length} (${coverage}%)`);
console.log(`range     : ${meta.range[0]}–${meta.range[1]}`);
console.log(`overrides : ${Object.keys(overrides).length} hand-reviewed timeline resolutions`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.error(`  - ${p}`);
  if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
  process.exit(1);
}

console.log("\nDataset valid.");
