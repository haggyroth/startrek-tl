/**
 * Fact extraction.
 *
 * Copyright protects expression, not facts. Memory Alpha's *prose* is theirs;
 * the underlying facts — who, what, when, which episode — are not ownable. This
 * module pulls the structured, unprotectable layer out of a bullet so summaries
 * can be written independently rather than paraphrased.
 *
 * The wiki markup does most of the work for us: Memory Alpha links its entities,
 * so [[Keiko O'Brien]] and [[Pah-wraith]] are already tagged as the subjects of
 * the sentence. What we discard is the connective tissue — the authored prose.
 */

import { SERIES_CODES } from "./wikitext.js";

/** Link targets that are structural rather than subjects of the event. */
const IGNORED_LINKS = new Set([
  "Earth", "Federation", "United Federation of Planets", "Starfleet",
  "stardate", "year", "Alpha Quadrant", "Beta Quadrant", "Gamma Quadrant",
  "Delta Quadrant", "time travel", "alternate timeline", "mirror universe",
]);

/**
 * Event kinds we can identify with confidence. These are facts about the event
 * ("this is a birth"), not phrasings, and they let a summary be generated
 * rather than paraphrased.
 */
const KINDS = [
  ["birth", /\b(?:is|are|was|were)\s+born\b/i],
  ["death", /\b(?:dies|die|is killed|are killed|is assassinated|passes away)\b/i],
  ["launch", /\b(?:is|are)\s+(?:launched|commissioned)\b|\benters service\b/i],
  ["destruction", /\b(?:is|are)\s+destroyed\b|\bis lost with all hands\b/i],
  ["battle", /\bBattle of\b|\bengages\b|\battacks\b/i],
  ["appointment", /\b(?:is promoted|is assigned|takes command|is given command)\b/i],
  ["marriage", /\b(?:marries|are married|weds)\b/i],
  ["treaty", /\b(?:treaty|accords|armistice|cease-?fire)\b/i],
  ["first-contact", /\bfirst contact\b/i],
  ["graduation", /\bgraduates\b/i],
  ["discovery", /\b(?:is discovered|discovers)\b/i],
];

/** Strip a wiki link to its target page, dropping any display text. */
function linkTarget(link) {
  const target = link.split("|")[0].trim();
  // Section anchors point at the same subject.
  return target.split("#")[0].trim();
}

/**
 * Named entities referenced by an event, in order of first appearance.
 *
 * These are link *targets* — the identity of the thing referred to — not the
 * author's chosen wording for it.
 */
export function extractEntities(rawBullet) {
  const seen = new Set();
  const out = [];

  for (const m of rawBullet.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = linkTarget(m[1]);
    if (!target || IGNORED_LINKS.has(target)) continue;
    // Date links ("January 4", "2233") are captured as date fields already.
    if (/^\d{1,4}$/.test(target)) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    out.push(target);
  }

  // Ship templates name a subject without using a wiki link.
  for (const m of rawBullet.matchAll(/\{\{(USS|IKS|ISS|IRW|SS)\|([^}|]+)(?:\|[^}]*)?\}\}/g)) {
    const name = `${m[1]} ${m[2].trim()}`;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }

  return out;
}

/** The kind of event, or null when it doesn't match a confident pattern. */
export function classify(text) {
  for (const [kind, pattern] of KINDS) {
    if (pattern.test(text)) return kind;
  }
  return null;
}

const SERIES_ALT = SERIES_CODES.join("|");

/**
 * Everything factual about a bullet, with the prose deliberately excluded.
 * `sourceText` is carried separately by the caller and must never be published.
 */
export function extractFacts(rawBullet, cleanedText) {
  return {
    entities: extractEntities(rawBullet),
    kind: classify(cleanedText),
    // Quoted in-universe names ("the Enterprise incident") are titles, which
    // are facts about naming rather than authored description.
    quoted: [...cleanedText.matchAll(/"([^"]{2,60})"/g)].map((m) => m[1]),
  };
}

export { SERIES_ALT };
