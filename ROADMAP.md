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

## Phase 6 — Polish

- [ ] Keyboard navigation through events (marks are focusable; needs
      arrow-key traversal and a roving tabindex — 1,486 tab stops is not usable)
- [x] `prefers-reduced-motion` support
- [x] Contrast audit on the LCARS palette
- [ ] Consider the Antonio webfont, vendored — currently falling back to a
      condensed system stack

## Deferred decisions

- **Licensing.** The dataset is CC BY-NC-SA via Memory Alpha, so no LICENSE file
  has been added. Must be resolved deliberately before publishing.
- **Hosting.** Repo is private and local-only; no remote, no CI, no deploy.
- **Pre-2233 and post-2402 events.** Out of scope for the first pass; the
  schema doesn't preclude them.
