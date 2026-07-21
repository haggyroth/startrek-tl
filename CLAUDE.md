# startrek-tl

Interactive timeline of Star Trek canon events. Static single-page site: an
event-density sparkline across 2233–2402 with a dual X-axis (Gregorian year and
stardate), hoverable event points, and per-series filters, wrapped in LCARS
chrome.

## Stack

Vanilla HTML/CSS/JS with D3 for the chart. **No build step, no bundler, no
framework.** `src/index.html` is opened directly or served statically; ES modules
are loaded natively by the browser. Do not introduce npm dependencies for the
site itself — Node is used only for the offline data pipeline in `scripts/`.

## Layout

```
data/        events.json (committed, generated), events.raw.json (API cache)
scripts/     Node data pipeline: fetch → parse → normalize → emit
src/         index.html, css/, js/ — the site itself
```

## Domain constraints

These are the non-obvious rules that make the project correct. Violating them
produces output that looks fine and is wrong.

**Stardates are not linearly convertible across eras.** TNG-era only:
`stardate = 41000 + 1000 × (year − 2364)`, valid from 2323 onward. TOS-era
stardates (1312.4, 3045.6, …) are inconsistent by design and have no calendar
mapping. Therefore: store the *literal* stardate from the episode as a per-event
field; compute the stardate axis only for 2323+. Never extrapolate the TNG
formula backward.

**Memory Alpha is CC BY-NC-SA.** The dataset is derived from it, so it cannot be
relicensed permissively or used commercially, and attribution is required if the
project is ever published. The repo is intentionally private and intentionally
has no LICENSE file — that is a pending decision, not an oversight. Do not add
one without discussing it.

**Scrape via the MediaWiki API** (`memory-alpha.fandom.com/api.php`), never HTML
scraping. Rate-limit requests and always read from `data/events.raw.json` when
present so re-runs don't re-hit the wiki.

**Alternate timelines are separate.** Every event carries a `timeline` field
(`prime`, `kelvin`, `mirror`, `alternate`). The UI defaults to prime-only. Kelvin
and Mirror events must never be binned into the same density curve as prime canon
by default.

**Never reclassify a timeline on a fuzzy match alone.** Prime and divergent
versions of the same event are often near-identical in prose — Kirk is born in
Iowa in the prime timeline and aboard the USS Kelvin in the Kelvin one. The
Wikipedia overlay may only move an event off `prime` when the event's own
citations corroborate it; otherwise the pipeline sets `timelineConflict` and
leaves the classification alone. Citing a Kelvin film is not corroboration on its
own, because Star Trek (2009) opens before the divergence and is cited for
prime-timeline events too. Only *exclusively* Kelvin-cited events are Kelvin.

## Event schema

```jsonc
{
  "id": "2364-slug-of-the-summary",  // stable, collision-suffixed
  "year": 2364,                      // required — drives binning
  "date": "2364-03-15",              // optional; may be partial ("2364-03")
  "stardate": "41153.7",             // optional, literal — string, never computed
  "timeline": "prime",               // prime | kelvin | mirror | alternate
  "summary": "string",
  "group": "USS Enterprise",         // ship/station subheading, when present
  "section": "Events",
  "series": ["TNG"],
  "episodes": [{ "series": "TNG", "title": "Encounter at Farpoint", "kind": "episode" }],
  "significance": 3,                 // 5 landmark, 4 widely cited, 3 default
  "landmark": false,                 // matched a Wikipedia overlay entry
  "timelineConflict": null,          // set when the overlay's claim couldn't be corroborated
  "sources": ["https://memory-alpha.fandom.com/wiki/2364"]
}
```

Series codes: `TOS TAS SNW DIS TNG DS9 VOY LD PRO PIC ENT ST` plus `FILM`.

`date` is deliberately variable-precision. A "January 4" prefix gives a full
date; a bare "* March" heading gives `YYYY-MM`. Never widen a partial date by
guessing a day — the UI must handle both lengths.

Coverage is sparse and that is expected: of ~1,530 events, roughly 40 carry a
date and 90 a stardate. The tooltip must degrade gracefully.

## Chart behavior

- Y-axis is **event density per year** — count of events in that year, smoothed.
- Series filters re-bin the curve live; they do not merely hide points. The
  waveform must respond to the active filter set.
- Filter and zoom state serializes to the URL hash so views are linkable.

## Conventions

- Conventional Commits; feature branches off `main`; no force-push to `main`.
- Data changes and site changes go in separate commits — `data/events.json` is
  generated, and mixing it with hand-written code obscures both diffs.
- Regenerating data is `node scripts/build-events.js`; it must be idempotent and
  must not reorder unchanged records (keeps diffs reviewable).

## Working notes

- Phase 2 (the scrape) is the project's main risk: wiki year pages are
  inconsistently formatted. Tune the parser against a single year before running
  the full 2233–2402 range.
- Dense years (the Dominion War, 2373–2375) will spike hard and need point
  collision handling — test the chart against those years, not a quiet decade.
