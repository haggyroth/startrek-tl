# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- feat(data): fact extractor — entities, event kind, quoted names
- feat(data): authored summaries in data/summaries.json, merged at build time
- feat(data): --strict build mode that never emits scraped prose
- data: 222 authored summaries — all 175 landmark and widely-cited events, plus 2233-2245

## [Unreleased]

- data: resolve both timelineConflict events via data/timeline-overrides.json
- feat(data): strip Wikipedia production metadata from the overlay, keeping any
  real event appended after it — landmark matches 47 -> 49, unmatched 65 -> 43
- feat(data): validator now checks overrides and fails on open conflicts

## [1.1.0]

- test: 78-test suite on node:test — no dependencies
- test: synthetic year-page fixture pinning exact parse output
- test: corpus invariants that run against the local scrape and skip in CI
- feat(ci): GitHub Actions running tests and dataset validation
- feat(data): scripts/validate-data.js — schema, ordering and coverage checks
- fix(data): nested "**" bullets were dropped, losing 37 events including the
  Battle of the Binary Stars
- fix(data): month and stardate headings leaked their date onto later
  top-level bullets, fabricating 31 stardate attributions
- fix(data): a stardate heading ending in a period captured the period

## [1.0.0]

- feat(a11y): keyboard navigation with a roving tabindex and arrow/Home/End keys
- feat(ui): vendor the Antonio variable webfont (SIL OFL 1.1)
- fix(a11y): chart used role="img", hiding its focusable marks from assistive tech
- fix(chart): tooltip skipped rendering on keyboard focus

## [0.5.0]

- feat(ui): LCARS chrome — elbow frames, header/footer bars, sidebar rail
- feat(ui): filters restyled as LCARS pill buttons with a non-colour selected marker
- feat(ui): responsive fallback that drops the elbow geometry below 720px
- fix(ui): Reset zoom ignored its hidden attribute because .chip set display

## [0.4.0]

- feat(filters): timeline, series and location filters that re-bin the curve
- feat(chart): wheel zoom and drag pan on the year axis, with reset control
- feat(state): filter and zoom state serialized to the URL hash
- feat(a11y): live view summary and empty state
- fix(chart): re-sync the zoom transform on resize
- fix(chart): cap stack row height so sparse filters render compactly

## [0.3.0]

- feat(chart): stacked-dot density chart with year and stardate axes
- feat(chart): nearest-dot hover tooltip with date, stardate, location and episodes
- feat(chart): location panel highlighting events by ship or station
- feat(a11y): keyboard-focusable marks, data table view, light and dark themes
- chore: vendor D3 locally instead of loading it from a CDN

## [0.2.0]

- chore: scaffold project — repo layout, README, roadmap, event schema
- feat(data): Memory Alpha API client with rate limiting and local caching
- feat(data): year-page parser — events, citations, dates, stardates, groups
- feat(data): Wikipedia overlay for timeline classification and landmark tiers
- feat(data): full 2233–2402 build emitting 1,533 events to data/events.json
