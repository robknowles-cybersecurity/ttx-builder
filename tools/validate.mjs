#!/usr/bin/env node
/* ============================================================================
   TTX Builder: structural validator for content/*.json
   ----------------------------------------------------------------------------
   Dependency-free. Node 20 or newer, built-ins only.

     node tools/validate.mjs                 every scenario in content/
     node tools/validate.mjs content/x.json  one or more named files

   Exit 0 when clean, 1 when there are findings. One finding per line on
   stdout; a one-line summary goes to stderr so stdout stays greppable.

   The checks run the real engine (assets/engine.js) rather than a model of
   it, for every scenario x 3 durations x 3 difficulties x linear on/off (180
   runs for ten scenarios), with every seat at the table and each industry
   in turn. Static checks that do not depend on the dials run once per file.

   What is checked, and the engine rule it mirrors:

   duplicate-id        Two sections share an id. numberById in assemble()
                       is keyed by id, so the later section silently steals
                       the earlier one's display number.
   unknown-role-key    A questions key that is neither "all" nor a role id.
                       foldQuestions() prints the raw key as the seat title.
   unknown-token       A {{token}} not in buildTokens(). subst() leaves it
                       visible on purpose; this makes that review step
                       mechanical. Also catches any literal {{ left in the
                       assembled output.
   placeholder         Authoring placeholder text (TODO, TBD, XXX runs,
                       <angle-bracket notes>) in a printed field. The masked
                       routing number in employment-fraud s03 is deliberate
                       and whitelisted below.
   goto-missing        A decision option points at an id that is in no
                       section at all. resolveGoto() returns null and the
                       renderer prints a dash where the number should be.
   goto-backward       A goto whose resolved target sits at or before the
                       decision in the printed book. The engine allows this
                       without a warning; no scenario here loops, and a
                       backward turn in a gamebook is almost always a typo.
   retargeted          The literal goto target was filtered out of this run
                       and the engine walked forward to the next survivor
                       (an assembly warning). Legal, but it means a dial
                       setting changes where a decision lands, so it is
                       surfaced here rather than left to the on-screen panel.
   unreachable         A kept section that the room can never be sent to:
                       not the opening section, not reached by fall-through
                       from a non-terminating predecessor, and not a resolved
                       goto target. Judged with every option live. In linear
                       mode the engine collapses each decision to its first
                       option but still prints the other branch's sections,
                       so most of the book is unreachable by construction;
                       that is the mode's design, not a finding, and the
                       check is skipped there.
   fallthrough-epilogue A non-terminating section whose next printed section
                       is an epilogue. The README contract says endings are
                       reached only by goto; the engine prints no stop line
                       for narrative or inject sections, so the facilitator
                       would read straight into an ending.
   no-terminator       The last printed section is not a decision or an
                       epilogue, or a walk from the opening section (taking
                       every option, or only the first in linear mode) runs
                       off the end or stalls at a decision with no usable
                       option. Both mean a run that does not end on a
                       terminator.
   engine-warning      Any other assembly warning the engine recorded.

   Ambiguities, stated rather than guessed at:

   - "Backward" is judged on resolved display numbers, after filtering, since
     that is what the facilitator sees. The engine itself has no concept of
     direction.
   - Fall-through into an epilogue is reported even though the engine permits
     it. If a scenario ever wants an ending reached by reading on, this check
     will need an opt-out.
   - Unknown inject kinds are not checked: render.js deliberately renders
     them with the slug as the label so the drift is visible.
   - Keys beginning with "_" are authoring notes (README: "ignored by the
     renderer") and are skipped by the static text checks.
   ========================================================================== */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const require = createRequire(import.meta.url);
const TTX = require(join(repoRoot, 'assets', 'engine.js'));

const DURATIONS = ['60', '90', '120'];
const DIFFICULTIES = ['first_timer', 'standard', 'veteran'];
const LINEAR = [false, true];
const KNOWN_TOKENS = Object.keys(TTX._internal.buildTokens({}));

/* Strings that look like placeholders but are deliberate content. Keyed by
   scenario id, then exact substring. */
const PLACEHOLDER_WHITELIST = {
  'employment-fraud': [
    /* s03 payroll exception row: a routing number masked on purpose, the
       way a payroll provider's exception export would print it. */
    '0XX-XXX-118'
  ]
};

