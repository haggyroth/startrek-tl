/**
 * Dataset loading and derivation.
 *
 * Everything downstream reads from the shapes built here, so filtering and
 * re-binning stay in one place.
 */

const DATA_URL = "../data/events.json";

/** Stardates are linear only from 2323 onward. See CLAUDE.md. */
export const STARDATE_EPOCH_YEAR = 2323;

/**
 * Convert a Gregorian year to a TNG-era stardate.
 * Returns null before the epoch, where no linear mapping exists.
 */
export function yearToStardate(year) {
  if (year < STARDATE_EPOCH_YEAR) return null;
  return (year - STARDATE_EPOCH_YEAR) * 1000;
}

export async function loadEvents() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}: HTTP ${res.status}`);
  const raw = await res.json();

  // Sort within each year so stacking order is stable across re-renders.
  const events = raw.events
    .slice()
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

  return { meta: raw.meta, years: raw.years, events };
}

/**
 * Bin events into per-year columns and assign each event its stack index.
 *
 * The stack index is what makes the chart work: an event's vertical position
 * is its position within its year, so the density curve is exactly the envelope
 * of the stacked dots rather than a separate smoothed abstraction drawn over
 * them. Collision handling falls out of the layout for free.
 */
export function binByYear(events, [minYear, maxYear]) {
  const bins = new Map();
  for (let y = minYear; y <= maxYear; y++) bins.set(y, []);

  for (const e of events) {
    const bin = bins.get(e.year);
    if (!bin) continue;
    e.stackIndex = bin.length;
    bin.push(e);
  }

  return [...bins.entries()].map(([year, items]) => ({
    year,
    count: items.length,
    events: items,
  }));
}

/** Distinct locations (the `group` field), most frequent first. */
export function locationsByFrequency(events, limit = 12) {
  const counts = new Map();
  for (const e of events) {
    if (!e.group) continue;
    counts.set(e.group, (counts.get(e.group) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/** All series codes present, most frequent first. */
export function seriesByFrequency(events) {
  const counts = new Map();
  for (const e of events) {
    for (const s of e.series) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));
}
