# startrek-tl

An interactive timeline of Star Trek canon events, covering the 23rd and 24th
centuries (2233–2402) across all series and films.

The page renders an **event-density sparkline** — the curve's height is how many
canon events occur in a given year, so the Dominion War reads as a spike and the
quiet stretches read as valleys. The X-axis carries both Gregorian year and
stardate. Individual events sit on the curve as hoverable points showing the
date, stardate, a short summary, and the episodes or films the event comes from.
Series filters re-bin the curve live rather than just hiding points, so the
waveform reshapes to whatever subset you're looking at.

## Status

Phases 1–10 complete. The chart renders 2,049 events across 2063–3269 with
hover tooltips, era presets, timeline/series/location filters that re-bin the
curve, zoom and pan, shareable URLs, LCARS chrome, and keyboard navigation.
The view opens on 2063–2410, where canon is dense.

Views are linkable — for example
`#timeline=all&series=DS9&years=2370-2380`.

See [ROADMAP.md](ROADMAP.md) for the build plan.

## Stack

Static HTML/CSS/JS with [D3](https://d3js.org/) for the chart. No build step and
no framework — `src/index.html` is served as-is. Node is used only for the
offline data pipeline in `scripts/`.

## Layout

| Path | What's in it |
|------|--------------|
| `data/` | `events.json` — the generated, committed dataset |
| `scripts/` | Node data pipeline: fetch → parse → normalize → emit |
| `src/` | The site itself |
| `src/vendor/` | D3 and the Antonio webfont, vendored — no CDN, no build |
| `AUTHORING.md` | House style and workflow for writing summaries |

## Running it

Any static server works:

```sh
npm run serve
```

Then open <http://localhost:8000/src/>. The server must run from the repository
root, not from `src/` — the page fetches `../data/events.json`.

## Verification

Accuracy is checked two ways, because the two failure modes are different.

**Mechanically, over every authored summary** (`npm run verify:summaries`):
each proper noun and number in the authored text must also appear in the source
bullet, dates must agree with the event's year, and stardates must fall inside
the year page's declared range. This catches typos, wrong numbers, and details
imported from a neighbouring event. It found **3 substantive errors in 591
authored summaries (0.5%)**, all since corrected:

- a reputation attributed to the Suliban that the source never mentioned
- a cease fire placed at Weytahn where the source says Paan Mokar
- a symbiont's former host named "Senna" where the source says only
  "Admiral Tal"

One deviation is deliberate and recorded in `data/verify-exceptions.json`.

**By reading, on a stratified sample.** A mechanical check cannot tell whether a
sentence *means* the same thing. A fixed-seed sample of ten authored events per
era (55 in total, 9% of authored) was read against its source. Method:

```sh
python3 -c "import random; random.seed(47)"   # sample is reproducible
```

Result: **0 meaning errors** in the 45 pairs whose source bullet could be
matched automatically. The 10 far-future events in the sample come from century
pages, which the matcher does not index; they are covered by the mechanical
check.

Exhaustively re-reading 2,000 records is not realistic, so the honest claim is:
mechanical checks are exhaustive, meaning is sampled, and the error rate found
so far is under 1%.

## Tests

```sh
npm test              # unit, fixture and corpus tests
npm run validate:data # schema and consistency checks on the committed dataset
```

No dependencies — the suite runs on `node:test`. The corpus tests need the
local scrape cache and skip without it, so CI runs a subset.

## Git hooks

`main` cannot be protected server-side: GitHub gates branch protection and
rulesets behind a paid plan for private repositories. A committed pre-push hook
enforces the same rules locally instead. Enable it once per clone:

```sh
git config core.hooksPath .githooks
```

It refuses to force-push or delete `main`, and runs the tests first. It is a
local gate, not real protection — `--no-verify` bypasses it. Server-side rules
go in when the repo becomes public.

## Regenerating the dataset

```sh
node scripts/build-events.js
```

This reads from the local scrape cache (`data/events.raw.json`, gitignored) when
present and only hits the network when the cache is cold.

## Data source and licensing

Event data is derived from [Memory Alpha](https://memory-alpha.fandom.com/),
retrieved through the MediaWiki API. Memory Alpha content is licensed
**CC BY-NC-SA**, which means this dataset carries a non-commercial, share-alike,
attribution-required obligation.

**This repository intentionally has no LICENSE file.** Because the data is
NC-encumbered, the project cannot simply be released under a permissive license
the way a from-scratch project could. That decision is deferred rather than
forgotten — it needs to be made deliberately before the repo is ever made public.

## A note on stardates

Stardates are only linearly convertible in the TNG era
(`stardate = 41000 + 1000 × (year − 2364)`, valid 2323 onward). TOS-era
stardates are inconsistent by design and have no calendar mapping, so they're
stored literally per-event rather than computed. The stardate axis renders as a
continuous scale only for 2323+.