const findings = new Set();
function report(scenarioId, run, check, message) {
  const where = run ? `${scenarioId} d=${run.duration} x=${run.difficulty} linear=${run.classicLinear ? 'on' : 'off'}`
                    : scenarioId;
  findings.add(`${where} ${check}: ${message}`);
}

/* -- static checks (once per file) ---------------------------------------- */

function walkStrings(value, path, visit) {
  if (typeof value === 'string') { visit(value, path); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, visit)); return; }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('_')) { continue; }
      walkStrings(value[key], path ? `${path}.${key}` : key, visit);
    }
  }
}

function sectionPath(scenario, path) {
  /* Turn "sections[7].inject.body" into "s08.inject.body" for readability. */
  return path.replace(/^sections\[(\d+)\]/, (whole, i) => {
    const s = scenario.sections[Number(i)];
    return s && s.id ? s.id : whole;
  });
}

function staticChecks(scenario, id) {
  const sections = Array.isArray(scenario.sections) ? scenario.sections : [];
  const roleIds = new Set((scenario.roles || []).map(r => r.id));
  const allIds = sections.map(s => s.id);

  /* duplicate-id */
  const seen = new Map();
  allIds.forEach((sid, i) => {
    if (seen.has(sid)) { report(id, null, 'duplicate-id', `"${sid}" at sections[${seen.get(sid)}] and sections[${i}]`); }
    else { seen.set(sid, i); }
  });

  /* unknown-role-key */
  sections.forEach(s => {
    for (const key of Object.keys(s.questions || {})) {
      if (key !== 'all' && !roleIds.has(key)) {
        report(id, null, 'unknown-role-key', `${s.id} questions key "${key}" matches no role`);
      }
    }
  });

  /* goto-missing (static form; the per-run form catches it too, but this
     names the section without needing a run) */
  const idSet = new Set(allIds);
  sections.forEach(s => {
    const opts = (s.decision && Array.isArray(s.decision.options)) ? s.decision.options : [];
    opts.forEach((o, i) => {
      if (!idSet.has(o.goto)) { report(id, null, 'goto-missing', `${s.id} option ${i + 1} -> "${o.goto}" is not a section id`); }
    });
    if (s.type === 'decision' && opts.length === 0) {
      report(id, null, 'no-terminator', `${s.id} is a decision with no options`);
    }
  });

  /* unknown-token and placeholder, over every printed string */
  const whitelist = PLACEHOLDER_WHITELIST[id] || [];
  walkStrings(scenario, '', (text, path) => {
    const where = sectionPath(scenario, path);
    for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) {
      if (!KNOWN_TOKENS.includes(m[1])) { report(id, null, 'unknown-token', `${where}: {{${m[1]}}}`); }
    }
    for (const m of text.matchAll(/\{\{(?!\w+\}\})/g)) {
      report(id, null, 'unknown-token', `${where}: malformed "{{" at offset ${m.index}`);
    }
    let scrubbed = text;
    for (const ok of whitelist) { scrubbed = scrubbed.split(ok).join(''); }
    const placeholders = [
      /\bTODO\b/, /\bTBD\b/, /\bFIXME\b/, /\blorem ipsum\b/i,
      /\b[A-Z0-9-]*XXX[A-Z0-9-]*\b/,                 /* XXX-style masks */
      /<(?![^>]*@)(?![^>]*\{\{)[a-z][^<>]{3,}>/      /* <angle-bracket notes>, not addresses */
    ];
    for (const re of placeholders) {
      const m = scrubbed.match(re);
      if (m) { report(id, null, 'placeholder', `${where}: "${m[0]}"`); }
    }
  });
}

/* -- per-run checks -------------------------------------------------------- */

function runChecks(scenario, id, sel) {
  const ex = TTX.assemble(scenario, sel);
  const run = sel;
  const sections = ex.sections;
  if (!sections.length) { report(id, run, 'no-terminator', 'no sections survived filtering'); return; }

  const numById = new Map(sections.map(s => [s.id, s.num]));
  const byNum = new Map(sections.map(s => [s.num, s]));
  const isTerminator = s => s.flowStop === 'decision' || s.flowStop === 'epilogue';

  /* engine warnings, split into the ones with their own check name */
  for (const w of ex.warnings) {
    if (/was filtered out/.test(w)) { report(id, run, 'retargeted', w); }
    else if (/unknown section id/.test(w)) { report(id, run, 'goto-missing', w); }
    else { report(id, run, 'engine-warning', w); }
  }

  /* leaked tokens in assembled output (anything subst() left behind) */
  walkStrings(ex, '', (text, path) => {
    const m = text.match(/\{\{\w*\}?\}?/);
    if (m) { report(id, run, 'unknown-token', `assembled ${sectionPath(ex, path)}: "${m[0]}"`); }
  });

  /* goto-backward, and build the reachability graph */
  const reachable = new Set([sections[0].num]);
  const edges = new Map();
  sections.forEach(s => {
    const next = [];
    if (s.decision) {
      s.decision.options.forEach((o, i) => {
        if (o.gotoNum === null) { return; }
        if (o.gotoNum <= s.num) {
          report(id, run, 'goto-backward', `${s.id} (section ${s.num}) option ${i + 1} -> ${o.gotoId} (section ${o.gotoNum})`);
        }
        next.push(o.gotoNum);
      });
    } else if (!isTerminator(s)) {
      if (byNum.has(s.num + 1)) { next.push(s.num + 1); }
    }
    edges.set(s.num, next);
  });
  const stack = [sections[0].num];
  while (stack.length) {
    const n = stack.pop();
    for (const m of edges.get(n) || []) {
      if (!reachable.has(m)) { reachable.add(m); stack.push(m); }
    }
  }

  /* unreachable (branching mode only; see the header note on linear) */
  if (!sel.classicLinear) {
    sections.forEach(s => {
      if (!reachable.has(s.num)) { report(id, run, 'unreachable', `${s.id} (section ${s.num}) cannot be reached`); }
    });
  }

  /* fallthrough-epilogue */
  sections.forEach(s => {
    if (isTerminator(s)) { return; }
    const nxt = byNum.get(s.num + 1);
    if (nxt && nxt.type === 'epilogue') {
      report(id, run, 'fallthrough-epilogue', `${s.id} (section ${s.num}) reads straight into epilogue ${nxt.id} (section ${nxt.num})`);
    }
  });

  /* no-terminator: last printed section, and every walk from the opening */
  const last = sections[sections.length - 1];
  if (!isTerminator(last)) {
    report(id, run, 'no-terminator', `last section ${last.id} (section ${last.num}) is a ${last.type}, not a decision or epilogue`);
  }
  const visited = new Set();
  function walk(num, trail) {
    if (visited.has(num)) { return; }
    visited.add(num);
    const s = byNum.get(num);
    if (s.type === 'epilogue') { return; }
    const next = edges.get(num) || [];
    if (!next.length) {
      report(id, run, 'no-terminator', `walk ${trail.concat(s.id).join(' > ')} ends at ${s.id} (section ${s.num}) without an epilogue`);
      return;
    }
    for (const m of next) { walk(m, trail.concat(s.id)); }
  }
  walk(sections[0].num, []);
}

/* -- main ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const contentDir = join(repoRoot, 'content');
const files = args.length
  ? args.map(a => resolve(a))
  : readdirSync(contentDir).filter(f => f.endsWith('.json')).sort().map(f => join(contentDir, f));

let runs = 0;
for (const file of files) {
  if (!existsSync(file)) { findings.add(`${file} read-error: no such file`); continue; }
  let scenario;
  try { scenario = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { findings.add(`${basename(file)} read-error: ${e.message}`); continue; }

  const id = (scenario.meta && scenario.meta.id) || basename(file, '.json');
  if (id !== basename(file, '.json')) {
    report(id, null, 'engine-warning', `meta.id "${id}" does not match file name ${basename(file)}`);
  }
  staticChecks(scenario, id);

  const roles = (scenario.roles || []).map(r => r.id);
  const industries = Object.keys(scenario.industries || {});
  if (!industries.length) { industries.push('financial'); }
  for (const duration of DURATIONS) {
    for (const difficulty of DIFFICULTIES) {
      for (const classicLinear of LINEAR) {
        runs += 1;
        for (const industry of industries) {
          runChecks(scenario, id, { industry, maturity: 'formal', duration, difficulty, classicLinear, roles });
        }
      }
    }
  }
}

const lines = [...findings].sort();
for (const line of lines) { process.stdout.write(line + '\n'); }
process.stderr.write(`${files.length} scenario file(s), ${runs} runs, ${lines.length} finding(s)\n`);
process.exit(lines.length ? 1 : 0);
