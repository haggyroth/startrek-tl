/**
 * Rebuild an id -> source-event index from the raw scrape cache.
 *
 * Shared by verify-summaries.js and sample-summaries.js, both of which need
 * to look up the exact bullet an authored summary was written from.
 */

import { parseYearPage } from "./parse-year.js";
import { parseCenturyPage } from "./parse-century.js";

/**
 * @param {Record<string,string>} cache raw wikitext keyed "ma:<year or century>"
 * @returns {{ sourceById: Map<string,object>, rangeByYear: Map<number,object> }}
 */
export function buildSourceIndex(cache) {
  const sourceById = new Map();
  const rangeByYear = new Map();

  for (const [key, wikitext] of Object.entries(cache)) {
    if (!key.startsWith("ma:") || !wikitext) continue;
    const title = key.slice(3);
    const year = Number(title);

    if (Number.isFinite(year)) {
      const parsed = parseYearPage(wikitext, year);
      if (parsed.stardateRange) rangeByYear.set(year, parsed.stardateRange);
      for (const e of parsed.events) sourceById.set(e.id, e);
    } else if (/century$/i.test(title)) {
      const url = `https://memory-alpha.fandom.com/wiki/${encodeURIComponent(title)}`;
      for (const e of parseCenturyPage(wikitext, url).events) sourceById.set(e.id, e);
    }
  }

  return { sourceById, rangeByYear };
}
