# Changelog

Notable changes to the TTX Builder — scenarios, the assembly engine, the three
render targets and the shell. Newest first. Dates are the date the change was
committed.

This file starts here, on 2026-09-20. Everything before this entry is in the
git history, not above it.

---

## 2026-09-20 — The CISA edition date, corrected rather than guessed

**Fixed — four citation strings in `content/the-helpful-assistant.json`.** They
cited CISA's guide as *(September 2026 edition)*. CISA's own resource page
labels it the **2026 Edition** and publishes no month for it. The "Jan 28,
2026" that is visible on that page belongs to a different, adjacent resource —
*Assembling A Multi-Disciplinary Insider Threat Management Team* — which is
where an earlier note's "2026-01-28" for this guide came from. Neither month
survives checking, so the month is **dropped rather than swapped**: the strings
now read *(2026 edition)*, which is the form `privileged` and `the-walk-in`
were already using. The three scenarios that cite this guide now agree with
each other and with the publisher.

**The edition stays 2026, and that is a finding rather than a default.** Both
cited sections — *AI and Insider Threat Mitigation Considerations*, p. 37, and
*Avoid Zero-Tolerance Policies*, p. 35 — are AI-era material, and CISA lists
"Artificial Intelligence (AI)" under *New Features in the 2026 Edition*,
describing that edition as strengthening the 2020 original. Downgrading the
citation to the 2020 edition would have pointed the room at pages that edition
does not have.

**Deliberately untouched:** the Greitzer/Cogility *Agentic AI: An Emerging
Threat Vector*, **DSI Bootcamp, 17 September 2026** line in `leverage`,
`three-routine-steps`, `ghost-in-the-pipeline` and `the-helpful-assistant`.
That is a different work with a real September date, and it shares nothing with
the CISA string but the month. A blind repo-wide sweep for "September 2026"
would have corrupted four scenarios.

**Companion change, not in this repo.** ES module files are now served
with a JavaScript content type. Lint after the content change:
**9 passed, 0 failed.**

---

## 2026-09-20 — The lint exists, and two provenance rules are written down

**New — `tools/lint-scenarios.mjs`.** The previous entry closes with "a real
lint is still worth writing". This is it: Node standard library only, no
`package.json` and no install step, run as `node tools/lint-scenarios.mjs` from
the repo root. Every `content/*.json` must parse and must declare provenance
exactly one of two ways. It prints a roster line per scenario — `id · N
sources`, or `none — <the note>` — so a clean run doubles as the inventory, and
exits non-zero if any file fails. An optional directory argument lints fixtures
somewhere else, which is how the rule is tested against deliberately broken
files without putting one in `content/`. Run on the nine: **9 passed, 0
failed.**

**Rule — sources carry their URLs.** Ratified after the source rosters below:
the five rosters added there cite a URL per entry and the four AI-track rosters
did not.
URLs are the standard, documented in `README.md`. Four of the works cited by
the AI-track four were opened and confirmed, and their URLs appended in the
established form:

| Work | Cited by |
|---|---|
| Anthropic, *Agentic misalignment: How LLMs could be insider threats* | `ghost-in-the-pipeline`, `leverage` |
| Anthropic, *Sabotage evaluations for frontier models* | `ghost-in-the-pipeline`, `leverage` |
| Anthropic, *Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training* | `ghost-in-the-pipeline` |
| CISA, *Insider Threat Mitigation Guide* | `the-helpful-assistant` |

**Three entries keep no URL, on purpose.** The Greitzer/Cogility DSI bootcamp
talk and the Exabeam gap-analysis slide are conference materials whose agendas
are behind an email request — no public page for either could be opened, so
neither entry was touched. `ghost-in-the-pipeline` also cites "the
evaluation-sandbox escape disclosed in July 2026", which names no publisher and
no title and so has no primary page to link. Nothing was guessed. `three-routine-steps`
cites only those two conference works and is therefore unchanged by this entry,
though it still passes the lint.

