# Authoring summaries

**The rewrite is complete: all 2,037 events carry independently authored
prose.** This doc now serves as reference for future additions — new events
from a re-scrape, or corrections — which follow the same procedure below.

## Why summaries are authored at all

Memory Alpha's **prose** is theirs (CC BY-NC-SA). The **facts** are not
ownable. So every summary is written independently from the fact record —
entities, event kind, date, stardate, episode citations — rather than
paraphrased from the source sentence. A close paraphrase is still a derivative
work; writing from the facts is not.

That is the whole point of the exercise. Read the source to learn what
happened, then look away and state it yourself.

## The loop

```sh
# 1. See what still needs writing, oldest first
node -e "
const d=require('./data/events.json');
for (const e of d.events.filter(e=>e.prose==='source').slice(0,40))
  console.log(e.id+'\n  '+e.summary.slice(0,150));
"

# 2. Add entries to data/summaries.json  ->  { "<event id>": "<your line>" }

# 3. Rebuild, validate, verify
npm run build:data
npm run validate:data
npm run verify:summaries
```

`data/summaries.json` is a flat map of event id to text, sorted by key. The
build merges it over the scrape and marks those events `prose: "authored"`.

## House style

- **One sentence.** Median authored length is 12 words. The longest scraped
  summary ran to 157 words in a tooltip, which is what this is fixing.
- **State the fact, not the wiki's framing.** "According to Benjamin Sisko,
  this was the approximate year that…" becomes "Roughly when Earth's society
  transformed, by Benjamin Sisko's account."
- **Keep names, dates, numbers exactly as the source has them.** The verifier
  checks this mechanically.
- **Don't add detail the bullet doesn't contain**, even if you know it is true.
  A real error found in review: a summary said Archer's reputation was "with
  the Suliban" when the source only said he gained a legendary reputation.
- **Don't quote.** Describe the quote instead — "Cochrane offers his
  much-quoted advice against trying to be a great man."
- Dates and stardates live in their own fields. Leave them out of the prose
  unless the sentence needs them.

## Short facts are fine as-is

Some events have exactly one natural phrasing: "Montgomery Scott born.",
"The Dominion War begins." Those will match the source word for word, and that
is correct — a short statement of fact carries no protectable expression.
Don't contort them. Roughly a dozen summaries are in this category.

The verifier will not complain. The reviewer should only worry when a **long**
line matches closely; the current maximum shared run is 7 words.

## What the tooling checks

`npm run verify:summaries` compares every authored summary against the source
bullet it came from and flags:

- **introduced tokens** — a proper noun or number in your text that is not in
  the source. Usually a typo or a detail imported from a neighbouring event.
- **date-year** — a `date` field that disagrees with the event's year.
- **stardate-range** — a stardate outside the year page's own declared range.

It needs the local scrape cache (`data/events.raw.json`, gitignored), so it
runs locally rather than in CI.

If a flag is a deliberate deviation, record it in
`data/verify-exceptions.json` with the reasoning — the same pattern as
`data/timeline-overrides.json`. There is one today: Memory Alpha misspells
"Aditya Sahil" as "Adiatya" in a 3188 bullet and spells it correctly in its own
3148 entry, so the authored summary uses the right spelling.

## What it cannot check

Whether the sentence *means* the same thing. That needs a person, and the
sampling procedure is in the README under "Verification".

## Watch for `timeline` while you read the source

Authoring means reading every bullet's full context, which is a good vantage
point to notice a wrong `timeline` tag — `detectTimeline()` is a phrase-matching
heuristic and gets fooled by a few patterns found over the course of the
rewrite, each one-off enough to fix as a manual correction rather than a
parser change:

- **A back-reference bullet.** "In the same timeline, Commander Thelin becomes
  first officer..." only makes sense next to the alternate-timeline bullet
  immediately before it; `detectTimeline()` has no notion of "same as the
  previous one" and defaults such bullets to `prime`.
