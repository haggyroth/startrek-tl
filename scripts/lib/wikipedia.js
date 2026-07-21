/**
 * Wikipedia overlay — "Timeline of Star Trek".
 *
 * This is NOT a density source: it carries ~120 events for 2233–2402 against
 * Memory Alpha's several thousand. It earns its place by supplying two things
 * Memory Alpha cannot:
 *
 *   1. Explicit divergent-timeline markers. Wikipedia writes year headers as
 *      "* 2233 (alternate timeline):", which is the hand-maintained override
 *      list we would otherwise have had to build by hand.
 *   2. A notability signal. Every event a Wikipedia editor bothered to include
 *      is, by construction, a landmark — which is what `significance` needs.
 *
 * Licensing note: Wikipedia is CC BY-SA 4.0. Only classification signals are
 * taken from it, never prose, but it is still credited in the output metadata.
 *
 * Page shape:
 *   === 23rd century ===
 *   * 2222
 *   ** [[Montgomery Scott]] is born in [[Scotland]].<ref>...</ref>
 *   * 2233 (alternate timeline): Prologue scene of ''[[Star Trek]]''.
 *   ** Ambassador Spock and the Romulan mining ship ''Narada''...
 */

import { fetchWikitext } from "./api.js";
import { cleanText } from "./wikitext.js";

const PAGE = "Timeline of Star Trek";

/**
 * Wikipedia's chronology mixes in production-level entries — "The events of
 * Star Trek: Discovery season 1 take place" — which map a show to a year rather
 * than describing something that happened in it. Memory Alpha year pages have
 * no equivalent, so these can never match and only add noise to the unmatched
 * list. They are not in-universe events and are dropped at parse time.
 */
const PRODUCTION_METADATA =
  /^\s*(?:the events of\b|prologue scene\b)[^.]*\.?\s*/i;

/**
 * Drop the production-metadata sentence and keep whatever real event follows.
 * Entries often read "The events of Star Trek Into Darkness take place. Khan is
 * returned to suspended animation." — discarding the whole line would throw the
 * second sentence away with the first.
 *
 * @returns {string} the in-universe remainder, empty if there is none
 */
export function stripProductionMetadata(text) {
  const sentences = text.split(/(?<=\.)\s+/);
  const kept = sentences.filter((s) => s.trim() && !PRODUCTION_METADATA.test(s));
  return kept.join(" ").trim();
}

/** Century sections spanning 2233–2402. */
const SECTIONS = ["23rd century", "24th century", "25th century"];

/** Map a Wikipedia parenthetical marker to our `timeline` vocabulary. */
function markerToTimeline(marker) {
  if (!marker) return null;
  const s = marker.toLowerCase();
  if (/mirror/.test(s)) return "mirror";
  if (/kelvin/.test(s)) return "kelvin";
  if (/alternate|divergent/.test(s)) return "alternate";
  return null;
}

function extractSection(wikitext, heading) {
  const re = new RegExp(`^===\\s*${heading}\\s*===\\s*$([\\s\\S]*?)(?=^==)`, "m");
  return wikitext.match(re)?.[1] ?? "";
}

/** Strip <ref>...</ref> footnotes — they argue about dating, not about events. */
function stripRefs(s) {
  return s
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
}

/**
 * Fetch and parse the overlay.
 * @returns {Promise<Array<{year: number, text: string, timeline: string|null}>>}
 */
export async function fetchOverlay({ minYear, maxYear }) {
  const wikitext = await fetchWikitext(PAGE, { site: "wp" });
  if (!wikitext) throw new Error(`Wikipedia page not found: ${PAGE}`);

  const entries = [];

  for (const heading of SECTIONS) {
    let year = null;
    let timeline = null;

    for (const rawLine of extractSection(wikitext, heading).split("\n")) {
      const line = stripRefs(rawLine).trimEnd();

      // Year header: "* 2233" or "* 2233 (alternate timeline): description"
      const header = line.match(/^\*(?!\*)\s*(\d{4})[^:]*?(?:\(([^)]*)\))?\s*(?::\s*(.*))?$/);
      if (header) {
        year = Number(header[1]);
        timeline = markerToTimeline(header[2]);
        const inline = header[3] ? stripProductionMetadata(cleanText(header[3])) : "";
        if (inline && year >= minYear && year <= maxYear) {
          entries.push({ year, text: inline, timeline });
        }
        continue;
      }

      // Event line under the current year.
      const bullet = line.match(/^\*\*(?!\*)\s*(.+)$/);
      if (!bullet || year === null) continue;
      if (year < minYear || year > maxYear) continue;

      const text = stripProductionMetadata(cleanText(bullet[1]));
      if (text) entries.push({ year, text, timeline });
    }
  }

  return entries;
}
