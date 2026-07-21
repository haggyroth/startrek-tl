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
 * Last-resort description built only from structured facts, for strict builds
 * of events nobody has written yet. Deliberately terse and obviously generated
 * — it is a placeholder, not a substitute for an authored line.
 */
function describeFromFacts(event) {
  const subject = event.entities?.slice(0, 3).join(", ");
  const kind = event.kind ? event.kind.replace(/-/g, " ") : "event";
  if (subject) return `${kind}: ${subject} (${event.year})`;
  return `${kind} recorded in ${event.year}`;
}
