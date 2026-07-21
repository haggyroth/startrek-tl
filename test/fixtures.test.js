/**
 * Regression test against a full year page.
 *
 * The fixture is synthetic, not a copy of a Memory Alpha page: committing real
 * wiki prose would reintroduce exactly the licensing problem the rewrite is
 * removing. It reproduces every structural pattern the real corpus uses —
 * ship subheadings, indented bullets, month and stardate headings, both
 * {{dis}} arities, multi-episode citations, awkward trailing citation groups,
 * placeholder bullets, and an Appendices section that must be ignored.
 *
 * The exact-count and exact-id assertions are the point: a parser change that
 * silently drops or duplicates events fails here rather than shipping.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseYearPage } from "../scripts/lib/parse-year.js";

const wikitext = readFileSync(
  fileURLToPath(new URL("./fixtures/year-page.wikitext", import.meta.url)),
  "utf8",
);

const { events, stardateRange } = parseYearPage(wikitext, 2364);

test("the fixture parses to exactly the expected events", () => {
  assert.equal(events.length, 14, "event count changed — a bullet was dropped or invented");
});

test("event ids are exactly as expected", () => {
  assert.deepEqual(events.map((e) => e.id), [
    "2364-kira-nerys-negotiates-with-the-bajoran-provisional",
    "2364-a-runabout-is-lost-near-the-wormhole",
    "2364-the-uss-defiant-surveys-the-gamma-quadrant",
    "2364-the-uss-enterprise-maps-a-nebula-near-vulcan",
    "2364-a-design-enters-service",
    "2364-tarquin-vale-is-born-on-betazed",
    "2364-the-uss-example-is-launched",
    "2364-a-survey-team-reaches-minos-korva",
    "2364-contact-is-lost-with-outpost-4",
    "2364-the-tholian-assembly-closes-its-borders",
    "2364-in-an-alternate-timeline-the-outpost-survives",
    "2364-the-uss-sample-ncc-9999-completes-a-refit",
    // Same summary as an earlier bullet: the collision suffix must be applied.
    "2364-a-runabout-is-lost-near-the-wormhole-2",
    "2364-the-krios-delegation-departs-escorted-by-worf",
  ]);
});

test("no summary retains wiki markup", () => {
  for (const e of events) {
    assert.doesNotMatch(e.summary, /\{\{|\}\}|\[\[|\]\]|\|/, e.id);
  }
});

test("the sidebar stardate range is read", () => {
  assert.deepEqual(stardateRange, { start: "41000.0", end: "41986.0" });
});

test("grouping context is attached and cleared correctly", () => {
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));
  assert.equal(byId["2364-a-runabout-is-lost-near-the-wormhole"].group, "Deep Space 9");
  assert.equal(byId["2364-the-uss-defiant-surveys-the-gamma-quadrant"].group, "USS Defiant");
  // "Other events" is a fresh H2, so the ship subheading must not leak into it.
  assert.equal(byId["2364-tarquin-vale-is-born-on-betazed"].group, null);
});

test("date and stardate precision follows what the page actually states", () => {
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));
  assert.equal(byId["2364-tarquin-vale-is-born-on-betazed"].date, "2364-01-04");
  assert.equal(byId["2364-tarquin-vale-is-born-on-betazed"].stardate, "41001.1");
  assert.equal(byId["2364-the-uss-example-is-launched"].date, "2364-04-11");
  // Month heading: month precision only, never a guessed day.
  assert.equal(byId["2364-a-survey-team-reaches-minos-korva"].date, "2364-03");
  assert.equal(byId["2364-the-tholian-assembly-closes-its-borders"].stardate, "41500.5");
});

test("citations are captured, including multi-episode templates", () => {
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));
  assert.deepEqual(
    byId["2364-the-uss-sample-ncc-9999-completes-a-refit"].episodes.map((x) => x.title),
    ["Example Thirteen", "Example Fourteen"],
  );
  const uniform = byId["2364-a-design-enters-service"];
  assert.deepEqual([...uniform.series].sort(), ["FILM", "TNG"]);
});

test("heading context does not leak past a top-level bullet", () => {
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));
  // These sit after the stardate heading but are top-level, so they are not
  // beneath it and must carry no inherited date or stardate.
  for (const id of [
    "2364-in-an-alternate-timeline-the-outpost-survives",
    "2364-the-uss-sample-ncc-9999-completes-a-refit",
    "2364-the-krios-delegation-departs-escorted-by-worf",
  ]) {
    assert.equal(byId[id].date, null, id);
    assert.equal(byId[id].stardate, null, id);
  }
});

test("a parenthetical belonging to the sentence survives", () => {
  const refit = events.find((e) => e.id === "2364-the-uss-sample-ncc-9999-completes-a-refit");
  assert.match(refit.summary, /\(NCC-9999\)/);
});

test("timeline detection runs over the whole corpus", () => {
  const alt = events.find((e) => e.id === "2364-in-an-alternate-timeline-the-outpost-survives");
  assert.equal(alt.timeline, "alternate");
  assert.equal(
    events.filter((e) => e.timeline === "prime").length,
    events.length - 1,
  );
});

test("appendices and background sections contribute nothing", () => {
  for (const e of events) {
    assert.doesNotMatch(e.summary, /Should Not Be An Event|Nor Should This|commentary/);
  }
  assert.equal(events.filter((e) => e.section === "Appendices").length, 0);
});

test("parsing is deterministic", () => {
  const again = parseYearPage(wikitext, 2364);
  assert.deepEqual(again.events, events);
});