**Rule — sources XOR `sources_note`.** An empty roster stops being a valid
state. A scenario with no documentable precedent declares `meta.sources_note`,
one sentence saying why, and it renders in the slot the roster would have
filled, under the same heading. The lint enforces the XOR; declaring both, or
neither, fails. **No current scenario is in this state** — the field is
plumbing laid ahead of the first scenario that needs it.

**Renderer — three targets, two code paths.** `render.js`'s `sourcesBlock()`
serves two of them (the gamebook front matter and the after-action pack) and
now prints `sources_note` where the list would go; the standing "paraphrased
unless quoted" line is suppressed there, because it describes how to read a
roster and there is no roster. `pptx.js` has its **own** path and cannot call a
function that builds DOM, so the rule is implemented twice and the two must be
kept in step: the deck gets the same "What this is built on" slide with the
sentence set as prose rather than a lone bullet. `engine.js` carries the new
field through with token substitution, like any other authored prose. **Rosters
render exactly as before** — same heading, same standing note, same list.

*Adds `tools/`. Renderer and engine changed; `content/` changed in three files,
`meta.sources` only.*

---

## 2026-09-20 — Five scenarios declare their sources

**New.** An earlier change made `meta.sources` render at every difficulty, in all three
packs — the facilitator gamebook's front matter, the end of the after-action
pack, and a "What this is built on" slide in the deck. Five scenarios were
still declaring none, so those blocks rendered nothing at all. They now carry
sources, in the same plain-string, role-prefixed form the AI as Insider track
already uses:

| Scenario | Sources | What they are |
|---|---|---|
| `dprk-hire` — *The New Hire* | 4 | Three DOJ enforcement actions on the DPRK remote-IT-worker scheme (2025-06-30, 2026-04-15) and the interagency hiring guidance, plus one legal analysis of the sanctions and employment-law exposure. |
| `privileged` — *Keys to the Kingdom* | 4 | Two DOJ convictions covering privileged sabotage and post-termination destruction of records, the CISA *Insider Threat Mitigation Guide*, and the CERT/SEI *Common Sense Guide*, 7th edition. |
| `the-approach` — *The Approach* | 3 | The DOJ/FBI action against 13 websites soliciting clearance holders, the Rowe attempted-espionage sentencing, and the FBI's *Game of Pawns* on the Shriver case. |
| `the-long-goodbye` — *The Long Goodbye* | 3 | Three DOJ trade-secret cases covering exfiltration during a notice period, a departure that began years before the resignation, and a download made two weeks before one. |
| `the-walk-in` — *The Walk-In* | 3 | The same DOJ/FBI 13-websites action read for its reporting guidance, the CISA guide on intervention that balances protection and care, and the Kriuchkov indictment — the walk-in that stopped a scheme. |

Every source is a primary government publication, an authoritative agency
guide, or — in one case, labelled as such — legal analysis. Each entry names
its publisher, title, date and URL, so a facilitator can check the provenance
of the exercise they are about to run.

**One caution is carried in the text**, on `the-long-goodbye`'s third entry
only: the economic-espionage counts in that verdict are reported to have been
vacated in August 2026 while the trade-secret-theft convictions stand. The
scenario should not teach a room to reach for "espionage" because the word is
available. No URL is cited for the vacatur, because none was verified.

**No lint ran, because this repository has none.** This change assumed one. At
`a8b0374` there is no `package.json`, no `scripts/` directory and no shell
script anywhere in the tree; the *Authoring checklist* in `README.md` is
manual. The five files were validated by hand instead: every `content/*.json`
re-parsed, `meta.sources` asserted to be a non-empty array of non-empty
strings, and the round-trip checked so that nothing but `meta.sources` differs
from the committed version. All nine scenarios pass and all nine now declare
sources. A real lint is still worth writing.

*Content only. No engine, renderer or shell change; nothing deployed.*
