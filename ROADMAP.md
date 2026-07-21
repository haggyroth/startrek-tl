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

## Phase 3 — Chart core

- [ ] Per-year binning and smoothed density curve
- [ ] Dual X-axis: Gregorian year, plus computed stardate for 2323+
- [ ] Event points positioned on the curve, with collision handling
      (test against 2373–2375, not a quiet decade)
- [ ] Hover tooltip: title, date, stardate, series badge, episode list

## Phase 4 — Filters and interaction

- [ ] Series toggles that re-bin the curve live
- [ ] Timeline filter, defaulting to prime-only
- [ ] X-axis zoom and pan, with the stardate axis tracking
- [ ] Filter and zoom state serialized to the URL hash

## Phase 5 — LCARS chrome

- [ ] Elbow frames and panel layout
- [ ] Series filters as LCARS pill buttons
- [ ] Responsive fallback for narrow viewports

## Phase 6 — Polish

- [ ] Keyboard navigation through events
- [ ] `prefers-reduced-motion` support
- [ ] Contrast audit on the LCARS palette (the purples especially)

## Deferred decisions

- **Licensing.** The dataset is CC BY-NC-SA via Memory Alpha, so no LICENSE file
  has been added. Must be resolved deliberately before publishing.
- **Hosting.** Repo is private and local-only; no remote, no CI, no deploy.
- **Pre-2233 and post-2402 events.** Out of scope for the first pass; the
  schema doesn't preclude them.
