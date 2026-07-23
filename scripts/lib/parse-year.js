/**
 * Parse a Memory Alpha year page into normalized event records.
 *
 * Page shape (2373 is representative):
 *
 *   {{sidebar year |sd=50032.7 &ndash; 50984.3 ...}}
 *   == Events ==
 *   === By starship or station ===
 *   ;[[Deep Space 9]]           <- grouping context
 *   * <event>  ({{DS9|Episode}})
 *   == Other events ==
 *   * <event>  ({{VOY|Episode}})
 *   == Appendices ==            <- everything below is not event data
 *
 * The Appendices section is a full episode listing for the year and must be
 * excluded, or every episode becomes a phantom event.
 */

import {
  cleanText,
  extractCitations,
  detectTimeline,
  parseStardateRange,
} from "./wikitext.js";
import { extractFacts } from "./facts.js";

/**
 * Bullets that talk about the making of Star Trek rather than events in it.
 * Deliberately narrow — only two exist in the corpus, and over-matching would
 * silently drop real records.
 */
const PRODUCTION_NOTE =
  /^the (?:aborted|unproduced|proposed|cancell?ed)\s+(?:film|series|episode|game)\b|^the storyline for\b/i;

/** Sections whose bullets are events. Anything else is skipped. */
const EVENT_SECTIONS = /^(events|other events|births|deaths|alternate timeline events)$/i;

/**
 * Some pages split events by universe as H3 subsections — 2063 has both
 * "Prime universe" and "Mirror universe". That heading is a far stronger
 * signal than prose detection, so it sets the timeline for everything under it.
 */
const UNIVERSE_SECTIONS = [
  [/mirror\s+universe/i, "mirror"],
  // "Alternate reality" is Memory Alpha's name for the Kelvin timeline, so it
  // must be tested before the generic alternate-timeline pattern — otherwise
  // every Kelvin section is filed as a nondescript alternate timeline.
  [/kelvin|alternate\s+realit/i, "kelvin"],
  [/alternate\s+(?:timeline|universe)/i, "alternate"],
  [/prime\s+universe/i, "prime"],
];

