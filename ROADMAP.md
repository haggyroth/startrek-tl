# Roadmap

## Phase 1 — Scaffold ✅

- [x] `git init`, `.gitignore`, `README.md`, `CLAUDE.md`
- [x] Directory layout: `data/`, `scripts/`, `src/`
- [x] Event schema defined (see `CLAUDE.md`)

## Phase 2 — Data pipeline ✅

- [x] MediaWiki API client with rate limiting and a local response cache
- [x] Single-year spike (2373) to tune the parser before the full scrape
- [x] Year-page parser for the full 2233–2402 range
- [x] Normalize to the event schema; emit `data/events.json` — 1,533 events
- [x] Wikipedia overlay for timeline classification and landmark tiers
- [x] Tag events with `timeline` (`prime` / `kelvin` / `mirror` / `alternate`)

Outstanding:

- [ ] Review the 2 events in `timelineConflict` and resolve by hand
- [ ] Review `data/unmatched-overlay.json` (65 entries) — some are phrasing
      mismatches that should have matched, some are genuinely absent from
      Memory Alpha year pages
- [ ] Sampled verification pass (exhaustive review of 1,533 records isn't
      realistic; spot-check by era instead)

## Phase 3 — Chart core ✅

- [x] Per-year binning and smoothed density curve
- [x] Dual X-axis: Gregorian year, plus computed stardate for 2323+
- [x] Events stacked within their year, so the curve is the envelope of the
      dots — collision handling falls out of the layout
