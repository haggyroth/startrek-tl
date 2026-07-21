/**
 * Apply the Wikipedia overlay to the Memory Alpha event set.
 *
 * The two sources describe the same events in different prose, so matching is
 * fuzzy: token containment within a small year window. This is deliberately
 * conservative — a missed match costs one event its landmark tier, while a
 * false match misclassifies an event's timeline, which is the worse error.
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "his", "her", "its",
  "are", "was", "were", "been", "being", "have", "has", "had", "his", "them",
  "they", "their", "which", "when", "where", "into", "onto", "over", "after",
  "before", "during", "between", "against", "about", "also", "than", "then",
  "will", "would", "could", "should", "who", "whom", "what", "some", "all",
  "takes", "place", "begins", "ends", "becomes", "made", "make", "new",
]);

/** Years either side of an overlay entry to search for a Memory Alpha match. */
const YEAR_WINDOW = 1;

/** Minimum containment score to accept a match. Tuned against the spike years. */
const MATCH_THRESHOLD = 0.5;

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  );
}

/**
 * Containment rather than Jaccard: Wikipedia entries are terse and Memory Alpha
 * summaries are verbose, so symmetric similarity would under-score every real
 * match purely on length mismatch.
 */
function score(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

/**
 * @param {object[]} events Memory Alpha events (mutated in place)
 * @param {Array<{year:number,text:string,timeline:string|null}>} overlay
 * @returns {{ matched: number, unmatched: object[], reclassified: number }}
 */
export function applyOverlay(events, overlay) {
  const byYear = new Map();
  for (const e of events) {
    if (!byYear.has(e.year)) byYear.set(e.year, []);
    byYear.get(e.year).push(e);
  }

  const unmatched = [];
  let matched = 0;
  let reclassified = 0;
  let conflicts = 0;

  for (const entry of overlay) {
    const entryTokens = tokenize(entry.text);

    let best = null;
    let bestScore = 0;
    for (let y = entry.year - YEAR_WINDOW; y <= entry.year + YEAR_WINDOW; y++) {
      for (const candidate of byYear.get(y) ?? []) {
        const s = score(entryTokens, tokenize(candidate.summary));
        // Same-year matches win ties; a nearby year must beat them outright.
        const adjusted = y === entry.year ? s + 0.01 : s;
        if (adjusted > bestScore) {
          bestScore = adjusted;
          best = candidate;
        }
      }
    }

    if (!best || bestScore < MATCH_THRESHOLD) {
      unmatched.push(entry);
      continue;
    }

    matched++;
    best.significance = 5;
    best.landmark = true;
    if (!best.sources.includes(OVERLAY_SOURCE)) best.sources.push(OVERLAY_SOURCE);

    if (!entry.timeline || entry.timeline === best.timeline) continue;

    // Reclassifying on a fuzzy match alone is unsafe. Prime and divergent
    // versions of the same event are often described in near-identical prose —
    // Kirk is born in Iowa in the prime timeline and aboard the USS Kelvin in
    // the Kelvin one, and those two sentences share almost every token. So the
    // overlay only gets to move an event off `prime` when the event's own
    // citations corroborate it; otherwise we flag it for a human.
    const corroboration = corroborate(best);
    if (corroboration) {
      best.timeline = corroboration;
      reclassified++;
    } else {
      best.timelineConflict = { claimed: entry.timeline, source: "wikipedia" };
      conflicts++;
    }
  }

  return { matched, unmatched, reclassified, conflicts };
}

/** Films 11–13 are Kelvin-timeline by definition. */
const KELVIN_FILMS = new Set([11, 12, 13]);

/**
 * Independent evidence for an event's timeline, drawn from the event itself
 * rather than from the overlay. Returns a timeline name, or null if the event
 * offers no corroboration.
 */
function corroborate(event) {
  // Citing a Kelvin film is not enough on its own: Star Trek (2009) opens
  // before the divergence, so Memory Alpha cites it for prime-timeline events
  // too — prime Kirk's birth cites it alongside TOS, ENT and SNW. Only an
  // *exclusively* Kelvin-cited event is safely Kelvin.
  const cites = event.episodes;
  const kelvinCites = cites.filter((x) => x.kind === "film" && KELVIN_FILMS.has(x.number));
  if (kelvinCites.length && kelvinCites.length === cites.length) return "kelvin";
  // Memory Alpha's own prose already flagged it — the overlay is confirming,
  // not overriding, so the reclassification is safe.
  if (event.timeline !== "prime") return event.timeline;
  return null;
}

export const OVERLAY_SOURCE = "https://en.wikipedia.org/wiki/Timeline_of_Star_Trek";

/**
 * Assign significance to events the overlay didn't reach.
 *
 * Landmarks are already 5. Below that the only signal available is how widely
 * an event is cited — an event referenced by a film or by several episodes is
 * load-bearing in a way a one-line character beat is not. This is a weak proxy
 * and is documented as such.
 */
export function assignBaselineSignificance(events) {
  for (const e of events) {
    if (e.significance != null) continue;
    const citesFilm = e.episodes.some((x) => x.kind === "film");
    e.significance = citesFilm || e.episodes.length >= 3 ? 4 : 3;
    e.landmark = false;
  }
}
