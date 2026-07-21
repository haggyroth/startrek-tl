/**
 * Filter and view state, serialized to the URL hash so any view is linkable.
 *
 * Hash format (all parts optional, defaults omitted):
 *   #timeline=prime&series=DS9,TNG&location=Deep+Space+9&years=2360-2380
 */

export const FULL_RANGE = [2233, 2402];

export const DEFAULT_STATE = {
  timeline: "prime",
  /** null means "all series"; a Set means an explicit selection. */
  series: null,
  location: null,
  /** Visible year range. null means the full range. */
  years: null,
};

function parseYears(raw) {
  const m = /^(\d{4})-(\d{4})$/.exec(raw ?? "");
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (from >= to) return null;
  // Clamp rather than reject: a hand-edited URL should still resolve.
  return [
    Math.max(FULL_RANGE[0], from),
    Math.min(FULL_RANGE[1], to),
  ];
}

export function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const series = params.get("series");

  return {
    timeline: params.get("timeline") ?? DEFAULT_STATE.timeline,
    series: series ? new Set(series.split(",").filter(Boolean)) : null,
    location: params.get("location") || null,
    years: parseYears(params.get("years")),
  };
}

let pendingWrite = null;

/**
 * Coalesce hash writes.
 *
 * A single trackpad zoom emits dozens of wheel events, and writing the hash on
 * each one hits the browser's replaceState rate limit — Safari throws a
 * SecurityError past ~100 calls in 30 seconds. Callers that fire continuously
 * use this; discrete changes like a filter click can write immediately.
 */
export function scheduleHashWrite(state) {
  if (pendingWrite !== null) clearTimeout(pendingWrite);
  pendingWrite = setTimeout(() => {
    pendingWrite = null;
    writeHash(state);
  }, 150);
}

export function writeHash(state) {
  // A queued coalesced write would otherwise land after this one and undo it.
  if (pendingWrite !== null) {
    clearTimeout(pendingWrite);
    pendingWrite = null;
  }

  const params = new URLSearchParams();

  if (state.timeline !== DEFAULT_STATE.timeline) params.set("timeline", state.timeline);
  if (state.series?.size) params.set("series", [...state.series].sort().join(","));
  if (state.location) params.set("location", state.location);
  if (state.years) params.set("years", `${state.years[0]}-${state.years[1]}`);

  const hash = params.toString();
  const url = hash ? `#${hash}` : location.pathname + location.search;

  // replaceState, not assignment — filter changes shouldn't stack up in history.
  history.replaceState(null, "", url);
}

/**
 * Events matching the filter state, in the order the chart should stack them.
 *
 * Timeline is applied first and separately: prime and divergent canon must
 * never share a density curve, so it is not just another filter dimension.
 */
export function applyFilters(events, state) {
  return events.filter((e) => {
    if (state.timeline !== "all" && e.timeline !== state.timeline) return false;
    if (state.series && !e.series.some((s) => state.series.has(s))) return false;
    if (state.location && e.group !== state.location) return false;
    return true;
  });
}
