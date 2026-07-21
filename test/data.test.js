import test from "node:test";
import assert from "node:assert/strict";

import {
  yearToStardate,
  STARDATE_EPOCH_YEAR,
  binByYear,
  locationsByFrequency,
  seriesByFrequency,
} from "../src/js/data.js";

// TNG-era stardates only. The TOS era is inconsistent by design and has no
// calendar mapping — extrapolating the formula backward produces confident
// nonsense, so the function must refuse.
test("stardates are linear from 2323 and undefined before it", () => {
  assert.equal(yearToStardate(STARDATE_EPOCH_YEAR), 0);
  assert.equal(yearToStardate(2364), 41000);
  assert.equal(yearToStardate(2365), 42000);
  assert.equal(yearToStardate(2322), null);
  assert.equal(yearToStardate(2267), null);
});

const ev = (year, over = {}) => ({
  id: `${year}-${over.id ?? Math.random().toString(36).slice(2, 7)}`,
  year,
  series: over.series ?? ["TNG"],
  group: over.group ?? null,
});

test("binByYear covers every year in range, including empty ones", () => {
  const bins = binByYear([ev(2364), ev(2364), ev(2366)], [2364, 2367]);
  assert.equal(bins.length, 4);
  assert.deepEqual(
    bins.map((b) => b.count),
    [2, 0, 1, 0],
  );
});

// The stack index is what makes the curve the envelope of the dots.
test("binByYear assigns a contiguous stack index within each year", () => {
  const events = [ev(2364), ev(2364), ev(2364)];
  const [bin] = binByYear(events, [2364, 2364]);
  assert.deepEqual(
    bin.events.map((e) => e.stackIndex),
    [0, 1, 2],
  );
});

test("binByYear drops events outside the range", () => {
  const bins = binByYear([ev(2100), ev(2364), ev(2999)], [2364, 2364]);
  assert.equal(bins[0].count, 1);
});

test("locationsByFrequency ranks by count and ignores missing groups", () => {
  const events = [
    ev(2364, { group: "USS Enterprise" }),
    ev(2364, { group: "USS Enterprise" }),
    ev(2365, { group: "Deep Space 9" }),
    ev(2366, { group: null }),
  ];
  const out = locationsByFrequency(events);
  assert.deepEqual(out, [
    { name: "USS Enterprise", count: 2 },
    { name: "Deep Space 9", count: 1 },
  ]);
});

test("locationsByFrequency respects the limit and breaks ties by name", () => {
  const events = [
    ev(2364, { group: "Beta" }),
    ev(2364, { group: "Alpha" }),
    ev(2364, { group: "Gamma" }),
  ];
  assert.deepEqual(
    locationsByFrequency(events, 2).map((l) => l.name),
    ["Alpha", "Beta"],
  );
});

test("seriesByFrequency counts an event once per series", () => {
  const events = [
    ev(2364, { series: ["TNG", "DS9"] }),
    ev(2365, { series: ["TNG"] }),
  ];
  assert.deepEqual(seriesByFrequency(events), [
    { code: "TNG", count: 2 },
    { code: "DS9", count: 1 },
  ]);
});
