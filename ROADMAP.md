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

## Possible next steps

- Resolve the 2 `timelineConflict` events and review
  `data/unmatched-overlay.json`
- Extend beyond 2233–2402 (the schema already allows it)
- Sampled verification pass over the dataset by era

## Phase 7 — Fact extraction and licensing (in progress)

Memory Alpha's *prose* is theirs; the facts are not. To license the project
cleanly, every summary must be written independently from the extracted fact
record rather than paraphrased from the source.

- [x] Fact extractor: entities from wiki-link targets, event kind, quoted names
- [x] `data/summaries.json` — authored summaries merged over the scrape
- [x] `--strict` build mode that refuses to emit scraped prose
- [x] Originality check comparing authored lines against the source
- [ ] Author the remaining summaries (47 / 1,533 done)
- [ ] Rewrite git history before publishing — earlier commits still contain
      the verbatim scrape
- [ ] Add LICENSE (code) and data/LICENSE once the rewrite is complete

## Deferred decisions

- **Licensing.** The dataset is CC BY-NC-SA via Memory Alpha, so no LICENSE file
  has been added. Must be resolved deliberately before publishing.
- **Hosting.** Repo is private and local-only; no remote, no CI, no deploy.
- **Pre-2233 and post-2402 events.** Out of scope for the first pass; the
  schema doesn't preclude them.
