import test from "node:test";
import assert from "node:assert/strict";

import { parseYearPage, extractDatePrefix } from "../scripts/lib/parse-year.js";

const page = (body) => `{{sidebar year\n|sd=41000.0 &ndash; 41986.0\n}}\n\n== Events ==\n${body}\n\n== Appendices ==\n=== Episodes ===\n* {{TNG|Should Not Appear}}\n`;

test("extractDatePrefix reads dash, colon and bare-stardate forms", () => {
  assert.deepEqual(extractDatePrefix("January 4 (stardate 2233.04) – A thing happens.", 2233), {
    date: "2233-01-04",
    stardate: "2233.04",
    text: "A thing happens.",
  });
  assert.deepEqual(extractDatePrefix("April 11: A thing happens.", 2245), {
    date: "2245-04-11",
    stardate: null,
    text: "A thing happens.",
  });
  assert.deepEqual(extractDatePrefix("Stardate 8615.2: A thing happens.", 2286), {
    date: null,
    stardate: "8615.2",
    text: "A thing happens.",
  });
});

test("extractDatePrefix leaves ordinary prose alone", () => {
  // A sentence containing a colon or dash must not be mistaken for a prefix.
  const sentence = "Attack on the USS Kelvin: the Narada engages.";
  assert.deepEqual(extractDatePrefix(sentence, 2233), {
    date: null,
    stardate: null,
    text: sentence,
  });
  const notAMonth = "Someone 4 – did a thing.";
  assert.equal(extractDatePrefix(notAMonth, 2300).text, notAMonth);
});

test("parseYearPage extracts events with citations and grouping", () => {
  const { events } = parseYearPage(
    page(";[[Deep Space 9]]\n*[[Keiko O'Brien]] is possessed. ({{DS9|The Assignment}})"),
    2364,
  );
  assert.equal(events.length, 1);
  const [e] = events;
  assert.equal(e.year, 2364);
  assert.equal(e.group, "Deep Space 9");
  assert.equal(e.summary, "Keiko O'Brien is possessed.");
  assert.deepEqual(e.series, ["DS9"]);
  assert.equal(e.episodes[0].title, "The Assignment");
});

test("parseYearPage reads the sidebar stardate range", () => {
  const { stardateRange } = parseYearPage(page("* A thing. ({{TNG|Q}})"), 2364);
  assert.deepEqual(stardateRange, { start: "41000.0", end: "41986.0" });
});

// Regression: the Appendices section is a full episode listing for the year.
// Including it turned every episode into a phantom event.
test("parseYearPage ignores the Appendices section", () => {
  const { events } = parseYearPage(page("* A real event. ({{TNG|Q}})"), 2364);
  assert.equal(events.length, 1);
  assert.equal(events[0].summary, "A real event.");
});

// Regression: ":*" bullets sit under month headings and were dropped entirely.
test("parseYearPage reads indented ':*' bullets", () => {
  const { events } = parseYearPage(page(":* An indented event. ({{TNG|Q}})"), 2364);
  assert.equal(events.length, 1);
});

// Regression: a bullet that is only a month name is a heading, and was being
// emitted as an event whose summary was the word "month".
test("month headings scope following bullets instead of becoming events", () => {
  const { events } = parseYearPage(
    page("* {{dis|March|month}}\n:* A March event. ({{TNG|Q}})"),
    2364,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].summary, "A March event.");
  // Month precision only — never a guessed day.
  assert.equal(events[0].date, "2364-03");
});

test("stardate headings scope following bullets", () => {
  const { events } = parseYearPage(
    page("* Stardate 1739.12\n:* An event. ({{TOS|Q}})"),
    2259,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].stardate, "1739.12");
});

// Regression: trailing citation groups survived when they held nested parens
// or were followed by italic markup.
test("trailing citation groups are stripped even when awkward", () => {
  const nested = parseYearPage(
    page("* The ship launches. ({{film|7}}, [[List#USS Enterprise (NCC-1701-B)|plaque]])"),
    2293,
  ).events[0];
  assert.equal(nested.summary, "The ship launches.");

  const trailingItalics = parseYearPage(
    page("* The ship launches. ({{SNW|Q}} ''[[dedication plaque]]'')''"),
    2245,
  ).events[0];
  assert.equal(trailingItalics.summary, "The ship launches.");
});

