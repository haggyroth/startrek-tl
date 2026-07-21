import test from "node:test";
import assert from "node:assert/strict";

import {
  applyOverlay,
  assignBaselineSignificance,
  applyTimelineOverrides,
  OVERLAY_SOURCE,
} from "../scripts/lib/overlay.js";
import { stripProductionMetadata } from "../scripts/lib/wikipedia.js";

const event = (over = {}) => ({
  id: "e1",
  year: 2233,
  timeline: "prime",
  summary: "James Tiberius Kirk is born to George and Winona Kirk in Riverside, Iowa.",
  series: ["TOS"],
  episodes: [{ series: "TOS", title: "The Deadly Years", kind: "episode" }],
  significance: null,
  sources: ["https://memory-alpha.fandom.com/wiki/2233"],
  ...over,
});

test("a matching overlay entry marks the event as a landmark", () => {
  const events = [event()];
  const result = applyOverlay(events, [
    { year: 2233, text: "James T. Kirk is born in Riverside, Iowa on Earth.", timeline: null },
  ]);

  assert.equal(result.matched, 1);
  assert.equal(events[0].significance, 5);
  assert.equal(events[0].landmark, true);
  assert.ok(events[0].sources.includes(OVERLAY_SOURCE));
});

test("unrelated entries do not match", () => {
  const events = [event()];
  const result = applyOverlay(events, [
    { year: 2233, text: "The Bolians join the Federation.", timeline: null },
  ]);
  assert.equal(result.matched, 0);
  assert.equal(result.unmatched.length, 1);
});

// The core safety rule. Prime and Kelvin versions of Kirk's birth are nearly
// identical in prose, so a fuzzy match alone must never move an event off the
// prime timeline.
test("an uncorroborated timeline claim is flagged, not applied", () => {
  const events = [event()];
  const result = applyOverlay(events, [
    { year: 2233, text: "James T. Kirk is born in Riverside, Iowa on Earth.", timeline: "alternate" },
  ]);

  assert.equal(events[0].timeline, "prime", "must not reclassify on a fuzzy match");
  assert.equal(result.reclassified, 0);
  assert.equal(result.conflicts, 1);
  assert.deepEqual(events[0].timelineConflict, { claimed: "alternate", source: "wikipedia" });
});

// Citing a Kelvin film is not evidence on its own: Star Trek (2009) opens
// before the divergence and is cited for prime-timeline events too.
test("a mixed citation list is not Kelvin corroboration", () => {
  const events = [
    event({
      episodes: [
        { series: "TOS", title: "The Deadly Years", kind: "episode" },
        { series: "FILM", title: "Star Trek", kind: "film", number: 11 },
      ],
    }),
  ];
  applyOverlay(events, [
    { year: 2233, text: "James T. Kirk is born in Riverside, Iowa.", timeline: "alternate" },
  ]);
  assert.equal(events[0].timeline, "prime");
  assert.ok(events[0].timelineConflict);
});

test("an exclusively Kelvin-cited event is reclassified", () => {
  const events = [
    event({
      summary: "Pavel Chekov is born four years earlier than in the prime timeline.",
      episodes: [{ series: "FILM", title: "Star Trek", kind: "film", number: 11 }],
    }),
  ];
  const result = applyOverlay(events, [
    { year: 2233, text: "Pavel Chekov is born four years earlier than in the prime timeline.", timeline: "alternate" },
  ]);
  assert.equal(events[0].timeline, "kelvin");
  assert.equal(result.reclassified, 1);
  assert.equal(result.conflicts, 0);
});

test("Memory Alpha's own classification corroborates the overlay", () => {
  const events = [
    event({
      timeline: "alternate",
      summary: "In an alternate timeline, Spock is killed by a le-matya.",
    }),
  ];
  const result = applyOverlay(events, [
    { year: 2233, text: "In an alternate timeline, Spock is killed by a le-matya.", timeline: "mirror" },
  ]);
  // The event already said "not prime", so the overlay is confirming, not overriding.
  assert.equal(events[0].timeline, "alternate");
  assert.equal(result.conflicts, 0);
});

test("matching searches a one-year window but prefers the same year", () => {
  const near = event({ id: "near", year: 2234 });
  const exact = event({ id: "exact", year: 2233 });
  applyOverlay([near, exact], [
    { year: 2233, text: "James T. Kirk is born in Riverside, Iowa.", timeline: null },
  ]);
  assert.equal(exact.landmark, true);
  assert.notEqual(near.landmark, true);
});

test("baseline significance uses citation breadth as a weak proxy", () => {
  const plain = event({ significance: null });
  const film = event({
    significance: null,
    episodes: [{ series: "FILM", title: "Star Trek: First Contact", kind: "film", number: 8 }],
  });
  const many = event({
    significance: null,
    episodes: [1, 2, 3].map((n) => ({ series: "TNG", title: `E${n}`, kind: "episode" })),
  });

  assignBaselineSignificance([plain, film, many]);
  assert.equal(plain.significance, 3);
  assert.equal(film.significance, 4);
  assert.equal(many.significance, 4);
});

test("baseline significance never overwrites a landmark", () => {
  const landmark = event({ significance: 5, landmark: true });
  assignBaselineSignificance([landmark]);
  assert.equal(landmark.significance, 5);
});

// ---- production metadata ----

test("production-level entries are stripped, real remainders kept", () => {
  // Whole-line metadata: nothing in-universe survives.
  assert.equal(stripProductionMetadata("The events of \"The Cage\"."), "");
  assert.equal(stripProductionMetadata("The events of Star Trek: The Original Series take place."), "");
  assert.equal(stripProductionMetadata("Prologue scene of Star Trek."), "");

  // A real event appended after the metadata sentence must survive — throwing
  // the whole entry away cost three landmark matches.
  assert.equal(
    stripProductionMetadata(
      "The events of Star Trek Into Darkness take place. Khan is returned to suspended animation.",
    ),
    "Khan is returned to suspended animation.",
  );
  assert.equal(
    stripProductionMetadata("The events of Discovery season 1 take place. The Klingon-Federation War."),
    "The Klingon-Federation War.",
  );

  // Ordinary entries pass through untouched.
  const plain = "Boothby, groundskeeper at Starfleet Academy, is born.";
  assert.equal(stripProductionMetadata(plain), plain);
});

// ---- hand-reviewed timeline resolutions ----

test("overrides resolve a conflict and record the reasoning", () => {
  const e = event({ timelineConflict: { claimed: "alternate", source: "wikipedia" } });
  const result = applyTimelineOverrides([e], {
    e1: { timeline: "prime", note: "false positive; cited by TOS and ENT" },
  });

  assert.equal(result.applied, 1);
  assert.equal(e.timeline, "prime");
  assert.equal(e.timelineConflict, null);
  assert.match(e.timelineNote, /false positive/);
  assert.deepEqual(result.unresolved, []);
});

test("an override for a vanished event is reported as stale", () => {
  const result = applyTimelineOverrides([event()], {
    "does-not-exist": { timeline: "prime", note: "" },
  });
  assert.deepEqual(result.stale, ["does-not-exist"]);
  assert.equal(result.applied, 0);
});

test("conflicts without an override stay unresolved", () => {
  const e = event({ timelineConflict: { claimed: "mirror", source: "wikipedia" } });
  const result = applyTimelineOverrides([e], {});
  assert.equal(result.unresolved.length, 1);
  assert.equal(result.unresolved[0].id, "e1");
});
