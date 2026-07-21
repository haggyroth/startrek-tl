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

/** Sections whose bullets are events. Anything else is skipped. */
const EVENT_SECTIONS = /^(events|other events|births|deaths)$/i;

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
 *
 * Pull those into structured fields and return the remaining prose. Note the
 * stardate here is the literal value from the episode — it is never computed,
 * and for TOS-era years it will not be monotonic across the year.
 *
 * @returns {{ date: string|null, stardate: string|null, text: string }}
 */
export function extractDatePrefix(text, year) {
  // Both separators occur: "January 4 (stardate 2233.04) – ..." and
  // "April 11: ...". Stardate also appears bare: "Stardate 8615.2: ...".
  const m = text.match(
    /^\s*(?:([A-Z][a-z]+)\s+(\d{1,2}))?\s*(?:\(?stardate\s+([\d.]+)\s*\)?)?\s*(?:[–—-]\s+|:\s+)(.*)$/is,
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
  const usedIds = new Map();

  for (const rawLine of wikitext.split("\n")) {
    const line = rawLine.trimEnd();

    const heading = line.match(/^(=+)\s*(.+?)\s*=+\s*$/);
    if (heading) {
      const level = heading[1].length;
      if (level === 2) {
        section = heading[2].trim();
        inEventSection = EVENT_SECTIONS.test(section);
        group = null;
        month = null;
      }
      // H3 subsections ("By starship or station") inherit their parent's status.
      continue;
    }

    if (!inEventSection) continue;

    const sub = line.match(/^;\s*(.+)$/);
    if (sub) {
      group = cleanText(sub[1]) || null;
      month = null;
      continue;
    }

    // Top-level bullets are events. ":*" is an indented continuation bullet —
    // used under month headings — and carries real events, so it counts too.
    const bullet = line.match(/^(?::\*|\*)(?!\*)\s*(.+)$/);
    if (!bullet) continue;

    let source = bullet[1];

    // A bullet that is nothing but a month name is a date heading, not an
    // event. It scopes the bullets beneath it: "* {{dis|March|month}}".
    const headingText = cleanText(source).trim().replace(/:$/, "");

    // Written both as "* March" and "* February:".
    if (headingText.toLowerCase() in MONTHS) {
      month = MONTHS[headingText.toLowerCase()];
      sdContext = null;
      continue;
    }

    // Some years group bullets under a stardate instead of a month:
    // "* Stardate 1739.12" or "* Stardate 2259.42 (February 11)".
    const sdHeading = headingText.match(/^stardate\s+([\d.]+)\s*(?:\(([A-Z][a-z]+)\s+(\d{1,2})\))?$/i);
    if (sdHeading) {
      sdContext = sdHeading[1];
      if (sdHeading[2] && sdHeading[2].toLowerCase() in MONTHS) {
        month = MONTHS[sdHeading[2].toLowerCase()];
        day = Number(sdHeading[3]);
      }
      continue;
    }

    // Placeholder bullets on stub year pages.
    if (/^none yet$/i.test(headingText)) continue;

    // Citations come from the full bullet, before any trimming.
    const citations = extractCitations(source);

    // Drop the trailing citation group. Must run after extractCitations().
    source = stripCitationTail(source);

    // Clean first, then strip the date prefix — the prefix contains wiki links
    // ("[[January 4]]") that must be resolved before it can be matched.
    const { date, stardate, text } = extractDatePrefix(cleanText(source), year);
    const summary = text;
    if (!summary) continue;

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
      timeline: detectTimeline(source),
      title: null,
      summary,
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