test("a parenthetical that is part of the sentence is preserved", () => {
  const { events } = parseYearPage(
    page("* The USS Constellation (NCC-1017) launches ({{PIC|Q}})"),
    2245,
  );
  assert.match(events[0].summary, /\(NCC-1017\)/);
});

test("ids are stable and collision-suffixed", () => {
  const { events } = parseYearPage(
    page("* A repeated line. ({{TNG|Q}})\n* A repeated line. ({{TNG|R}})"),
    2364,
  );
  assert.equal(events.length, 2);
  assert.notEqual(events[0].id, events[1].id);
  assert.ok(events[0].id.startsWith("2364-"));
  assert.match(events[1].id, /-2$/);
});

test("placeholder bullets are skipped", () => {
  const { events } = parseYearPage(page("* None yet"), 2334);
  assert.equal(events.length, 0);
});

test("events carry extracted facts", () => {
  const [e] = parseYearPage(
    page("* [[James T. Kirk]] is born in [[Riverside]]. ({{TOS|Q}})"),
    2233,
  ).events;
  assert.equal(e.kind, "birth");
  assert.ok(e.entities.includes("James T. Kirk"));
});

// Regression: "July 13th – Jean-Luc Picard is born" left the whole prefix in
// the summary and lost the date. Ordinal suffixes are common on ENT-era pages.
test("extractDatePrefix accepts ordinal day suffixes", () => {
  for (const [input, date] of [
    ["April 4th – A thing happens.", "2063-04-04"],
    ["July 13th – A thing happens.", "2063-07-13"],
    ["August 1st – A thing happens.", "2063-08-01"],
    ["March 22nd – A thing happens.", "2063-03-22"],
    ["May 3rd – A thing happens.", "2063-05-03"],
  ]) {
    const out = extractDatePrefix(input, 2063);
    assert.equal(out.date, date, input);
    assert.equal(out.text, "A thing happens.", input);
  }
});

// Some pages split events by universe as H3 subsections. That heading is a
// much stronger signal than prose detection and must win.
test("universe subheadings set the timeline beneath them", () => {
  const wikitext = `== Events ==
=== Prime universe ===
* A prime event. ({{TNG|A}})
=== Mirror universe ===
* A mirror event with no telltale wording. ({{ENT|B}})
=== Alternate reality ===
* A Kelvin event with no telltale wording. ({{TOS|C}})
`;
  const { events } = parseYearPage(wikitext, 2063);
  assert.deepEqual(
    events.map((e) => e.timeline),
    // "Alternate reality" is Memory Alpha's name for the Kelvin timeline, so it
    // must not be filed as a generic alternate timeline.
    ["prime", "mirror", "kelvin"],
  );
});

test("an alternate-timeline events section is recognised", () => {
  const { events } = parseYearPage(
    "== Alternate timeline events ==\n* Something that never happened. ({{TNG|A}})\n",
    2364,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].timeline, "alternate");
});

// Under a month heading a bullet may give only the day — "19th – ..." — which
// has no month of its own to match on.
test("a bare day resolves against the month heading in scope", () => {
  const { events } = parseYearPage(
    page("* {{dis|July|month}}\n:* 19th – A thing happens. ({{ENT|Q}})"),
    2151,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2151-07-19");
  assert.equal(events[0].summary, "A thing happens.");
});

test("a bare day without a month heading is left alone", () => {
  const { events } = parseYearPage(page("* 19th – A thing happens. ({{ENT|Q}})"), 2151);
  assert.equal(events[0].date, null);
  assert.match(events[0].summary, /^19th/);
});

// Commentary about the making of Star Trek is not an event within it.
test("production notes are not events", () => {
  const wikitext = page(
    "* The aborted film Star Trek: The Beginning was to be set this year. ({{ENT|Q}})\n" +
      "* The storyline for a video game begins this year. ({{ENT|Q}})\n" +
      "* A real event happens. ({{ENT|Q}})",
  );
  const { events } = parseYearPage(wikitext, 2159);
  assert.equal(events.length, 1);
  assert.equal(events[0].summary, "A real event happens.");
});
