import test from "node:test";
import assert from "node:assert/strict";

import { stem, related, significantTokens, introducedTokens } from "../scripts/lib/verify-text.js";

// Regression: "Pike's" reduced to "pik", not "pike". Punctuation was stripped
// before the possessive, so "Pike's" became "Pikes" and the generic "es"
// suffix rule (meant for plurals like "colonies") over-trimmed it. Any name
// ending in a silent "e" hit this the moment a possessive was appended.
test("stem reduces a possessive on a name ending in silent e", () => {
  assert.equal(stem("Pike's"), "pike");
  assert.equal(stem("Pike"), "pike");
});

test("stem still handles ordinary possessives and plurals", () => {
  assert.equal(stem("Kirk's"), "kirk");
  assert.equal(stem("Archer's"), "archer");
  // "Andorians" -> "andor" and "Andoria" -> "andoria" are not equal stems;
  // related() is what unifies them, via substring containment (below).
  assert.equal(stem("colonies").length < "colonies".length, true);
});

test("stem reduces ordinal numbers to their digits", () => {
  assert.equal(stem("13th"), "13");
  assert.equal(stem("23rd"), "23");
});

test("related matches a stem contained in a longer one", () => {
  assert.equal(related("archer", "archer"), true);
  assert.equal(related("andor", "andorian"), true);
  assert.equal(related("pike", "spock"), false);
  // Below the length-4 floor, a short match is coincidence, not a name.
  assert.equal(related("hi", "history"), false);
});

test("significantTokens skips the sentence-initial word and single letters", () => {
  const tokens = significantTokens("Kirk meets T. Pring on Vulcan.");
  assert.ok(!tokens.has("Kirk"), "sentence-initial word is grammar, not a name");
  assert.ok(!tokens.has("T"), "a bare initial carries no fact of its own");
  assert.ok(tokens.has("Pring"));
  assert.ok(tokens.has("Vulcan"));
});

test("significantTokens keeps numbers, including ordinals", () => {
  const tokens = significantTokens("It happened on the 13th, in 1701.");
  assert.ok(tokens.has("13"));
  assert.ok(tokens.has("1701"));
});

// The end-to-end case that motivated the stem fix: a possessive on "Pike"
// must not be flagged when "Pike" appears in the source.
test("introducedTokens traces a possessive back to its source name", () => {
  const authored = "Archer answers a distress call from Captain Pike's Enterprise.";
  const source = "A distress call comes from Captain Christopher Pike aboard the USS Enterprise.";
  assert.deepEqual(introducedTokens(authored, source), []);
});

test("introducedTokens still flags a genuinely new name", () => {
  const authored = "Spock and Bones investigate the anomaly.";
  const source = "Spock investigates the anomaly.";
  assert.deepEqual(introducedTokens(authored, source), ["Bones"]);
});