- [x] Nearest-dot hit layer (2.6px marks can't be hovered directly)
- [x] Hover tooltip: summary, date, stardate, location, series badges, episodes
- [x] Location panel driven by the `group` field, with highlight on select
- [x] Accessible data table view; light and dark themes

## Phase 4 — Filters and interaction ✅

- [x] Series toggles that re-bin the curve live
- [x] Location promoted from highlight to a real filter
- [x] Timeline filter, defaulting to prime-only
- [x] X-axis zoom and pan, with the stardate axis tracking
- [x] Filter and zoom state serialized to the URL hash
- [x] `hashchange` handling, so pasted links and back/forward work
- [x] Live view summary, empty state, and reset-zoom control

## Phase 5 — LCARS chrome ✅

- [x] Elbow frames, header/footer bars, full-height sidebar rail
- [x] Filters as LCARS pill buttons, with a non-colour selected marker
- [x] Responsive fallback for narrow viewports
- [x] Contrast audit — all text clears WCAG AA against its block

## Phase 6 — Polish ✅

- [x] Keyboard navigation: roving tabindex plus arrow/Home/End traversal
- [x] Antonio vendored as a variable woff2 (SIL OFL 1.1)
- [x] `prefers-reduced-motion` support
- [x] Contrast audit on the LCARS palette

## Phase 7 — Fact extraction ✅ (priority tier)

Memory Alpha's *prose* is theirs; the facts are not. Summaries are written
independently from the extracted fact record rather than paraphrased.

- [x] Fact extractor: entities from wiki-link targets, event kind, quoted names
- [x] `data/summaries.json` — authored summaries merged at build time
- [x] `--strict` build mode that refuses to emit scraped prose
- [x] Originality check against the pre-rewrite scrape
- [x] All 175 priority events (significance >= 4) authored — 222/1,533 total

---

## Phase 8 — Correctness and hardening

Everything shipped so far is unverified beyond spot checks. This phase makes
the current state trustworthy before the surface area grows.

- [x] Unit tests for the pipeline: `wikitext`, `parse-year`, overlay matching,
      `state` hash round-trip, stardate conversion, summaries
- [x] Fixture-based regression test — synthetic, so no wiki prose is committed
- [x] Corpus invariants that run against the local cache and skip in CI
- [x] `scripts/validate-data.js` — schema, ordering, and coverage checks
- [x] CI on GitHub Actions: tests + dataset validation. CI cannot rebuild
      `events.json` (the cache is gitignored and re-scraping on every push
      would be rude), so it validates the committed dataset instead
- [~] Branch protection on `main` — **blocked**: GitHub requires a paid plan
      for branch protection and rulesets on private repos. `.githooks/pre-push`
      enforces no-force-push, no-delete and green tests locally in the
      meantime. Apply server-side rules in Phase 15, when the repo goes public
- [x] Resolve the `timelineConflict` events — recorded with reasoning in
      `data/timeline-overrides.json`, enforced by the validator
- [x] Review `data/unmatched-overlay.json`. 30 entries were production metadata
      ("The events of Discovery season 1 take place") and are now stripped at
      parse time, keeping any real event appended after them. The remaining 43
      are in-universe events Wikipedia lists that Memory Alpha's year pages do
      not — a gap in the density source, not a matching failure

## Phase 9 — Comprehensive code review ✅

- [x] Full review of `scripts/` and `src/js/`
- [x] Security review — the parser was probed with pathological wiki markup
      (deep nesting, unbalanced delimiters, 20k-link soup); no catastrophic
      backtracking, worst case 19ms
- [x] Performance check at 1,570 events: 0.68ms per hover, ~12ms per filter,
      ~7ms per zoom step — all inside a frame. Hover cost is O(n) and worth
      re-measuring after Phase 10 expands the corpus
- [x] Fixed: `replaceState` called once per wheel event (rate-limit risk)
- [x] Fixed: hidden data table rebuilt on every filter change
- [x] Fixed: cache rewritten in full after every fetch; now checkpointed
      and written atomically
- [x] Fixed: unguarded `body.parse.wikitext` access; stale user agent

Known and accepted:

- `throttle()` in `api.js` is not concurrency-safe. The pipeline is strictly
  sequential, so this is latent; revisit only if fetching is parallelised.

## Phase 10 — Timeline expansion ✅

- [x] Re-tuned the parser against sample pages before the full run, as planned
- [x] 2063–2410 from year pages: First Contact, the ENT era, the 2160s–2232 gap
- [x] 25th–33rd centuries from **century pages** — sparse years are redirects
      (`3189` → `32nd century#3189`), so those eras needed a second parser
- [x] Era presets, and a default view of 2063–2410 distinct from the full range
- [x] Dev server that sends `no-store`, ending a recurring stale-module trap

2,049 events across 2063–3269. Deliberately *not* done:

- Pre-2063 milestones (the Eugenics Wars, ancient history). Adding them would
  stretch the axis by centuries for a handful of events; the era presets make
  it feasible later if wanted.

## Phase 11 — Complete the rewrite ✅

- [x] "Read on Memory Alpha" surfaced in the tooltip and as a link on the
      table's year cell; stub rows are styled distinctly
- [x] Strict-mode fallback rewritten. Kind-based templates were tried and
      abandoned — entity order does not identify the subject, so they produced
      fabrications ("Birth of Tycho City", "San Francisco graduates"). The
      fallback now says plainly that it is a stub
- [x] Entity extraction filters ranks and lowercase common nouns
- [x] Far future (2411–3269) authored in full — 133 events, the first era at
      100%
- [x] ENT era (2101–2161) authored in full — 213 events
- [x] 2063–2100 authored in full — 53 events
- [x] 2162–2232 gap authored in full — 51 events. Everything before the
      23rd century is now authored
- [x] Fixed a real bug in `verify-summaries.js` found while authoring: names
      ending in a silent "e" (e.g. "Pike") were over-stemmed once a possessive
      was appended, producing false-positive flags. The stemming helpers are
      now in `scripts/lib/verify-text.js` with regression tests
- [x] Fixed a parser bug: a bare stardate prefix ending in a period ("Stardate
      1457.9. ...") never matched the date/stardate regex at all, since it only
      accepted a dash or colon as the closing separator
- [x] Fixed the verifier's stardate-range check, which had no epoch floor and
      flagged real, correctly-authored summaries in pre-2323 years — where
      `CLAUDE.md` already documents stardates as non-monotonic by design
- [x] Found and corrected two `detectTimeline()` misclassifications while
      reading source for authoring (a same-timeline back-reference, and a
      mirror-universe mention inside an italicized aside on an otherwise-prime
      event) — recorded in `data/timeline-overrides.json`, each confirmed as
      the only occurrence of its pattern dataset-wide
- [x] Fixed a real bug in `detectTimeline()` found while authoring: the
      "alternative" word form (as opposed to "alternate") went undetected
      entirely and defaulted to prime. Confirmed two occurrences dataset-wide
      before widening the regex, and deliberately kept "alternative reality"
      out of the kelvin-classification branch, since it is generic wording
      unrelated to Memory Alpha's "alternate reality" Kelvin idiom
- [x] 23rd century authored in full — 453 events. Everything through the 23rd
      century is now authored; the 24th century (1,125 events) is the last
      big chunk
- [x] Extended `verify-summaries.js` to support reviewed stardate-range
      exceptions (`data/verify-exceptions.json`), for cases where a source
      stardate is correct but the year page's own sidebar range is a rounded
      or inconsistent summary of its own citations
- [x] Found and corrected a third `detectTimeline()` misclassification: the
      "alternate reality" phrase rule caught a TNG "Parallels" quantum-reality
      bullet with no Kelvin citation, confirmed as the only such case among
      31 dataset-wide occurrences of the phrase and recorded as a one-off
      override
- [x] Found and corrected a fourth `detectTimeline()` misclassification: a
      `**` sub-bullet nested under an alternate-timeline intro line has no
      section heading to inherit from and no phrase of its own, so it
      defaulted to prime. Confirmed the only such case dataset-wide (grepped
      all 30 "In an(other) alternate timeline" intros for a following nested
      bullet) and recorded both affected events as overrides
- [x] Author the remaining summaries — **2,037 / 2,037 (100%) ✅** — every
      event in the dataset now carries independently authored prose
- [x] Switched the committed build to `--strict`. `npm run build:data` now
      always passes it; `meta.strict` in `data/events.json` reads `true`.
      With every event authored, this changed exactly one field in the
      committed dataset — no content loss, since there was no scraped prose
      left to fall back from. It does mean any future re-scrape that finds a
      new event gets the fact-derived stub, not raw Memory Alpha prose, until
      someone authors it

Phase 11 is complete.

Coverage by era:

| Era | Authored |
|---|---|
| **2063–2100** | **53 / 53 ✅** |
| **ENT (2101–2161)** | **213 / 213 ✅** |
| **Gap (2162–2232)** | **60 / 60 ✅** |
| **23rd century** | **453 / 453 ✅** |
| **24th century** | **1,125 / 1,125 ✅** |
| **Far future** | **133 / 133 ✅** |
| **Total** | **2,037 / 2,037 ✅** |
