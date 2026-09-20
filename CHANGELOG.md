# Changelog

Notable changes to the TTX Builder — scenarios, the assembly engine, the three
render targets and the shell. Newest first. Dates are the date the change was
committed.

This file starts here, on 2026-09-20. Everything before this entry is in the
git history and in the Plane board, not above it.

---

## 2026-09-20 — PE-304: five scenarios declare their sources

**New.** PE-300 made `meta.sources` render at every difficulty, in all three
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

**No lint ran, because this repository has none.** PE-304 assumed one. At
`a8b0374` there is no `package.json`, no `scripts/` directory and no shell
script anywhere in the tree; the *Authoring checklist* in `README.md` is
manual. The five files were validated by hand instead: every `content/*.json`
re-parsed, `meta.sources` asserted to be a non-empty array of non-empty
strings, and the round-trip checked so that nothing but `meta.sources` differs
from the committed version. All nine scenarios pass and all nine now declare
sources. A real lint is still worth writing.

*Content only. No engine, renderer or shell change; nothing deployed.*
