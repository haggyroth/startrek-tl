# startrek-tl

Interactive timeline of Star Trek canon events. Static single-page site: an
event-density sparkline across 2063–3269 with a dual X-axis (Gregorian year and
stardate), hoverable event points, era presets, and per-series filters, wrapped
in LCARS chrome.

## Stack

Vanilla HTML/CSS/JS with D3 for the chart. **No build step, no bundler, no
framework.** `src/index.html` is served statically; ES modules are loaded
natively by the browser. Do not introduce npm dependencies for the site itself —
Node is used only for the offline data pipeline in `scripts/`.

Third-party assets are **vendored**, never loaded from a CDN, so the page works
offline and under a strict CSP: `src/vendor/d3.min.js` and the Antonio variable
webfont at `src/vendor/fonts/` (SIL OFL 1.1 — keep `OFL.txt` beside it). Update
either by re-downloading; there is nothing to build.

**Serve from the repository root**, not from `src/` — the page fetches
`../data/events.json`. `npm run serve`, then open `/src/`.

## Layout

```
data/        events.json (generated), summaries.json (authored prose),
             timeline-overrides.json, verify-exceptions.json,
             events.raw.json (API cache, gitignored)
scripts/     Node data pipeline: fetch → parse → normalize → emit, plus
             validate-data.js, verify-summaries.js and the dev server
src/         index.html, css/, js/ — the site itself
test/        node:test suite; fixtures are synthetic
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
relicensed permissively or used commercially, and attribution is required. The
repo is dual-licensed: code under MIT (`LICENSE`), data under CC BY-NC-SA
(`data/LICENSE.md`). Never move data-derived content into an MIT-covered path,
and never claim the data files themselves are MIT.

**Two page types, two parsers.** Dense eras have per-year pages
(`parse-year.js`). Sparse ones don't — `3189` redirects to `32nd century#3189` —
so those come from century pages (`parse-century.js`), where a `;` subheading is
the *year*, not a ship. Never reuse one parser for the other page type.

**"Alternate reality" means the Kelvin timeline** in Memory Alpha's vocabulary.
A section matcher that tests a generic alternate-timeline pattern first will
silently misfile every Kelvin event.

**The default view is narrower than the data.** `FULL_RANGE` is 2063–3269 but
the chart opens on `DEFAULT_VIEW` (2063–2410): beyond 2410 there are about a
hundred events across 860 years, and on one linear axis they would squeeze the
populated timeline into a third of the width.

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

**Timeline conflicts are resolved by hand, once.** When the overlay's claim
can't be corroborated the pipeline records `timelineConflict`; a human then
decides and the decision goes in `data/timeline-overrides.json` *with its
reasoning*. The validator fails on any open conflict and on any override
lacking a note, so resolutions are never silently re-litigated.

`data/timeline-overrides.json` isn't limited to overlay conflicts — it's a
general hand-reviewed corrections file. `detectTimeline()`'s phrase matching
also gets fooled directly (not via the overlay) by a same-timeline
back-reference bullet, or by a mirror/alternate mention buried in an
italicized aside on an otherwise-prime event. Confirm a pattern is a genuine
one-off (`grep -c` the phrase across `data/events.raw.json`) before adding an
override; if it recurs, fix the parser instead.

**Wikipedia's chronology mixes in production metadata** — "The events of
Discovery season 1 take place". Those are not in-universe events. They are
stripped sentence-wise at parse time, keeping any real event appended after
them; discarding whole entries cost three legitimate landmark matches.

**Never generate prose that asserts a relationship the facts don't establish.**
The strict-build fallback originally used per-kind templates and produced
"Birth of Tycho City" (a place) and "San Francisco graduates" — the first
entity is not reliably the subject. A stub that admits it is a stub beats a
sentence that is wrong.

**Zero-argument templates are name shortcuts**, not noise: `{{EnterpriseNX}}`,
`{{Shran}}`, `{{Trip Tucker}}`. Dropping them deletes the subject of the
sentence. Only genuinely structural ones belong in the drop list.

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

Coverage is sparse and that is expected: of ~2,040 events, roughly 100 carry a
date and 90 a stardate. The tooltip must degrade gracefully.

## CSS conventions

Theme variables are defined on `:root`. The tooltip is appended to `<body>`,
outside the app container — variables scoped to a wrapper class resolve to
nothing there and the tooltip renders transparent.

**Two palettes, deliberately.** The chrome uses LCARS "Classic" hues
(thelcars.com); the chart interior uses the validated data-viz steps `#3987e5`
events / `#c98500` landmarks, which clear the all-pairs CVD and normal-vision
floors. Do not repaint the marks in LCARS hues — at ~1,500 marks the chart needs
conventional treatment to stay readable. Re-run the palette validator before
changing chart colours.

**The design commits to a single dark look.** LCARS has no light mode; a light
variant would be a different design, not a theme swap. The usual
`prefers-color-scheme` pairing is intentionally absent.

Selected state on pills is never colour alone — `[aria-pressed="true"]` also
draws a leading block marker, so selection survives greyscale, CVD and
forced-colors.

Setting `display` on a class that also uses the `hidden` attribute overrides the
UA `[hidden]` rule. Any such class needs an explicit `[hidden] { display: none }`.

