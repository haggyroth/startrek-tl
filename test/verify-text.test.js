import test from "node:test";
import assert from "node:assert/strict";

import {
  stem,
  related,
  significantTokens,
  introducedTokens,
  isStardateOutOfRange,
  STARDATE_EPOCH_YEAR,
} from "../scripts/lib/verify-text.js";

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

// Regression: the range check originally applied to every year, including
// pre-2323 ones where stardates are inconsistent by design (CLAUDE.md) - a
// TOS/SNW-era year's declared sidebar range constrains nothing, and checking
// it anyway produced false positives on real, correctly-authored summaries
// (e.g. a 2259 event legitimately citing stardate 2510.6 against a page range
// of 1739.12-2259.55).
test("isStardateOutOfRange only applies from the stardate epoch onward", () => {
  const range = { start: "1739.12", end: "2259.55" };
  assert.equal(
    isStardateOutOfRange("2510.6", 2259, range),
    false,
    "pre-epoch years are not range-checked at all",
  );
  assert.equal(STARDATE_EPOCH_YEAR, 2323);
});

test("isStardateOutOfRange flags a real anomaly at or after the epoch", () => {
  const range = { start: "41000", end: "41986" };
  assert.equal(isStardateOutOfRange("45000", 2364, range), true);
  assert.equal(isStardateOutOfRange("41500", 2364, range), false);
});

test("isStardateOutOfRange treats a single-value sidebar as no range at all", () => {
  // Some sidebars give one value while their events legitimately carry others.
  const range = { start: "2233.04", end: "2233.04" };
  assert.equal(isStardateOutOfRange("2233.143", 2364, range), false);
});

test("isStardateOutOfRange handles a range given backwards", () => {
  const range = { start: "41986", end: "41000" };
  assert.equal(isStardateOutOfRange("41500", 2364, range), false);
  assert.equal(isStardateOutOfRange("42000", 2364, range), true);
});
