/**
 * state.js is a browser module. It touches only `location` and `history`, so
 * stubbing those two globals is enough to exercise it under Node.
 */
import test from "node:test";
import assert from "node:assert/strict";

function stubBrowser(hash = "") {
  globalThis.location = { hash, pathname: "/src/", search: "" };
  globalThis.history = {
    replaceState(_state, _title, url) {
      const i = String(url).indexOf("#");
      globalThis.location.hash = i === -1 ? "" : String(url).slice(i);
    },
  };
}

stubBrowser();
const { readHash, writeHash, applyFilters, DEFAULT_STATE, FULL_RANGE } = await import(
  "../src/js/state.js"
);

test("an empty hash yields the defaults", () => {
  stubBrowser("");
  const state = readHash();
  assert.equal(state.timeline, DEFAULT_STATE.timeline);
  assert.equal(state.series, null);
  assert.equal(state.location, null);
  assert.equal(state.years, null);
});

test("hash round-trips through write and read", () => {
  stubBrowser("");
  writeHash({
    timeline: "all",
    series: new Set(["VOY", "TNG"]),
    location: "USS Voyager",
    years: [2371, 2378],
  });

  const state = readHash();
  assert.equal(state.timeline, "all");
  assert.deepEqual([...state.series].sort(), ["TNG", "VOY"]);
  assert.equal(state.location, "USS Voyager");
  assert.deepEqual(state.years, [2371, 2378]);
});

test("defaults are omitted from the hash", () => {
  stubBrowser("");
  writeHash({ timeline: "prime", series: null, location: null, years: null });
  assert.equal(globalThis.location.hash, "");
});

test("series order in the hash is stable", () => {
  stubBrowser("");
  writeHash({ ...DEFAULT_STATE, series: new Set(["VOY", "DS9", "TNG"]) });
  const first = globalThis.location.hash;
  stubBrowser("");
  writeHash({ ...DEFAULT_STATE, series: new Set(["TNG", "VOY", "DS9"]) });
  assert.equal(globalThis.location.hash, first, "same set must produce the same URL");
});

test("a hand-edited year range is clamped rather than rejected", () => {
  stubBrowser("#years=1900-9999");
  assert.deepEqual(readHash().years, FULL_RANGE);
});

test("a malformed year range falls back to the full range", () => {
  for (const hash of ["#years=abc", "#years=2400-2300", "#years=2400"]) {
    stubBrowser(hash);
    assert.equal(readHash().years, null, hash);
  }
});

const events = [
  { timeline: "prime", series: ["DS9"], group: "Deep Space 9" },
  { timeline: "prime", series: ["TNG", "VOY"], group: "USS Voyager" },
  { timeline: "kelvin", series: ["FILM"], group: null },
  { timeline: "mirror", series: ["DS9"], group: "Terok Nor" },
];

test("timeline filtering defaults to prime only", () => {
  assert.equal(applyFilters(events, { ...DEFAULT_STATE }).length, 2);
});

test("'all' includes divergent timelines", () => {
  assert.equal(applyFilters(events, { ...DEFAULT_STATE, timeline: "all" }).length, 4);
});

test("series filtering matches any selected series", () => {
  const out = applyFilters(events, { ...DEFAULT_STATE, series: new Set(["VOY"]) });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].series, ["TNG", "VOY"]);
});

test("filters combine", () => {
  const out = applyFilters(events, {
    ...DEFAULT_STATE,
    timeline: "all",
    series: new Set(["DS9"]),
    location: "Terok Nor",
  });
  assert.equal(out.length, 1);
});

// Zoom is a view control, not a filter: it must not change the filter set.
test("the year range does not filter events", () => {
  const withYears = applyFilters(events, { ...DEFAULT_STATE, years: [2400, 2402] });
  assert.equal(withYears.length, applyFilters(events, { ...DEFAULT_STATE }).length);
});
