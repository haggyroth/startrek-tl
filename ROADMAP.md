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

## Phase 11 — Complete the rewrite (in progress)

- [x] "Read on Memory Alpha" surfaced in the tooltip and as a link on the
      table's year cell; stub rows are styled distinctly
- [x] Strict-mode fallback rewritten. Kind-based templates were tried and
      abandoned — entity order does not identify the subject, so they produced
      fabrications ("Birth of Tycho City", "San Francisco graduates"). The
      fallback now says plainly that it is a stub
- [x] Entity extraction filters ranks and lowercase common nouns
- [x] Far future (2411–3269) authored in full — 133 events, the first era at
      100%
- [ ] Author the remaining summaries — **389 / 2,040 (19%)**
- [ ] Switch the committed build to `--strict`

On the strict flip: the capability works and is tested, but flipping it now
would replace real prose with stubs for 81% of events while the repo is still
private and nothing is published. It belongs immediately before publication,
in Phase 14/15, not before the authoring is much further along.

Coverage by era:

| Era | Authored |
|---|---|
| 2063–2100 | 6 / 53 |
| ENT (2101–2161) | 11 / 216 |
| Gap (2162–2232) | 9 / 60 |
| 23rd century | 138 / 453 |
| 24th century | 92 / 1,125 |
| Far future | 133 / 133 |

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