function sectionTimeline(heading) {
  for (const [pattern, timeline] of UNIVERSE_SECTIONS) {
    if (pattern.test(heading)) return timeline;
  }
  return null;
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Many bullets carry a date and/or stardate prefix before an en dash:
 *
 *   "January 4 (stardate 2233.04) – The Federation survey ship USS Kelvin..."
 *   "(stardate 41153.7) – ..."
 *   "March 22 – ..."
 *   "Stardate 1457.9. Lieutenant Commander Chin-Riley is taken into custody..."
 *
 * Pull those into structured fields and return the remaining prose. Note the
 * stardate here is the literal value from the episode — it is never computed,
 * and for TOS-era years it will not be monotonic across the year.
 *
 * @returns {{ date: string|null, stardate: string|null, text: string }}
 */
export function extractDatePrefix(text, year, contextMonth = null) {
  // Under a month heading the bullet often gives only the day: "19th – ...".
  // There is no month in the line itself, so this only resolves when a heading
  // has already established one.
  if (contextMonth) {
    const dayOnly = text.match(/^\s*(\d{1,2})(?:st|nd|rd|th)?\s*(?:[–—-]\s+|:\s+)(.*)$/s);
    if (dayOnly) {
      const day = Number(dayOnly[1]);
      if (day >= 1 && day <= 31) {
        return {
          date: `${year}-${String(contextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          stardate: null,
          text: dayOnly[2],
        };
      }
    }
  }

  // Three separators occur: "January 4 (stardate 2233.04) – ..." and
  // "April 11: ...". Stardate also appears bare: "Stardate 8615.2: ..." or
  // "Stardate 1457.9. ...". A plain period is only accepted as a separator
  // here, guarded below by requiring a month or stardate to have matched —
  // otherwise an ordinary sentence's first full stop would look like one.
  const m = text.match(
    /^\s*(?:([A-Z][a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?)?\s*(?:\(?stardate\s+(\d+(?:\.\d+)?)\s*\)?)?\s*(?:[–—-]\s+|:\s+|\.\s+)(.*)$/is,
  );
  if (!m) return { date: null, stardate: null, text };

  const [, monthName, day, stardate, rest] = m;
  // Guard against a plain sentence that happens to contain a dash or colon.
  if (!monthName && !stardate) return { date: null, stardate: null, text };
  if (monthName && !(monthName.toLowerCase() in MONTHS)) {
    return { date: null, stardate: null, text };
  }

  let date = null;
  const month = monthName ? MONTHS[monthName.toLowerCase()] : null;
  if (month && day) {
    date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return { date, stardate: stardate ?? null, text: rest };
}

/**
 * Remove the trailing citation parenthetical from a bullet.
 *
 * Memory Alpha ends event bullets with a citation group. Once the episode
 * templates inside are stripped, whatever remains is debris — "(;; Dedication
 * plaque)" — so the whole group goes. Two wrinkles the naive pattern missed:
 * the group may contain nested parens ("[[...USS Enterprise (NCC-1701-B)...]]")
 * and may be followed by stray italic markup.
 *
 * A group is treated as a citation if it contains a template, or if the prose
 * before it already ends a sentence — otherwise the parenthetical is part of
 * the sentence and is left alone.
 */
function stripCitationTail(s) {
  const m = s.match(/^([\s\S]*)\s*\((?:[^()]|\([^()]*\))*\)\s*'*\s*$/);
  if (!m) return s;

  const head = m[1];
  const tail = s.slice(head.length);
  if (tail.includes("{{") || /[.!?]['"]*\s*$/.test(head)) return head.trimEnd();
  return s;
}

/**
 * Build a date from heading context. Precision follows what's known — a month
 * heading yields YYYY-MM, never a guessed day.
 */
function contextDate(year, month, day) {
  if (!month) return null;
  const mm = String(month).padStart(2, "0");
  return day ? `${year}-${mm}-${String(day).padStart(2, "0")}` : `${year}-${mm}`;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Pull the year-level stardate range out of the {{sidebar year}} template. */
function extractSidebarStardate(wikitext) {
  const m = wikitext.match(/\{\{sidebar year([\s\S]*?)\n\}\}/i);
  if (!m) return null;
  const sd = m[1].match(/^\s*\|\s*sd\s*=\s*(.+)$/im);
  return sd ? parseStardateRange(sd[1]) : null;
}

/**
 * @param {string} wikitext Raw page wikitext
 * @param {number} year
 * @returns {{ year: number, stardateRange: object|null, events: object[] }}
 */
export function parseYearPage(wikitext, year) {
  const stardateRange = extractSidebarStardate(wikitext);
  const events = [];

  let section = null;   // current == H2 ==
  let group = null;     // current ;subheader (ship or station)
  let month = null;     // current "* March" heading, if any
  let day = null;       // day from a "* Stardate N (March 4)" heading
  let sdContext = null; // current "* Stardate N" heading, if any
  let inEventSection = false;
  let universe = null;
  // universe, keyed by heading level, so a sibling heading can't inherit
  // from an earlier sibling — only from a true ancestor. Without this, "===
  // Alternate timeline ===" followed by a sibling "=== Note ===" let the note
  // wrongly inherit "alternate" from its sibling instead of resetting.
  const universeByLevel = new Map();
  const usedIds = new Map();

  for (const rawLine of wikitext.split("\n")) {
    const line = rawLine.trimEnd();

    const heading = line.match(/^(=+)\s*(.+?)\s*=+\s*$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();

      // Leaving a subsection's scope: any heading, at any depth, ends the
      // current ;subheader's bullet list. Without this, bullets under a
      // heading that isn't itself a ship/station one ("==== Other events
      // ====" nested under "=== Prime universe ===" is common) silently
      // inherited whatever ship was last grouped above, mislabeling their
      // location — e.g. an "Other events" DS9 bullet inheriting "USS
      // Voyager" from the starship subsection just above it.
      group = null;
      month = null;

      // Drop any deeper levels we're no longer inside, then resolve this
      // heading's own universe, inheriting from the nearest remaining
      // (i.e. shallower) ancestor level when the heading isn't itself a
      // universe heading.
      for (const l of [...universeByLevel.keys()]) {
        if (l >= level) universeByLevel.delete(l);
      }
      let inherited = null;
      for (let l = level - 1; l >= 2; l--) {
        if (universeByLevel.has(l)) {
          inherited = universeByLevel.get(l);
          break;
        }
      }
      universe = sectionTimeline(text) ?? inherited;
      universeByLevel.set(level, universe);

      if (level === 2) {
        section = text;
        inEventSection = EVENT_SECTIONS.test(section);
      }
      continue;
    }

    if (!inEventSection) continue;

    const sub = line.match(/^;\s*(.+)$/);
    if (sub) {
      group = cleanText(sub[1]) || null;
      month = null;
      continue;
    }

    // Top-level "*" bullets are events. Nested bullets — written as "**" or
    // ":*" — sit under a month or stardate heading and are events too, not
    // sub-details: 35 of them carry their own episode citations, including the
    // Battle of the Binary Stars. Skipping them silently lost real records.
    const bullet = line.match(/^(?:\*\*(?!\*)|:\*|\*(?!\*))\s*(.+)$/);
    if (!bullet) continue;
    const indented = line.startsWith(":*") || line.startsWith("**");

    let source = bullet[1];

    // A bullet that is nothing but a month name is a date heading, not an
    // event. It scopes the bullets beneath it: "* {{dis|March|month}}".
    const headingText = cleanText(source).trim().replace(/:$/, "");

    // A span of months ("October-December") is a heading too, but it pins no
    // single month, so it only clears the scope rather than setting one.
    const range = headingText.match(/^([A-Z][a-z]+)\s*[-–—]\s*([A-Z][a-z]+)$/);
    if (range && range[1].toLowerCase() in MONTHS && range[2].toLowerCase() in MONTHS) {
      month = null;
      day = null;
      sdContext = null;
      continue;
    }

    // Written both as "* March" and "* February:".
    if (headingText.toLowerCase() in MONTHS) {
      month = MONTHS[headingText.toLowerCase()];
      sdContext = null;
      continue;
    }

    // Some years group bullets under a stardate instead of a month:
    // "* Stardate 1739.12" or "* Stardate 2259.42 (February 11)".
    const sdHeading = headingText.match(
      /^stardate\s+(\d+(?:\.\d+)?)\.?\s*(?:\(([A-Z][a-z]+)\s+(\d{1,2})\))?$/i,
    );
    if (sdHeading) {
      sdContext = sdHeading[1];
      if (sdHeading[2] && sdHeading[2].toLowerCase() in MONTHS) {
        month = MONTHS[sdHeading[2].toLowerCase()];
        day = Number(sdHeading[3]);
      }
      continue;
    }

    // Placeholder bullets on stub year pages, written both ways.
    if (/^none(\s+yet)?$/i.test(headingText)) continue;

    // A month or stardate heading scopes only the indented bullets beneath it.
    // A new top-level bullet ends that scope — without this, everything after
    // a heading inherits a date the page never claimed for it.
    if (!indented) {
      month = null;
      day = null;
      sdContext = null;
    }

    // Citations come from the full bullet, before any trimming.
    const citations = extractCitations(source);

    // Drop the trailing citation group. Must run after extractCitations().
    source = stripCitationTail(source);

    // Clean first, then strip the date prefix — the prefix contains wiki links
    // ("[[January 4]]") that must be resolved before it can be matched.
    const { date, stardate, text } = extractDatePrefix(cleanText(source), year, month);
    const facts = extractFacts(source, text);
    const summary = text;
    if (!summary) continue;

    // A few bullets describe productions rather than canon: an unmade film's
    // intended setting, a game's storyline. They are commentary about Star
    // Trek, not events within it, and have no place on an in-universe timeline.
    if (PRODUCTION_NOTE.test(summary)) continue;

    // A bullet that is nothing but a linked name, with no citation, is a list
    // entry rather than an event — the 2087 memorial roll from "The Royale"
    // is eight such lines. An event needs something to have happened.
    if (!citations.length && facts.entities.length === 1 && summary === facts.entities[0]) {
      continue;
    }

    const series = [...new Set(citations.map((c) => c.series))];

    // Stable id: year + slug of the summary opening, disambiguated on collision.
    let id = `${year}-${slugify(summary.slice(0, 50))}`;
    const n = (usedIds.get(id) ?? 0) + 1;
    usedIds.set(id, n);
    if (n > 1) id = `${id}-${n}`;

    events.push({
      id,
      year,
      // An explicit "January 4" wins. Failing that, a "* March" heading gives
      // month precision only, so the date is deliberately partial (YYYY-MM)
      // rather than guessing a day.
      date: date ?? contextDate(year, month, day),
      stardate: stardate ?? sdContext,
      // A universe subheading is authoritative; prose detection is the fallback.
      timeline: universe ?? detectTimeline(source),
      summary,
      entities: facts.entities,
      kind: facts.kind,
      group,
      section,
      series,
      episodes: citations.map((c) => ({
        series: c.series,
        title: c.title,
        kind: c.kind,
        ...(c.number != null ? { number: c.number } : {}),
      })),
      significance: null,
      sources: [`https://memory-alpha.fandom.com/wiki/${year}`],
    });
  }

  return { year, stardateRange, events };
}
