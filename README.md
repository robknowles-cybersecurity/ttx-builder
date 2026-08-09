# TTX Builder

**A generator for insider threat tabletop exercises, presented as a numbered
gamebook.**

Set six dials and it assembles a complete exercise: a facilitator gamebook of
numbered sections, a private character sheet for every seat at the table,
inject handouts ready to deal out, an after-action pack, and a companion slide
deck. Everything prints.

Live at **[ttx.insiderthreatanalyst.com](https://ttx.insiderthreatanalyst.com/)**.
Part of [insiderthreatanalyst.com](https://insiderthreatanalyst.com/).

The gamebook format is not nostalgia for its own sake. It does one useful
thing: it forces a room to commit to a decision *before* it learns what the
decision cost. A slide deck lets everyone agree in hindsight. A numbered
section that says "turn to 14" does not.

> Nothing runs server-side and nothing phones home. There is no account, no
> database, no telemetry, and no form post. Your six selections are encoded in
> the URL and resolved by JavaScript in your own browser.

---

## Running an exercise

**You need:** a room, a printer, 60–120 minutes, and somebody to facilitate.
The facilitator should read the gamebook through once beforehand. Nobody else
should.

### 1. Set the dials

Open the console and choose:

| Dial | What it changes |
|---|---|
| **Scenario** | Which story you run. |
| **Industry** | The organisation, its crown jewels, and its regulator — the details that make a room believe it. |
| **Program maturity** | How the facilitator frames authority questions. |
| **Duration** | 60, 90 or 120 minutes. Shorter runs drop optional beats, never structure. |
| **Roles at the table** | Tick only the seats you will actually fill. |
| **Difficulty** | First-timer prints coaching notes and plainer framing; Veteran adds red herrings. |

Two things worth knowing:

- **Empty seats still get a voice.** Questions belonging to a role you did not
  tick fold into the facilitator's copy, labelled with whose seat they came
  from, so the perspective is still put to the room.
- **Classic linear mode** collapses every decision to its first option. That
  chain runs the containment storyline — contain now, then report and pursue —
  which is the traditional linear tabletop arc. The room still turns to the
  section named at each decision; it is simply not offered the alternative.
  Useful when you are briefing rather than running.

### 2. Print four things

Generate, then print each view:

| Print | For whom | Notes |
|---|---|---|
| **Gamebook** | Facilitator only | The numbered sections, with questions, coaching and decision points. |
| **Role sheets** | One per participant | One seat per page. Each carries private knowledge the others do not have. |
| **Inject handouts** | Facilitator, to deal out | One per page. Each says which section to deal it at. |
| **After-action pack** | Everyone, at the end | Hotwash questions with writing space, and objectives to mark off. |

The stylesheets are built so the output survives a printer with background
graphics switched off — structure is carried by borders and type, not fills.

### 3. Run it

Read the numbered sections aloud in order. Deal each inject at the section
printed on it. Put the questions to the room.

**At a decision point, stop.** Let the room argue, make them commit to one
option, then turn to the section that option names. Do not read on — the
section printed next belongs to the other branch, and reading it spoils a path
the room did not take. The gamebook prints a stop line at every decision and
every ending; it is there because a facilitator reading down a page is exactly
how a branch gets spoiled.

When you reach an ending, stop the clock and go to the after-action pack.

### 4. Optional: the slide deck

**Export deck** builds a `.pptx` in your browser. Use it for the framing slides
and the decision points when the room expects a deck. It is a companion to the
gamebook, not a replacement — the deck cannot make anyone commit.

---

## Bookmarking a configuration

`exercise.html` is driven entirely by its query string, so a configured
exercise is bookmarkable and mailable.

| key | meaning | values |
|---|---|---|
| `s` | scenario id | must match `content/<id>.json`, `[a-z0-9-]{1,64}` |
| `i` | industry key | a key in that scenario's `industries` object |
| `m` | maturity | `formal` \| `adhoc` |
| `d` | duration | `60` \| `90` \| `120` |
| `x` | difficulty | `first_timer` \| `standard` \| `veteran` |
| `l` | classic linear | `1` \| `0` |
| `r` | roles at the table | comma-separated role ids |

---

## For developers

> **Design constraint, deliberate:** hand-rolled HTML/CSS/vanilla JS. No
> framework, no build step, no transpiler. The whole site is meant to be
> auditable by reading it. One vendored third-party library (`pptxgenjs`) —
> see `THIRDPARTY.md`.

### Layout

```
index.html            the console — six dials, the linear toggle, Generate
exercise.html         the four output views
assets/
  ttx.css             design language (screen)
  print.css           print stylesheet (media="print")
  ttx.js              console → query string
  engine.js           assembly: filtering, variants, renumbering   ← the rules
  render.js           assembled exercise → DOM
  pptx.js             assembled exercise → .pptx
content/
  <scenario-id>.json  one file per scenario
vendor/
  pptxgen.bundle.js   vendored, hash recorded in THIRDPARTY.md
```

### Content schema

One JSON file per scenario in `content/`. Keys beginning `_` are ignored by the
renderer and are free for authoring notes.

```jsonc
{
  "meta":       { "id", "title", "tagline", "version" },
  "industries": { "<key>": { "org_name", "crown_jewels", "regulator", "flavor_notes" } },
  "roles":      [ { "id", "title", "briefing", "authorities": [], "private_knowledge": [] } ],
  "sections":   [ {
      "id",
      "type": "narrative|inject|discussion|decision|epilogue",
      "body",
      "inject":   { "kind", "from", "subject", "body",
                    "difficulty_variants": { "<level>": { "body" } } },
      "questions": { "<role_id|all>": [ "…" ] },
      "decision":  { "prompt", "options": [ { "label", "goto" } ] },
      "durations": ["60","90","120"],
      "difficulty_variants": { "first_timer": { "body" }, "veteran": { "body" } },
      "coaching": [ "…" ],
      "red_herring": true
  } ],
  "aar": { "hotwash": [], "objectives": [] }
}
```

Note the two levels of `difficulty_variants`. A section-level variant reframes
the narrative around an artefact; an **inject-level** variant rewrites the
artefact itself. Where an inject-level variant exists for the selected
difficulty, its `body` overrides `inject.body`.

### Tokens

Any authored prose may contain `{{token}}` placeholders, resolved from the
selected industry. Substitution is applied to every body-bearing field —
section bodies, both levels of difficulty variant, inject `from` / `subject` /
`body`, decision prompts and option labels, role titles, briefings, authorities
and private knowledge, all questions, coaching lines, and the after-action
pack.

| token | source |
|---|---|
| `{{org_name}}` | `industries.<key>.org_name` |
| `{{crown_jewels}}` | `industries.<key>.crown_jewels` |
| `{{regulator}}` | `industries.<key>.regulator` |
| `{{flavor_notes}}` | `industries.<key>.flavor_notes` |
| `{{org_domain}}` | **derived** — org name slugified + `.example` |

An unknown token is left visible on purpose (`{{typo}}` renders literally), so
a mistake shows up in review instead of vanishing silently.

### Industry keys are per-scenario

Every scenario defines its own `industries` map, and the console's Industry
dial must offer exactly those keys. If a selected key is not in the map the
engine falls back to generic wording and records an assembly warning — visible
on screen, hidden from print. **When you add a scenario, check that the dial's
`value` attributes and the scenario's industry keys agree**; a mismatch is
silent on the console and only shows up as flat, generic prose.

### `inject.kind`

`email` · `dlp` · `hr` · `news` · `memo` — each gets its own print treatment.
An unrecognised kind still renders, with the default memo styling.

### Assembly rules

Implemented in `assets/engine.js` and **only** there, so "turn to section N"
has exactly one source of truth.

1. **Duration.** A section survives if its `durations` array contains the
   selected duration. A missing or empty array means always-on.
2. **Difficulty.**
   - `first_timer` — swaps in `difficulty_variants.first_timer.body` where
     present, prints `coaching` lines, **omits** red herrings.
   - `standard` — base `body`, no coaching, **omits** red herrings.
   - `veteran` — swaps in `difficulty_variants.veteran.body` where present, no
     coaching, **includes** red herrings.
3. **Roles.** Role sheets are pruned to the selected seats. Questions keyed to
   an unselected role fold into the facilitator's copy, labelled with whose
   seat they came from. Questions keyed `all` always go to the whole room.
4. **Classic linear.** Every decision collapses to its first option. The book
   still jumps — it simply always jumps the same way.
5. **Renumbering.** Display numbers are assigned **after** filtering. Decision
   `goto` targets resolve through that map. If a target was filtered out of
   this run, the pointer walks forward through the original order to the next
   surviving section and records an assembly warning.
6. **Flow terminators.** Decisions and epilogues stop the read. The renderer
   prints an explicit stop line for both, and it prints on paper — it is not
   screen chrome. Everything else falls through safely, because every branch is
   a contiguous run of sections terminated by a decision.

### Authoring checklist

1. Write `content/<id>.json` against the schema above.
2. Add a radio card to the Scenario dial in `index.html` with `value="<id>"`
   (drop the `disabled` attribute and the "Coming soon" badge).
3. Confirm the scenario's `industries` keys match the Industry dial's values.
4. Load `exercise.html?s=<id>&…` and walk all three durations and all three
   difficulties, watching the on-screen **Assembly notes** panel for warnings.
5. Check that every branch ends in a decision and every ending is reachable
   only by `goto`.
6. Export the deck and open it.

### Serving notes

- vhost: `/etc/nginx/sites-available/ttx`, root `/var/www/ttx`, static only.
- TLS reuses the Cloudflare Origin CA cert at
  `/etc/ssl/cloudflare/ita-cert.pem`, whose SAN set covers
  `*.insiderthreatanalyst.com`.
- **The webroot is the repository.** `.md` files 404 at the vhost — including
  this one — as do `.git`, dotfiles and `.bak` variants. `/content/` is an
  allow-list: it serves `.json` and returns 404 for everything else.
- Ownership convention matches the sibling webroots: `rob:www-data`,
  directories `755`, files `644`.
- After changing anything served here, purge the Cloudflare cache.

---

## Licence

Dual-licensed. Code (`index.html`, `exercise.html`, `assets/`) is **MIT** —
see [`LICENSE.md`](LICENSE.md). Exercise content (`content/`) and the prose in
this repository are **CC BY 4.0** — see
[`LICENSE-CONTENT.md`](LICENSE-CONTENT.md). The vendored library carries its
own licence — see [`THIRDPARTY.md`](THIRDPARTY.md).

Security policy and reporting: [`SECURITY.md`](SECURITY.md).

All organisations, people and events in the scenarios are fictional.

---

## Credits

Built and maintained by Rob Knowles.

Sparked by a suggestion from Mark Handy.
