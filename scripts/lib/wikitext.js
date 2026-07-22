/**
 * Wikitext cleaning and reference extraction.
 *
 * Memory Alpha year pages lean heavily on templates. The ones that matter here:
 *   {{DS9|The Assignment}}      episode citation (series code + title)
 *   {{VOY}} ... {{e|Title}}     series context + bare episode (appendices only)
 *   {{film|8}}                  film citation by production number
 *   {{USS|Defiant|2370}}        ship name with registry/year disambiguation
 *   {{IKS|Rotarran}}            non-Starfleet ship prefix
 *   {{'}}                       possessive apostrophe after italics
 */

/** Series codes that appear as citation templates. */
export const SERIES_CODES = [
  "TOS", "TAS", "TNG", "DS9", "VOY", "ENT",
  "DIS", "PIC", "LD", "PRO", "SNW", "ST", "SA",
];

/** Films by production number, as used by {{film|N}}. */
export const FILMS = {
  1: "Star Trek: The Motion Picture",
  2: "Star Trek II: The Wrath of Khan",
  3: "Star Trek III: The Search for Spock",
  4: "Star Trek IV: The Voyage Home",
  5: "Star Trek V: The Final Frontier",
  6: "Star Trek VI: The Undiscovered Country",
  7: "Star Trek Generations",
  8: "Star Trek: First Contact",
  9: "Star Trek: Insurrection",
  10: "Star Trek Nemesis",
  11: "Star Trek",
  12: "Star Trek Into Darkness",
  13: "Star Trek Beyond",
};

const SERIES_ALT = SERIES_CODES.join("|");

/** English ordinal suffix: 1 -> 1st, 23 -> 23rd, 111 -> 111th. */
function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

/** Zero-argument templates that carry no text of their own. */
const STRUCTURAL_TEMPLATES = new Set([
  "multiple", "mbeta", "timeline nav", "bginfo", "decades", "century nav",
  "sidebar year", "clear", "reflist", "stub", "incomplete",
  "sup", "sub", "nowrap", "small",
]);

/** Zero-argument shortcuts whose name is not the text a reader wants. */
const TEMPLATE_ALIASES = {
  EnterpriseNX: "Enterprise NX-01",
  ColumbiaNX: "Columbia NX-02",
};

/**
 * Template flags that appear as trailing arguments and are not episode titles.
 * Real titles are Title Case; these are lowercase directives.
 */
const NOT_A_TITLE = /^(nolink|in part|small|first|last|\d+)$/i;

/**
 * Extract episode and film citations from a wikitext line.
 *
 * A series template may cite several episodes at once —
 * {{VOY|Message in a Bottle|Equinox}} is two episodes, not one episode with a
 * qualifier — so every argument is treated as a title.
 *
 * @returns {Array<{series: string, title: string, kind: "episode"|"film"}>}
 */
