# Third-party code

TTX Builder is hand-written HTML, CSS and vanilla JavaScript with **one**
third-party dependency. There is no build step, no package manager at runtime,
and no CDN: the library below is vendored into this repository and served from
this origin.

---

## pptxgenjs

| | |
|---|---|
| **Version** | `4.0.1` |
| **Licence** | MIT |
| **Upstream** | https://github.com/gitbrent/PptxGenJS |
| **Obtained from** | npm registry tarball — `https://registry.npmjs.org/pptxgenjs/-/pptxgenjs-4.0.1.tgz` |
| **Retrieved** | 2026-08-09 |
| **Vendored file** | `vendor/pptxgen.bundle.js` (extracted from `package/dist/pptxgen.bundle.js`) |
| **Licence text** | `vendor/pptxgenjs-LICENSE.txt` (copied verbatim from `package/LICENSE`) |

### Integrity

Source tarball `pptxgenjs-4.0.1.tgz`:

```
sha256  305e8870cc03c4402efb99d4a62cb73f611af64998b8988915d6c65b7fe7a5f0
sha1    cd0f202f62f74d950bcd217e90b766da8f73742e
sha512  TeJISr8wouAuXw4C1F/mC33xbZs/FuEG6nH9FG1Zj+nuPcGMP5YRHl6X+j3HSUnS1f3at6k75ZZXPMZlA5Lj9A==   (base64, npm `dist.integrity` form)
```

The `sha1` and `sha512` values above were **computed locally after download and
compared against the values the npm registry publishes for this version — both
matched exactly.** The `sha256` is recorded here as the durable fingerprint for
future re-verification.

Vendored file as served:

```
sha256  4fb9eac5cfefb213e2d8743c2b7151025f31bfb3f834c73c12062916daa0f3f8
        vendor/pptxgen.bundle.js   (460,889 bytes)
```

To re-verify at any time:

```sh
openssl dgst -sha256 /var/www/ttx/vendor/pptxgen.bundle.js
```

### Why the `bundle` build

`dist/pptxgen.bundle.js` is the only dist artefact that runs from a plain
`<script>` tag with no module loader. It inlines its single runtime dependency
(see below), assigns `window.JSZip`, then exposes `window.PptxGenJS`. The
`.cjs`, `.es` and `.min` builds all expect a bundler or an external JSZip, which
would mean either a build step or a second vendored file.

### Transitive dependency, disclosed

`pptxgen.bundle.js` has **JSZip 3.10.1 compiled into it**. It is not a separate
file and not a separate network request, but it is third-party code being
served from this origin, so it is recorded here rather than left implicit.

| | |
|---|---|
| **Library** | JSZip 3.10.1 |
| **Licence** | Dual: MIT **or** GPLv3 — we rely on it under MIT |
| **Upstream** | https://github.com/Stuk/jszip |

pptxgenjs's other declared dependencies (`image-size`, `https`, `@types/node`)
are Node-only paths. The package's `browser` field maps them to `false`, and
they are absent from the browser bundle.

---

## Not used

No webfonts are loaded — the design uses web-safe stacks only, so there is no
font host and no font payload. See the TODO at the foot of `assets/ttx.css` for
self-hosted display-face candidates if that changes.

No analytics, no tag manager, no framework, no polyfills.

---

## Updating pptxgenjs

1. Download the new tarball from the npm registry.
2. Compare your locally computed `sha1`/`sha512` against the registry's
   published `dist.shasum` / `dist.integrity` **before** extracting.
3. Extract `package/dist/pptxgen.bundle.js` → `vendor/pptxgen.bundle.js`
   and `package/LICENSE` → `vendor/pptxgenjs-LICENSE.txt`.
4. Record the new version, date, and all three hashes in this file.
5. Re-check the bundled JSZip version and its licence.
6. Export a deck and open it before committing — this is the only part of the
   site with no server-side verification path.
