# Authoring summaries

How to write the remaining summaries. 779 of 2,037 are done; the rest follow
the same procedure.

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

## Ids change when summaries change

An event's id is derived from its scraped summary. If a parser fix changes that
text, the id changes and `summaries.json` will point at nothing —
`validate:data` fails with "references an unknown event". Remap rather than
re-author: match on year plus token overlap against the new ids.

## Priority

`validate:data` **fails** if any event at significance ≥ 4 still carries scraped
prose, so landmarks can never regress. Beyond that, whole eras are the useful
increment — a complete era means an era preset that is entirely clean.

| Era | Authored |
|---|---|
| 2063–2100 | 53 / 53 ✅ |
| ENT (2101–2161) | 213 / 213 ✅ |
| Gap (2162–2232) | 60 / 60 ✅ |
| 23rd century | 228 / 453 |
| 24th century | 92 / 1,125 |
| Far future | 133 / 133 ✅ |

Everything before the 23rd century is fully authored, and the 23rd is just
over halfway (225 events remaining, 2258 onward). The 24th century (1,033
remaining) is the last big chunk.