- **A mirror/alternate universe mentioned only in an aside.** "Dr. McCoy spills
  acid in sickbay, *an event which also apparently happens in the mirror
  universe...*" is a prime event — the phrase-match saw "mirror universe" and
  tagged the whole bullet `mirror`. Check which ship/station heading the raw
  wikitext actually groups the bullet under; that's a stronger signal than the
  prose.
- **"Alternate reality" outside its Kelvin context.** MA's own idiom for the
  Kelvin timeline can appear in an unrelated quantum-multiverse story (TNG
  "Parallels") with no Kelvin citation at all. Before trusting the phrase
  match, check whether the bullet sits under a real `=== Alternate
  timelines ===`/`Kelvin` section heading (which the parser already trusts
  over phrase matching) or is just an inline aside with no heading of its own.
- **A `**` sub-bullet with no phrase of its own.** An "In an alternate
  timeline..." intro line is itself a `*` bullet; the parser's section-heading
  override only fires on real `==`/`===` headings, not on this kind of
  bullet-level framing. A nested `**` child bullet under it inherits the
  alternate-timeline context by prose alone, but if the child's own sentence
  has no alternate/mirror/kelvin phrase, `detectTimeline()` defaults it to
  `prime`. Check whether the bullet is indented under an intro line like this
  before trusting its classification.

`data/timeline-overrides.json` isn't limited to Wikipedia-overlay conflicts —
it's a general hand-reviewed corrections file. Before adding an entry, grep the
raw cache for the suspicious phrase (`grep -c` across `data/events.raw.json`)
to confirm it's rare enough to be a one-off; if it recurs, that's a parser fix
instead. Every entry needs a note explaining the reasoning — `validate:data`
enforces this.

## Watch for pronoun-only subjects

Some source bullets name their subject only by pronoun — "He later operates a
field transporter...", "Eight months before her destruction... this ship is
assigned to..." — continuing from the sub-bullet directly above under the same
ship or station heading. The name belongs in the authored summary (a summary
that says "He" is useless out of context), but `verify:summaries` will flag it
as an introduced token, since the checker only sees one bullet at a time.
Confirm the antecedent by reading the raw wikitext around it in
`data/events.raw.json` before naming the subject, then record the token(s) as
a reviewed exception in `data/verify-exceptions.json` with a note pointing at
the preceding bullet.

## Stardate-range flags aren't always a mistake

`verify:summaries` also flags a stardate that falls just outside its year
page's own declared sidebar range. Sometimes that range is wrong, not the
authored text — Memory Alpha's sidebar is occasionally a rounded or
inconsistent summary of the very citations it's supposed to bound (2362's own
"Background information" section documents exactly this kind of conflict for
its year). Before authoring around it, check whether the mismatch is a
fraction-sized rounding gap at the boundary; if so, record it in
`data/verify-exceptions.json` with `"stardateRange": true` and a note, the same
review-and-record pattern as introduced tokens.

## Ids change when summaries change

An event's id is derived from its scraped summary. If a parser fix changes that
text, the id changes and `summaries.json` will point at nothing —
`validate:data` fails with "references an unknown event". Remap rather than
re-author: match on year plus token overlap against the new ids.

## Priority

`validate:data` **fails** if any event at significance ≥ 4 still carries scraped
prose, so landmarks can never regress. Every era below is now complete.

| Era | Authored |
|---|---|
| 2063–2100 | 53 / 53 ✅ |
| ENT (2101–2161) | 213 / 213 ✅ |
| Gap (2162–2232) | 60 / 60 ✅ |
| 23rd century | 453 / 453 ✅ |
| 24th century | 1,125 / 1,125 ✅ |
| Far future | 133 / 133 ✅ |
| **Total** | **2,037 / 2,037 ✅** |

Next up per `ROADMAP.md`: switching the committed build to `--strict`,
which belongs immediately before publication rather than now.
