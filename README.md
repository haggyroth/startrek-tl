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

Phases 1–4 complete. The chart renders 1,486 prime-timeline events across
2233–2402 with hover tooltips, timeline/series/location filters that re-bin the
curve, zoom and pan, shareable URLs, LCARS chrome, and keyboard navigation.

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

## Running it

Any static server works:

```sh
npm run serve
```

Then open <http://localhost:8000/src/>. The server must run from the repository
root, not from `src/` — the page fetches `../data/events.json`.

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
