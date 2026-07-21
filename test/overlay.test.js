import test from "node:test";
import assert from "node:assert/strict";

import {
  applyOverlay,
  assignBaselineSignificance,
  OVERLAY_SOURCE,
} from "../scripts/lib/overlay.js";

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