export function extractCitations(line) {
  const out = [];

  const episodeRe = new RegExp(`\\{\\{(${SERIES_ALT})\\|([^}]+)\\}\\}`, "g");
  for (const m of line.matchAll(episodeRe)) {
    for (const arg of m[2].split("|")) {
      const title = arg.trim();
      if (!title || NOT_A_TITLE.test(title)) continue;
      out.push({ series: m[1], title, kind: "episode" });
    }
  }

  for (const m of line.matchAll(/\{\{film\|(\d+)\}\}/g)) {
    const n = Number(m[1]);
    out.push({ series: "FILM", title: FILMS[n] ?? `Film ${n}`, kind: "film", number: n });
  }

  // De-duplicate — the same episode is often cited twice in one bullet.
  const seen = new Set();
  return out.filter((c) => {
    const key = `${c.series}|${c.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Strip wikitext markup down to readable prose.
 *
 * Citation templates are removed entirely — they're captured separately by
 * extractCitations() and would otherwise clutter the summary.
 */
export function cleanText(text) {
  let s = text;

  // Citation templates: drop (captured separately).
  s = s.replace(new RegExp(`\\{\\{(${SERIES_ALT})\\|[^}]*\\}\\}`, "g"), "");
  s = s.replace(new RegExp(`\\{\\{(${SERIES_ALT})\\}\\}`, "g"), "");
  s = s.replace(/\{\{film\|\d+\}\}/g, "");
  s = s.replace(/\{\{e\|([^}|]+)\}\}/g, "$1");
  s = s.replace(/\{\{small\|\(([^)]*)\)\}\}/g, "");

  // Ship templates: {{USS|Defiant|2370}} -> USS Defiant, {{IKS|Rotarran}} -> IKS Rotarran.
  s = s.replace(/\{\{(USS|IKS|ISS|IRW|SS|HMS|ECS)\|([^}|]+)(?:\|[^}]*)?\}\}/g, "$1 $2");

  // Possessive-after-italics helper.
  s = s.replace(/\{\{'\}\}/g, "’");

  // Anchors are invisible link targets. Their argument is not display text —
  // leaving it in produced "April_5thApril 5th – ...".
  s = s.replace(/\{\{\s*(?:visible\s+)?anchors?\s*\|[^}]*\}\}/gi, "");

  // {{nth|23|sup}} renders an ordinal number. The last-argument rule read the
  // formatting hint instead, leaving "June sup:" where "June 23rd" belonged.
  s = s.replace(/\{\{\s*nth\s*\|\s*(\d+)[^}]*\}\}/gi, (_, n) => ordinal(Number(n)));

  // Zero-argument templates are almost all name shortcuts: {{EnterpriseNX}},
  // {{Shran}}, {{Trip Tucker}}. Deleting them removed the subject of the
  // sentence outright — "The keel of, Earth's first warp 5-capable starship,
  // is laid". Only genuinely structural ones are dropped.
  s = s.replace(/\{\{([^}|]+)\}\}/g, (_, name) => {
    const key = name.trim();
    if (STRUCTURAL_TEMPLATES.has(key.toLowerCase())) return "";
    return TEMPLATE_ALIASES[key] ?? key;
  });

  // Disambiguation links. Argument count changes which part is displayed:
  //   {{dis|Vulcan|planet}}                      -> "Vulcan"  (2 args: page, qualifier)
  //   {{dis|Starfleet uniform|2370s|design}}     -> "design"  (3+ args: last is display)
  // Getting this backwards silently rewrites prose ("exile on planet"), so the
  // two cases are handled separately rather than with one "last argument" rule.
  s = s.replace(/\{\{dis\|([^}]*)\}\}/gi, (_, args) => {
    const parts = args.split("|").map((p) => p.trim());
    return parts.length <= 2 ? parts[0] : parts[parts.length - 1];
  });

  // Any remaining template: keep the last argument, which is the display text
  // in nearly every Memory Alpha template. Bare templates ({{mbeta}}) drop.
  s = s.replace(/\{\{([^}]+)\}\}/g, (_, args) => {
    const parts = args.split("|");
    return parts.length > 1 ? parts[parts.length - 1].trim() : "";
  });

  // Wiki links: [[Target|Display]] -> Display, [[Target]] -> Target.
  s = s.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1");
  s = s.replace(/\[\[([^\]]+)\]\]/g, "$1");

  // External links: [url Display] -> Display.
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1");

  // Emphasis markup.
  s = s.replace(/'''''|'''|''/g, "");

  // HTML entities and tags.
  s = s.replace(/&ndash;/g, "–").replace(/&mdash;/g, "—");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  s = s.replace(/<ref[^>]*>.*?<\/ref>/gs, "").replace(/<[^>]+>/g, "");

  // Whitespace and orphaned punctuation left behind by removed templates.
  // Multi-citation groups — "({{film|8}}; {{DS9|Rapture}})" — collapse to "(;)",
  // so drop any parenthetical left holding nothing but punctuation.
  s = s.replace(/\([^A-Za-z0-9]*\)/g, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\s+([.,;:])/g, "$1");

  return s;
}

/**
 * Detect which timeline an event belongs to, from its prose.
 *
 * This is a heuristic and deliberately conservative: it only reclassifies on
 * strong signals, defaulting to prime. Flagged events should be reviewed by
 * hand rather than trusted outright.
 */
export function detectTimeline(text) {
  const s = text.toLowerCase();
  if (/mirror universe|terran empire|\bi\.s\.s\.|\biss /.test(s)) return "mirror";
  // "Alternate reality" is Memory Alpha's specific idiom for the Kelvin
  // timeline (see CLAUDE.md); "alternative reality" is not the same idiom and
  // is only ever used generically elsewhere (confirmed: one occurrence
  // dataset-wide, a VOY-only temporal-fragmentation episode unrelated to the
  // 2009 film), so it is deliberately NOT added to this line.
  if (/kelvin timeline|alternate reality/.test(s)) return "kelvin";
  if (
    /alternate timeline|alternate future|alternative timeline|alternative future|alternative reality|unrealized|never happened/.test(
      s,
    )
  ) {
    return "alternate";
  }
  return "prime";
}

/** Parse a sidebar stardate range like "50032.7 &ndash; 50984.3". */
export function parseStardateRange(raw) {
  if (!raw) return null;
  const nums = cleanText(raw).match(/\d+(?:\.\d+)?/g);
  if (!nums?.length) return null;
  return nums.length === 1
    ? { start: nums[0], end: nums[0] }
    : { start: nums[0], end: nums[nums.length - 1] };
}
