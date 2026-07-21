import test from "node:test";
import assert from "node:assert/strict";

import { applySummaries } from "../scripts/lib/summaries.js";
import { extractEntities, classify } from "../scripts/lib/facts.js";

const scraped = () => [
  {
    id: "2233-kirk",
    year: 2233,
    summary: "Memory Alpha's own wording for this event.",
    entities: ["James T. Kirk", "Riverside"],
    kind: "birth",
  },
  {
    id: "2233-other",
    year: 2233,
    summary: "More scraped wording.",
    entities: [],
    kind: null,
  },
];

test("authored summaries replace the scrape and are counted", () => {
  const events = scraped();
  const result = applySummaries(events, { "2233-kirk": "James T. Kirk born in Riverside, Iowa." });

  assert.equal(result.covered, 1);
  assert.equal(result.total, 2);
  assert.equal(events[0].summary, "James T. Kirk born in Riverside, Iowa.");
  assert.equal(events[0].prose, "authored");
  assert.equal(events[1].prose, "source");
});

// The whole point of strict mode: a public build must not carry scraped prose.
test("strict mode emits no scraped prose", () => {
  const events = scraped();
  const original = events.map((e) => e.summary);
  applySummaries(events, { "2233-kirk": "James T. Kirk born in Riverside, Iowa." }, { strict: true });

  assert.equal(events[0].summary, "James T. Kirk born in Riverside, Iowa.");
  assert.notEqual(events[1].summary, original[1]);
  assert.equal(events[1].prose, "source");
});

test("strict fallbacks are built from the fact record", () => {
  const events = scraped();
  applySummaries(events, {}, { strict: true });
  assert.match(events[0].summary, /birth/);
  assert.match(events[0].summary, /James T\. Kirk/);
  assert.match(events[1].summary, /2233/);
});

test("non-strict builds leave unauthored prose in place", () => {
  const events = scraped();
  applySummaries(events, {});
  assert.equal(events[1].summary, "More scraped wording.");
});

test("extractEntities reads link targets, not display text", () => {
  const ents = extractEntities("[[James T. Kirk|Jim]] visits [[Riverside, Iowa|home]]");
  assert.deepEqual(ents, ["James T. Kirk", "Riverside, Iowa"]);
});

test("extractEntities picks up ship templates and de-duplicates", () => {
  const ents = extractEntities("{{USS|Defiant|2370}} meets [[Worf]]; {{USS|Defiant|2370}} departs");
  assert.deepEqual(ents, ["Worf", "USS Defiant"]);
});

test("extractEntities skips structural links and bare years", () => {
  const ents = extractEntities("[[Earth]] and [[Starfleet]] in [[2364]] with [[Worf]]");
  assert.deepEqual(ents, ["Worf"]);
});

test("classify identifies event kinds it is confident about", () => {
  assert.equal(classify("Kirk is born in Iowa."), "birth");
  assert.equal(classify("The captain dies."), "death");
  assert.equal(classify("The USS Farragut is launched."), "launch");
  assert.equal(classify("Spock graduates from the Academy."), "graduation");
  assert.equal(classify("Something entirely unremarkable occurs."), null);
});
