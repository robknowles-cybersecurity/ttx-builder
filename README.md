# TTX Builder

A static generator for insider threat tabletop exercises, presented as a
numbered gamebook. Set six dials, get a facilitator gamebook, one character
sheet per seat, inject handouts, an after-action pack, and a companion `.pptx`.

Served at `ttx.insiderthreatanalyst.com` from `/var/www/ttx`.

> **Design constraint, deliberate:** hand-rolled HTML/CSS/vanilla JS. No
> framework, no build step, no transpiler. The whole site is meant to be
> auditable by reading it. One vendored third-party library (`pptxgenjs`) —
> see `THIRDPARTY.md`.

---

## Layout

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

Nothing runs server-side. nginx serves static files; every selection is
resolved in the browser and nothing is transmitted anywhere.

---

## The query-string contract

`exercise.html` is driven entirely by its query string, which means a
configured exercise is bookmarkable and mailable.

| key | meaning | values |
|---|---|---|
| `s` | scenario id | must match `content/<id>.json`, `[a-z0-9-]{1,64}` |
| `i` | industry key | a key in the scenario's `industries` object |
| `m` | maturity | `formal` \| `adhoc` |
| `d` | duration | `60` \| `90` \| `120` |
| `x` | difficulty | `first_timer` \| `standard` \| `veteran` |
| `l` | classic linear | `1` \| `0` |
| `r` | roles at the table | comma-separated role ids |

---

## Content schema

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
      "inject":   { "kind", "from", "subject", "body" },
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

### Tokens

Body, inject and question text may contain `{{token}}` placeholders, resolved
from the selected industry:

| token | source |
|---|---|
| `{{org_name}}` | `industries.<key>.org_name` |
| `{{crown_jewels}}` | `industries.<key>.crown_jewels` |
| `{{regulator}}` | `industries.<key>.regulator` |
| `{{flavor_notes}}` | `industries.<key>.flavor_notes` |
| `{{org_domain}}` | **derived** — org name slugified + `.example` |

An unknown token is left visible on purpose (`{{typo}}` renders literally), so
a mistake shows up in review instead of vanishing.

### Industry keys are site-level

The console offers a fixed set of four industry keys — `finserv`, `healthcare`,
`dib`, `tech`. **Every scenario should define all four**, or the engine falls
back to generic wording and records an assembly warning.

### `inject.kind`

`email` · `dlp` · `hr` · `news` · `memo` — each gets its own print treatment.
An unrecognised kind still renders, with the default memo styling.

---

## Assembly rules

Implemented in `assets/engine.js` and **only** there.

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
4. **Classic linear.** Every decision collapses to its first option, so the
   book reads straight through.
5. **Renumbering.** Display numbers are assigned **after** filtering. Decision
   `goto` targets resolve through that map, so "turn to section N" is always
   correct. If a target was filtered out of this run, the pointer walks forward
   through the original order to the next surviving section and records an
   assembly warning — visible on screen, hidden from print.

That last rule is the one to keep an eye on when authoring: a 60-minute run of
the placeholder scenario deliberately filters out a decision target, so it
exercises the fallback path.

---

## Adding a scenario

1. Write `content/<id>.json` against the schema above.
2. Add a radio card to the Scenario dial in `index.html` with `value="<id>"`
   (drop the `disabled` attribute and the "Coming soon" badge).
3. Load `exercise.html?s=<id>&…` and walk all three durations and all three
   difficulties, watching the on-screen **Assembly notes** panel for warnings.
4. Export the deck and open it.

---

## Serving notes

- vhost: `/etc/nginx/sites-available/ttx`, root `/var/www/ttx`, static only.
- TLS reuses the Cloudflare Origin CA cert at
  `/etc/ssl/cloudflare/ita-cert.pem`, whose SAN set covers
  `*.insiderthreatanalyst.com`.
- **`.md` files 404 at the vhost**, including this one and `THIRDPARTY.md`.
  They belong in the repo, not in a browser. The same block covers `.git`,
  dotfiles, and `.bak` variants.
- Ownership convention matches the sibling webroots: `rob:www-data`,
  directories `755`, files `644`.
- After changing anything served here, purge the Cloudflare cache.

## Known gaps

See `/root/STATUS-pe183-ttx-builder-2026-08-09.md` for the current residual
list.
