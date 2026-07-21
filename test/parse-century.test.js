import test from "node:test";
import assert from "node:assert/strict";

import { parseCenturyPage } from "../scripts/lib/parse-century.js";

const URL = "https://memory-alpha.fandom.com/wiki/32nd%20century";

const page = `== Events ==
* All time travel technology has been outlawed by this century. ({{DIS|Century Wide}})
;{{visible anchor|3102}}
:* The Federation visits a distant station for the last time. ({{DIS|Example One}})
:* A second thing happens that year. ({{DIS|Example Two}})
;{{visible anchor|3145}}
:* [[Lura Thok]] is born. ({{SA|Example Three}})
;3164
:* A plainly written year anchor also works. ({{DIS|Example Four}})
;{{USS|Discovery}}
:* A ship subheading is not a year and must not set one. ({{DIS|Example Five}})

== Appendices ==
=== 32nd century productions ===
* {{DIS}}
** {{e|Should Not Appear}}
`;

test("events are attributed to their year anchor", () => {
  const { events } = parseCenturyPage(page, URL);

  assert.equal(events.length, 4);
  assert.deepEqual(events.map((e) => e.year), [3102, 3102, 3145, 3164]);
  assert.ok(events[0].summary.startsWith("The Federation visits"));
  assert.ok(events[1].summary.startsWith("A second thing happens"));
  assert.ok(events[2].summary.startsWith("Lura Thok is born"));
  assert.ok(events[3].summary.startsWith("A plainly written year anchor"));
});

// On a year page ";" introduces a ship or station; here it introduces the year.
// Reusing the year parser would file every event under a group named "3102".
// A registry like NCC-1031 contains a plausible four-digit year, so an
// unrecognised subheading must stop attribution rather than guess.
test("a ship subheading does not become a year", () => {
  const { events } = parseCenturyPage(page, URL);
  assert.ok(!events.some((e) => e.summary.startsWith("A ship subheading")));
  assert.ok(!events.some((e) => e.year === 1031));
});

test("decade anchors are read from the first argument", () => {
  const { events } = parseCenturyPage(
    "== Events ==\n;{{visible anchors|3160|3160s}}\n:* A thing happens. ({{DIS|A}})\n",
    URL,
  );
  assert.equal(events.length, 1, "the plural anchor form must not be skipped");
  assert.equal(events[0].year, 3160);
});

test("century-wide statements are skipped, not misdated", () => {
  const { events, skippedCenturyWide } = parseCenturyPage(page, URL);
  assert.equal(skippedCenturyWide, 2, "the century-wide bullet plus the ship-subheading bullet");
  assert.ok(!events.some((e) => e.summary.includes("outlawed")));
});

test("the appendices section is ignored", () => {
  const { events } = parseCenturyPage(page, URL);
  assert.ok(!events.some((e) => e.summary.includes("Should Not Appear")));
});

test("bounds keep century pages from duplicating the per-year range", () => {
  const { events } = parseCenturyPage(page, URL, { minYear: 3150 });
  assert.deepEqual([...new Set(events.map((e) => e.year))], [3164]);
});

test("citations and the source url are recorded", () => {
  const { events } = parseCenturyPage(page, URL);
  const birth = events.find((e) => e.summary.startsWith("Lura Thok"));
  assert.deepEqual(birth.series, ["SA"]);
  assert.equal(birth.kind, "birth");
  assert.deepEqual(birth.sources, [URL]);
});

test("ids are collision-suffixed within a century page", () => {
  const dupes = `== Events ==
;3102
:* A repeated line. ({{DIS|A}})
;3105
:* A repeated line. ({{DIS|B}})
`;
  const { events } = parseCenturyPage(dupes, URL);
  assert.equal(events.length, 2);
  assert.notEqual(events[0].id, events[1].id);
});
