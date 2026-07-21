import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanText,
  extractCitations,
  detectTimeline,
  parseStardateRange,
  FILMS,
} from "../scripts/lib/wikitext.js";

test("cleanText resolves wiki links to their display text", () => {
  assert.equal(cleanText("[[Keiko O'Brien]] is here"), "Keiko O'Brien is here");
  assert.equal(cleanText("[[USS Defiant|the Defiant]] arrives"), "the Defiant arrives");
  assert.equal(cleanText("[[Talos IV#History|Talos]]"), "Talos");
});

// Regression: the two forms of {{dis}} display different arguments. Getting
// this backwards silently rewrote prose ("exile on Vulcan" -> "exile on
// planet") in 140 places across the corpus.
test("cleanText handles both {{dis}} arities", () => {
  assert.equal(cleanText("exile on {{dis|Vulcan|planet}}"), "exile on Vulcan");
  assert.equal(cleanText("{{dis|Haley|hologram}} is online"), "Haley is online");
  assert.equal(
    cleanText("a new {{dis|Starfleet uniform|2370s-early 2380s|design}}"),
    "a new design",
  );
});

test("cleanText expands ship templates", () => {
  assert.equal(cleanText("{{USS|Defiant|2370}} arrives"), "USS Defiant arrives");
  assert.equal(cleanText("{{IKS|Rotarran}} departs"), "IKS Rotarran departs");
});

test("cleanText strips citation templates and their leftovers", () => {
  assert.equal(cleanText("Something happens. ({{DS9|The Assignment}})"), "Something happens.");
  // Multi-citation groups collapse to "(;; )" once the templates are removed.
  assert.equal(
    cleanText("An event. ({{film|8}}; {{DS9|Rapture}}; {{VOY|Equinox}})"),
    "An event.",
  );
});

test("cleanText normalises entities and emphasis", () => {
  assert.equal(cleanText("''Voyager''{{'}}s crew"), "Voyager’s crew");
  assert.equal(cleanText("2124.5 &ndash; 4202.9"), "2124.5 – 4202.9");
  assert.equal(cleanText("Alpha &amp; Beta"), "Alpha & Beta");
});

// Regression: a series template may cite several episodes at once. Treating
// trailing arguments as disambiguation dropped every title but the first.
test("extractCitations reads every episode in a template", () => {
  const cites = extractCitations("({{VOY|Message in a Bottle|Equinox}})");
  assert.deepEqual(
    cites.map((c) => c.title),
    ["Message in a Bottle", "Equinox"],
  );
  assert.ok(cites.every((c) => c.series === "VOY" && c.kind === "episode"));
});

test("extractCitations resolves films by production number", () => {
  const [film] = extractCitations("({{film|8}})");
  assert.equal(film.series, "FILM");
  assert.equal(film.title, FILMS[8]);
  assert.equal(film.number, 8);
});

test("extractCitations de-duplicates and skips flag arguments", () => {
  const cites = extractCitations("({{DS9|The Assignment}}; {{DS9|The Assignment}})");
  assert.equal(cites.length, 1);
  assert.equal(extractCitations("({{TOS|The Cage|nolink}})").length, 1);
});

test("detectTimeline is conservative", () => {
  assert.equal(detectTimeline("Kirk is born in Iowa."), "prime");
  assert.equal(detectTimeline("In an alternate timeline, Spock dies."), "alternate");
  assert.equal(detectTimeline("The Terran Empire invades."), "mirror");
  assert.equal(detectTimeline("In the Kelvin timeline, Chekov is older."), "kelvin");
});

test("parseStardateRange reads sidebar ranges", () => {
  assert.deepEqual(parseStardateRange("50032.7 &ndash; 50984.3"), {
    start: "50032.7",
    end: "50984.3",
  });
  assert.deepEqual(parseStardateRange("2233.04"), { start: "2233.04", end: "2233.04" });
  assert.equal(parseStardateRange(""), null);
  assert.equal(parseStardateRange(null), null);
});
