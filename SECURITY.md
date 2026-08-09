# Security policy

## Reporting

Email **hello@insiderthreatanalyst.com** with `SECURITY` in the subject line.

Please include what you found, how to reproduce it, and what you think the
impact is. If you would rather not put details in email, say so and we will
find another channel.

Expect an acknowledgement within a few days. This is a one-person project, not
a staffed security team, so please allow reasonable time before disclosing
publicly. There is no bug bounty.

Please do not run automated scanners against
`ttx.insiderthreatanalyst.com`. Everything the site does happens in the
browser, so a local copy — clone the repo, open `index.html` — gives you the
whole attack surface without the traffic.

## What is in scope

The interesting surface is small and worth stating plainly:

- **Content injection.** Scenario JSON is authored text that ends up on the
  page. The renderers build DOM with `createElement` and `textContent` and
  never use `innerHTML`, so a scenario containing markup should render as
  visible characters and never as elements. A way to get authored content to
  execute is a real finding.
- **The query string.** `exercise.html` takes its entire configuration from the
  query string, including the scenario id used to build a `fetch()` path. That
  id is constrained to `[a-z0-9-]{1,64}` before use. A way past that constraint
  — traversal, protocol-relative, anything that reaches outside `content/` — is
  a real finding.
- **CSP.** The site is served with `script-src 'self'` and no `'unsafe-eval'`.
  A way to execute script within that policy is a real finding.
- **Server configuration.** The webroot on the live host is the repository
  itself. `.git`, dotfiles, backup droppings and all `.md` files are meant to
  404, and `/content/` is meant to serve `.json` and nothing else. Anything
  reachable that should not be is a real finding — that includes any file whose
  name suggests it was never meant for a browser.

## What is out of scope

- The absence of a security header that this static, no-backend, no-cookie,
  no-login site does not need.
- Findings that depend on an attacker already controlling the scenario JSON
  served from the host, or on a modified local copy.
- Denial of service and volumetric testing.
- Reports from automated tooling with no demonstrated impact.
- The CDN's own edge configuration and TLS termination.

## Design notes that pre-empt common reports

- **There is no backend.** No application server, no database, no API, no user
  accounts, no cookies, no analytics on this subdomain. Nothing you select is
  transmitted anywhere; the exercise is assembled in your browser from a static
  JSON file.
- **No build step.** The code that ships is the code in this repository. There
  is no transpiler, bundler or minifier in the path, and no `node_modules`.
- **One vendored dependency.** `pptxgenjs`, committed in `vendor/` with its
  hash recorded in `THIRDPARTY.md`, loaded only when a deck is exported. It
  contains two dynamic-code sites, both analysed as unreachable in normal
  operation; the reasoning is written out in the nginx vhost, next to the CSP
  it justifies. Evidence that either is reachable is a real finding.

## Content, not code

The scenarios describe insider threat activity for the purpose of exercising a
response. Everything in them is fictional, and tradecraft is deliberately held
at the level of published public advisories, written from the defender's side.
If you think a scenario crosses that line and is operationally useful to an
attacker, that is worth reporting too — same address.
