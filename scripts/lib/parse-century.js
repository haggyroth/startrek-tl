/**
 * Parse a Memory Alpha *century* page.
 *
 * Where canon is thin, Memory Alpha keeps no per-year pages: `3189` is a
 * redirect to `32nd century#3189`. Those centuries carry their events on the
 * century page instead, under a different structure:
 *
 *   == Events ==
 *   * <century-wide statement, no specific year>
 *   ;{{visible anchor|3102}}          <- the YEAR, as a definition subheading
 *   :* <event>  ({{DIS|Episode}})
 *   ;{{visible anchor|3125}}
 *   :* <event>
 *
 * Note the `;` subheading means something different here than on a year page,
 * where it is a ship or station. Reusing the year parser would file every
 * event under a group called "3102" and give them all the wrong year, so this
 * is deliberately a separate function rather than a flag on the other one.
 *
 * Bullets appearing before any year anchor describe the century as a whole
 * ("All time travel technology has been outlawed by this century"). They have
 * no year to bin into and are skipped.
 */

import { cleanText, extractCitations, detectTimeline } from "./wikitext.js";
import { extractFacts } from "./facts.js";

const EVENT_SECTIONS = /^(events|other events|births|deaths|alternate timeline events)$/i;

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

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Read a year out of a `;` subheading.
 *
 * Written as `;{{visible anchor|3102}}`, `;3102`, or occasionally with a range
 * or trailing note. Only a bare four-digit year is accepted — anything else is
 * a ship, a station, or prose, and must not be mistaken for a year.
 */
function headingYear(raw) {
  const text = raw.trim();

  // {{visible anchor|3102}} and {{visible anchors|3160|3160s}}. The plural form
  // carries the year and its decade; cleanText keeps the *last* argument, so
  // reading the cleaned text yielded "3160s" and the whole block was skipped.
  const anchor = text.match(/^\{\{\s*visible anchors?\s*\|\s*(\d{4})/i);
  if (anchor) return Number(anchor[1]);

  // A bare year, optionally written as a decade ("3160s").
  const bare = cleanText(text).trim().match(/^(\d{4})s?\b/);
  if (bare) return Number(bare[1]);

  // Anything else is a ship, a station, or prose. Returning null makes the
  // following bullets skip rather than inherit an unrelated year — a registry
  // like NCC-1031 would otherwise read as a plausible four-digit year.
  return null;
}

/**
 * @param {string} wikitext Raw century page wikitext
 * @param {string} sourceUrl Page URL, recorded on every event
 * @param {{ minYear?: number, maxYear?: number }} [bounds]
 * @returns {{ events: object[], skippedCenturyWide: number }}
 */
export function parseCenturyPage(wikitext, sourceUrl, { minYear, maxYear } = {}) {
  const events = [];
  const usedIds = new Map();

  let section = null;
  let inEventSection = false;
  let universe = null;
  let year = null;
  let skippedCenturyWide = 0;

  for (const rawLine of wikitext.split("\n")) {
    const line = rawLine.trimEnd();

    const heading = line.match(/^(=+)\s*(.+?)\s*=+\s*$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 2) {
        section = text;
        inEventSection = EVENT_SECTIONS.test(section);
        universe = sectionTimeline(section);
        year = null;
      } else if (level === 3) {
        universe = sectionTimeline(text) ?? sectionTimeline(section ?? "");
      }
      continue;
    }

    if (!inEventSection) continue;

    // On a century page the ";" subheading is the year.
    const sub = line.match(/^;\s*(.+)$/);
    if (sub) {
      year = headingYear(sub[1]);
      continue;
    }

    const bullet = line.match(/^(?:\*\*(?!\*)|:\*|\*(?!\*))\s*(.+)$/);
    if (!bullet) continue;

    if (year === null) {
      skippedCenturyWide++;
      continue;
    }
    if (minYear != null && year < minYear) continue;
    if (maxYear != null && year > maxYear) continue;

    let source = bullet[1];
    const citations = extractCitations(source);

    // Same trailing-citation convention as year pages.
    source = source.replace(/\s*\([^()]*\{\{[^()]*\)\s*'*\s*$/, "");

    const summary = cleanText(source);
    if (!summary || /^none yet$/i.test(summary)) continue;

    const facts = extractFacts(bullet[1], summary);
    const series = [...new Set(citations.map((c) => c.series))];

    let id = `${year}-${slugify(summary.slice(0, 50))}`;
    const n = (usedIds.get(id) ?? 0) + 1;
    usedIds.set(id, n);
    if (n > 1) id = `${id}-${n}`;

    events.push({
      id,
      year,
      date: null,
      stardate: null,
      timeline: universe ?? detectTimeline(source),
      summary,
      entities: facts.entities,
      kind: facts.kind,
      group: null,
      section,
      series,
      episodes: citations.map((c) => ({
        series: c.series,
        title: c.title,
        kind: c.kind,
        ...(c.number != null ? { number: c.number } : {}),
      })),
      significance: null,
      sources: [sourceUrl],
    });
  }

  return { events, skippedCenturyWide };
}