All text must clear WCAG AA (4.5:1) against its block. LCARS convention is black
text on saturated fills, which passes comfortably; the risk is muted or
low-opacity text, so measure rather than assume.

## Chart behavior

- Y-axis is **event density per year** — count of events in that year, smoothed.
- Events are **stacked within their year**: an event's vertical position is its
  index in that year's bin, so the curve is exactly the envelope of the dots
  rather than a separate abstraction drawn over them. Collision handling falls
  out of the layout; do not add jitter.
- Pointer hit-testing goes through a transparent overlay rect that resolves to
  the nearest dot. Individual marks are ~2.6px and cannot be hovered reliably.
  Keyboard focus stays on the circles themselves.
- The two X axes (year, stardate) are one dimension in two notations — a unit
  conversion, not a dual-axis chart. Never add a second *measure* axis.
- Series filters re-bin the curve live; they do not merely hide points. The
  waveform must respond to the active filter set.
- The Y domain follows the *filtered* data, and plot height follows the Y
  domain (rows are capped at 26px). Without the cap a max-of-1 view strands a
  lone dot halfway up a 520px plot.
- Filter and zoom state serializes to the URL hash so views are linkable.

## Accessibility

- The chart SVG is `role="group"`, **not** `role="img"` — `img` makes assistive
  tech treat the subtree as one opaque graphic and hides the focusable marks.
- Tabindex on the marks is **roving**: exactly one is in the tab order, and
  arrow keys move the cursor. ~1,500 tab stops is not navigation, and skipping
  the chart entirely would make it unreachable.
- Keyboard handlers drive the tooltip directly rather than relying on the focus
  event as a side channel. `event.target` / `currentTarget` are only populated
  during a real dispatch, so look nodes up by id instead.

## State

`state.js` owns filter state and URL serialization; `main.js` is the only place
that mutates it. State flows one way — `update()` patches state, then everything
re-derives from it — so the URL, the controls and the chart cannot disagree.

- Writes use `replaceState`, so filter changes don't fill up the back button.
- A `hashchange` listener re-reads state, which is what makes pasted links and
  browser back/forward work. `replaceState` doesn't fire it, so there's no loop.
- Zoom is a **view** control, not a filter: it never changes which events are in
  the filter set, so counts are reported separately from the visible range.
- d3-zoom's transform is in pixel space, so it must be re-synced on resize and
  whenever the domain is set in code — otherwise the same transform silently
  means a different year range.

## Verification

`npm run verify:summaries` checks authored prose against the source bullet it
was written from: proper nouns and numbers must be traceable, dates must match
the event's year, stardates must fall in the year page's range. It needs the
local scrape cache, so it runs locally rather than in CI.

- Reviewed deviations go in `data/verify-exceptions.json` **with reasoning**,
  like `timeline-overrides.json`. Never silence a flag without one.
- The checker needs stemming to be useful — possessives and plural or
  adjectival forms ("Archer's", "Andorians") are the same fact stated
  differently, and without it nearly every summary trips the check.
- Stem a possessive *before* stripping punctuation, not after. `"Pike's"` with
  the apostrophe removed first becomes `"Pikes"`, and the generic plural-`es`
  rule then over-trims it to `"pik"` — any name ending in a silent "e" breaks
  this way once a possessive is appended. The stemming helpers live in
  `scripts/lib/verify-text.js` and are unit tested; extend the tests before
  changing the regex.
- It cannot judge meaning. That is sampled by hand; see the README.

See `AUTHORING.md` before writing summaries.

## Testing

`npm test` (node:test, no dependencies) and `npm run validate:data`. Both run in
CI on every push and pull request.

- Fixtures are **synthetic**. Never commit real Memory Alpha wikitext as a test
  fixture — that reintroduces the licensing problem the rewrite exists to solve.
- `test/corpus.test.js` runs against the local scrape cache and skips when it is
  absent, which is why CI cannot run it.
- CI cannot rebuild `events.json` (the cache is gitignored, and re-scraping on
  every push would be rude), so it validates the committed dataset instead.
- The fixture asserts exact event count and ids on purpose: the parser bugs in
  this project have all been silent ones that dropped records without erroring.

## Conventions

- Conventional Commits; feature branches off `main`; no force-push to `main`.
- The repo is public, with server-side branch protection on `main` blocking
  force-pushes and deletion. `.githooks/pre-push` still enforces the same
  locally (plus green tests before push) — enable with
  `git config core.hooksPath .githooks`. No required PR reviews or status
  checks: the workflow is local feature branch -> `merge --no-ff` -> direct
  push to `main`, and requiring status checks would block that push outright.
- Data changes and site changes go in separate commits — `data/events.json` is
  generated, and mixing it with hand-written code obscures both diffs.
- Regenerating data is `npm run build:data` (`node scripts/build-events.js
  --strict`); it must be idempotent and must not reorder unchanged records
  (keeps diffs reviewable). The committed build is strict — never regenerate
  with a plain `node scripts/build-events.js` and commit the result, since
  that would silently reintroduce scraped Memory Alpha prose for any
  not-yet-authored event.

## Working notes

- Phase 2 (the scrape) is the project's main risk: wiki year pages are
  inconsistently formatted. Tune the parser against a single year before running
  the full 2233–2402 range.
- Dense years (the Dominion War, 2373–2375) will spike hard and need point
  collision handling — test the chart against those years, not a quiet decade.
