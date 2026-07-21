/**
 * Authored summaries.
 *
 * `data/summaries.json` maps event id -> an independently written one-line
 * summary. These are composed from the extracted facts (who, what, when, which
 * episode), not paraphrased from Memory Alpha's prose — a close paraphrase is
 * still a derivative work, so the point is to write from the fact record.
 *
 * The build merges them over the scraped text. Until an event has an authored
 * summary it carries `prose: "source"`, meaning it still holds Memory Alpha
 * wording and is not publishable. `--strict` drops those, which is what a
 * public build must use.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PATH = resolve(ROOT, "data/summaries.json");

export async function loadSummaries() {
  try {
    return JSON.parse(await readFile(PATH, "utf8"));
  } catch {
    return {};
  }
}

export async function saveSummaries(map) {
  // Sorted so the file diffs cleanly as it is filled in over time.
  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(PATH, JSON.stringify(sorted, null, 2) + "\n");
}

/**
 * Apply authored summaries to the event set.
 *
 * @param {object[]} events mutated in place
 * @param {Record<string,string>} authored
 * @param {{ strict?: boolean }} options
 */
export function applySummaries(events, authored, { strict = false } = {}) {
  let covered = 0;

  for (const event of events) {
    const text = authored[event.id];
    if (text) {
      event.summary = text;
      event.prose = "authored";
      covered++;
      continue;
    }

    event.prose = "source";
    if (strict) {
      // Fall back to the fact record rather than publishing scraped prose.
      event.summary = describeFromFacts(event);
    }
  }

  return { covered, total: events.length };
}

/**
 * Last-resort description for an event nobody has rewritten yet.
 *
 * Built only from the fact record, so it carries no Memory Alpha expression.
 *
 * It deliberately does NOT try to phrase the event. Kind-based templates were
 * tried and abandoned: entity order does not reliably identify the subject, so
 * they produced confident fabrications — "Birth of Tycho City" (a place),
 * "San Francisco graduates", "First contact with Zefram Cochrane". A stub that
 * admits it is a stub is worth more than a sentence that is wrong, and `kind`
 * remains available as structured data for anything that wants it.
 */
function describeFromFacts(event) {
  const names = (event.entities ?? []).slice(0, 3);
  if (!names.length) return `Summary not yet written for this ${event.year} event.`;

  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return `Summary not yet written — involves ${list}.`;
}
