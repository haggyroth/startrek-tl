# Data license

The contents of this directory — `events.json`, `summaries.json`,
`timeline-overrides.json`, and `verify-exceptions.json` — are derived from two
sources and carry their licenses, not the MIT license that covers the rest of
this repository (see the root `LICENSE`).

## Sources

| Source | License | Used for |
|---|---|---|
| [Memory Alpha](https://memory-alpha.fandom.com/) | CC BY-NC-SA | Event facts, dates, stardates, episode citations |
| [Wikipedia — Timeline of Star Trek](https://en.wikipedia.org/wiki/Timeline_of_Star_Trek) | CC BY-SA 4.0 | Timeline classification and landmark tiers |

Because Memory Alpha's license is the more restrictive of the two, the
combined dataset in this directory is licensed **CC BY-NC-SA**: non-commercial
use only, share-alike, attribution required. This is also why the repository
as a whole has never carried a single blanket license — the data and the code
have different terms.

## What "derived" means here

Per `AUTHORING.md`, every event summary in `summaries.json` is **written
independently from the extracted facts** (entities, dates, stardates,
citations) rather than paraphrased from Memory Alpha's own sentences — the
facts are not ownable, but Memory Alpha's specific prose is. That distinction
doesn't change the license on this directory: the underlying facts, their
selection, and their organization into this dataset still derive from Memory
Alpha and Wikipedia, so the CC BY-NC-SA / CC BY-SA terms still apply to the
dataset as a compilation.

## Attribution

Required attribution is already surfaced in two places:

- The site footer (`src/index.html`), visible on every load.
- `events.json`'s own `meta.sources` array, so attribution travels with the
  data file itself if it's used outside this repository.

Any reuse of this directory's contents must preserve that attribution, remain
non-commercial, and be shared under the same license.
