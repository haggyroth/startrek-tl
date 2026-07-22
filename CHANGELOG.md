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

## [1.6.0]

- feat(data): scripts/verify-summaries.js — mechanical accuracy check over
  authored summaries
- feat(data): data/verify-exceptions.json for reviewed deviations
- docs: AUTHORING.md — house style and workflow for the remaining summaries
- docs: verification method and error rate published in the README
- data: 3 substantive summary errors found and corrected

## [1.5.0]

- data: ENT era (2101–2161) authored in full; 591 of 2,037 summaries (29%)
- fix(data): {{nth|23|sup}} rendered as "sup" instead of an ordinal
- fix(data): month-range headings ("October-December") became events
- feat(data): bare day prefixes ("19th – ...") resolve against the month heading
- feat(data): production notes about unmade films and games are not events

## [1.4.0]

- feat(ui): source link in the tooltip and on the table's year cell
- feat(data): honest stub text for unauthored events in strict builds
- feat(data): entity extraction drops ranks and lowercase common nouns
- data: far future authored in full; 389 of 2,040 summaries (19%)
- fix(data): zero-argument alias templates ({{EnterpriseNX}}, {{Shran}}) were
  deleted along with the sentence's subject
- fix(data): {{anchor|...}} leaked its argument into prose
- fix(data): bare "None" placeholders and eight name-only list entries were
  being emitted as events

## [1.3.0]

- feat(data): expand to 2063–3269 — 2,049 events, up from 1,570
- feat(data): century-page parser for eras whose years are redirects
- feat(data): SA (Starfleet Academy) series code and ECS ship prefix
- feat(ui): era presets, with a default view of 2063–2410
- fix(data): ordinal date prefixes ("July 13th") were unparsed
- fix(data): universe subheadings now set the timeline; "alternate reality" is
  the Kelvin timeline and was being filed as a generic alternate one
- fix(data): {{visible anchors|3160|3160s}} blocks were skipped entirely
- fix(dev): serve with no-store so edited modules are never served stale

## [1.2.0]

- fix(state): coalesce hash writes; zoom called replaceState once per wheel
  event and could hit the browser's rate limit
- perf(ui): render the data table only when visible, not on every filter change
- perf(data): checkpoint the scrape cache instead of rewriting it per fetch
- fix(data): write the cache atomically so a crash cannot truncate it
- fix(data): guard against unexpected API response shapes
- test: 84 tests

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
