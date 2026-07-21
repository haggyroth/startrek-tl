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
  const m = text.match(
    /^\s*(?:([A-Z][a-z]+)\s+(\d{1,2}))?\s*(?:\(stardate\s+([\d.]+)\s*\))?\s*[–—-]\s+(.*)$/s,
  );
  if (!m) return { date: null, stardate: null, text };

  const [, monthName, day, stardate, rest] = m;
  // Guard against a plain sentence that happens to contain a dash.
  if (!monthName && !stardate) return { date: null, stardate: null, text };

  let date = null;
  const month = monthName ? MONTHS[monthName.toLowerCase()] : null;
  if (month && day) {
    date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return { date, stardate: stardate ?? null, text: rest };
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
      }
      // H3 subsections ("By starship or station") inherit their parent's status.
      continue;
    }

    if (!inEventSection) continue;

    const sub = line.match(/^;\s*(.+)$/);
    if (sub) {
      group = cleanText(sub[1]) || null;
      continue;
    }

    // Only top-level bullets are events; "**" lines are sub-details.
    const bullet = line.match(/^\*(?!\*)\s*(.+)$/);
    if (!bullet) continue;

    const source = bullet[1];
    const citations = extractCitations(source);
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
      date,
      stardate,
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
      })),
      significance: null,
      sources: [`https://memory-alpha.fandom.com/wiki/${year}`],
    });
  }

  return { year, stardateRange, events };
}
