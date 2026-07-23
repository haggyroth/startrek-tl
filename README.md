# startrek-tl

An interactive timeline of Star Trek canon events, covering 2063–3269 across
all series and films.

The page renders an **event-density sparkline** — the curve's height is how many
canon events occur in a given year, so the Dominion War reads as a spike and the
quiet stretches read as valleys. The X-axis carries both Gregorian year and
stardate. Individual events sit on the curve as hoverable points showing the
date, stardate, a short summary, and the episodes or films the event comes from.
Series filters re-bin the curve live rather than just hiding points, so the
waveform reshapes to whatever subset you're looking at.

## Status

Phases 1–11 complete. The chart renders 2,037 events across 2063–3269, and
**every event carries independently authored prose** — none of it is
paraphrased Memory Alpha text (see [Data source and licensing](#data-source-and-licensing)
and [AUTHORING.md](AUTHORING.md)). The site has hover tooltips, era presets,
timeline/series/location filters that re-bin the curve, zoom and pan,
shareable URLs, LCARS chrome, and keyboard navigation. The view opens on
2063–2410, where canon is dense.

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
| `data/` | `events.json` — the generated, committed dataset (CC BY-NC-SA, see `data/LICENSE.md`) |
| `scripts/` | Node data pipeline: fetch → parse → normalize → emit |
| `src/` | The site itself |
| `src/vendor/` | D3 and the Antonio webfont, vendored — no CDN, no build |
| `AUTHORING.md` | House style and workflow for writing summaries |
| `LICENSE` | MIT license, covering the code |

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
imported from a neighbouring event. Run against all **2,037 authored summaries
(100%)**, it currently reports zero unexplained flags. Early in the project it
caught real errors before they were corrected — a reputation attributed to the
Suliban that the source never mentioned, a cease fire placed at Weytahn where
the source says Paan Mokar, a symbiont's former host named "Senna" where the
source says only "Admiral Tal" — and every deliberate deviation since is
recorded with its reasoning in `data/verify-exceptions.json`.

**By reading, on a stratified sample.** A mechanical check cannot tell whether a
sentence *means* the same thing. `npm run sample:summaries` (`scripts/sample-summaries.js`)
draws a fixed-seed sample across all six eras, weighted toward the 24th
century since it holds most of the dataset (15 events per era, 30 for the
24th, 105 total — 5.2% of the authored set). Every one was read against its
source bullet.

Two samples exist in the project's history:

- An earlier sample of 55 events, taken when only 591 of 2,037 were authored
  (0 meaning errors, 45 of 55 pairs auto-matched).
- **A full refresh after authoring completed** (105 events, seed
  `20260723`, all 105 pairs auto-matched): **0 meaning errors**. Every
  authored line stated the same fact as its source, whether compressed to a
  short sentence or kept close to the original wording.

Exhaustively re-reading 2,037 records isn't realistic, so the honest claim is:
mechanical checks are exhaustive and currently clean, and the two independent
meaning-samples taken so far — one early, one after full completion — found
zero errors between them.

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
npm run build:data   # node scripts/build-events.js --strict
```

This reads from the local scrape cache (`data/events.raw.json`, gitignored) when
present and only hits the network when the cache is cold. The committed build
is `--strict`: with every event authored, this changes nothing today, but it
means a future re-scrape that discovers new events falls back to a plain
fact-derived stub rather than publishing scraped Memory Alpha prose while it
awaits authoring.

## Data source and licensing

This repository is **dual-licensed**, because the code and the data have
different obligations:

- **Code** (`scripts/`, `src/` excluding `src/vendor/`, tests, tooling) is
  **MIT** — see [`LICENSE`](LICENSE).
- **Data** (`data/events.json`, `data/summaries.json`,
  `data/timeline-overrides.json`, `data/verify-exceptions.json`) is
  **CC BY-NC-SA** — see [`data/LICENSE.md`](data/LICENSE.md).

Event facts are derived from [Memory Alpha](https://memory-alpha.fandom.com/)
via the MediaWiki API; timeline classification and landmark tiers are derived
from [Wikipedia's Timeline of Star Trek](https://en.wikipedia.org/wiki/Timeline_of_Star_Trek)
(CC BY-SA 4.0). Memory Alpha's license is the more restrictive of the two, so
the combined dataset is non-commercial, share-alike, and attribution-required.
Attribution is surfaced in the site footer and in `events.json`'s own
`meta.sources`.

Vendored third-party assets (`src/vendor/d3.min.js`, the Antonio webfont)
carry their own licenses — see `src/vendor/OFL.txt` for the font.

## A note on stardates

Stardates are only linearly convertible in the TNG era
(`stardate = 41000 + 1000 × (year − 2364)`, valid 2323 onward). TOS-era
stardates are inconsistent by design and have no calendar mapping, so they're
stored literally per-event rather than computed. The stardate axis renders as a
continuous scale only for 2323+.
