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

## Phase 9 — Comprehensive code review

- [ ] Full review of `scripts/` and `src/js/` for correctness and dead code
- [ ] Security review (the pipeline fetches and parses untrusted wiki markup)
- [ ] Accessibility audit beyond the contrast pass already done
- [ ] Performance check at 1,500+ marks, and after the timeline expansion

## Phase 10 — Timeline expansion

Deliberately after hardening: expanding first would multiply the cost of every
bug found in Phase 8. The schema and pipeline already allow any year range.

- [ ] 22nd century (ENT, 2151–2161) and the 2160s–2232 gap
- [ ] 25th century beyond 2402, and the 32nd (DIS seasons 3–5)
- [ ] Pre-2151 milestones (First Contact 2063, the Eugenics Wars)
- [ ] Decide how a non-contiguous range renders — a 900-year gap on a linear
      axis is mostly whitespace; likely needs era segmentation
- [ ] Re-tune the parser against the new pages before a full run

## Phase 11 — Complete the rewrite

- [ ] Author the remaining summaries (222 / 1,533 done, plus whatever
      Phase 10 adds)
- [ ] Switch the committed build to `--strict` so the repo holds no scraped
      prose at all
- [ ] Surface a "Read on Memory Alpha" link per event, so unauthored events
      still lead somewhere useful

## Phase 12 — Verification pass

- [ ] Sampled accuracy check by era against the source, with a recorded
      error rate — exhaustive review of 1,500+ records is not realistic
- [ ] Verify every authored summary states the same facts as its source
- [ ] Check date and stardate fields against episode references
- [ ] Publish the sampling method and result in the README

## Phase 13 — Licensing

Blocked on Phases 11 and 12 — licensing terms can only describe what the
repository actually contains.

- [ ] Confirm the dataset carries no Memory Alpha expression
- [ ] `LICENSE` for the code (MIT is the likely choice)
- [ ] `data/LICENSE` describing the dataset's provenance and terms
- [ ] Attribution for Memory Alpha (CC BY-NC-SA) and Wikipedia (CC BY-SA 4.0)
- [ ] Decide whether the dataset can be released permissively or must stay
      share-alike

## Phase 14 — Git history rewrite

Must be the last step before publishing, and cannot be undone.

- [ ] Squash the data history so no commit contains the verbatim scrape
      (commits from `c1b4aa9` onward currently do)
- [ ] Verify with `git log -p -- data/events.json` that nothing survives
- [ ] Force-push the rewritten history *before* the repo is made public

## Phase 15 — Documentation and publish

- [ ] README, CLAUDE.md and ROADMAP reconciled with the shipped state
- [ ] Document the pipeline end to end, including how to add summaries
- [ ] Contributor notes: how to run tests, how the build must stay idempotent
- [ ] Flip the repo to public

## Deferred decisions

- **Licensing** — owned by Phase 13. No LICENSE file until the dataset's
  contents are settled; terms have to describe what is actually in the repo.
- **Hosting.** The repo is private on GitHub. No deploy target chosen; the site
  is static, so GitHub Pages is the obvious candidate once it is public.
- **Era segmentation.** Phase 10 will likely force a decision about rendering
  non-contiguous eras on one axis.
