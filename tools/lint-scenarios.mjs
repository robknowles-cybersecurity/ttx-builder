#!/usr/bin/env node
/* lint-scenarios.mjs
   ---------------------------------------------------------------------------
   The scenario schema check this repository was believed to have and did not.
   Node standard library only, no dependencies, no package.json: run it from the
   repo root with `node tools/lint-scenarios.mjs`.

   WHAT IT ENFORCES

   1. Every content/*.json parses as JSON.
   2. Provenance is declared exactly one of two ways:
        meta.sources      — an array of one or more non-empty strings, or
        meta.sources_note — a non-empty string saying why there are none.
      Exactly one. Both present is a FAIL, because a roster and an excuse for
      having no roster cannot both be true. Both absent is a FAIL, because
      silence is the state this rule exists to abolish: a scenario that cites
      nothing must SAY it cites nothing, in a sentence someone wrote on
      purpose. An empty meta.sources array is not "no sources declared" — it is
      the missing state wearing a costume, and it fails as both-absent.

   It prints a roster line per scenario either way, so a clean run is also the
   inventory, and exits 1 if any file fails.

   An optional argument points it at a directory other than content/ — that is
   how the rule itself is tested, against fixtures outside the corpus.  */

import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const dir = process.argv[2] || 'content';

/* A source entry is a string with something in it. A list of empty strings is
   not a roster; whitespace is not a citation. */
const isFilledString = (v) => typeof v === 'string' && v.trim() !== '';

function lintFile(path) {
  const fails = [];
  const name = basename(path);
  let doc;

  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { name, id: null, fails: [`does not parse: ${error.message}`] };
  }

  const meta = (doc && typeof doc === 'object' && doc.meta) || {};
  const id = isFilledString(meta.id) ? meta.id
           : isFilledString(doc.id) ? doc.id
           : name.replace(/\.json$/, '');

  const { sources, sources_note: note } = meta;

  /* Present-and-well-formed, judged separately from present-at-all, so a
     malformed roster reports as malformed rather than as missing. */
  const hasSources = sources !== undefined && sources !== null;
  const hasNote = note !== undefined && note !== null;

  if (hasSources) {
    if (!Array.isArray(sources)) {
      fails.push('meta.sources is present but is not an array');
    } else if (sources.length === 0) {
      fails.push('meta.sources is an empty array — declare meta.sources_note instead');
    } else {
      const bad = sources
        .map((entry, i) => (isFilledString(entry) ? null : i))
        .filter((i) => i !== null);
      if (bad.length) {
        fails.push(`meta.sources has empty or non-string entries at index ${bad.join(', ')}`);
      }
    }
  }

  if (hasNote && !isFilledString(note)) {
    fails.push('meta.sources_note is present but is not a non-empty string');
  }

  /* The XOR itself, measured on well-formed presence only — a malformed
     roster has already been reported above and does not also get to be
     "missing". */
  const rosterCounts = hasSources && Array.isArray(sources) && sources.length > 0;
  const noteCounts = hasNote && isFilledString(note);

  if (rosterCounts && noteCounts) {
    fails.push('both meta.sources and meta.sources_note are present — declare exactly one');
  } else if (!rosterCounts && !noteCounts && fails.length === 0) {
    fails.push('neither meta.sources nor meta.sources_note is declared');
  }

  return { name, id, fails, count: rosterCounts ? sources.length : 0, note: noteCounts ? note : null };
}

let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
} catch (error) {
  console.error(`lint-scenarios: cannot read ${dir}/ — ${error.message}`);
  console.error('Run this from the repository root, or pass a directory as the first argument.');
  process.exit(1);
}

if (files.length === 0) {
  console.error(`lint-scenarios: no *.json found in ${dir}/`);
  process.exit(1);
}

console.log(`lint-scenarios — ${files.length} scenario file(s) in ${dir}/\n`);

let failed = 0;

for (const file of files) {
  const result = lintFile(join(dir, file));

  if (result.fails.length) {
    failed += 1;
    console.log(`FAIL  ${result.id ?? result.name}`);
    for (const reason of result.fails) { console.log(`        ${reason}  [${result.name}]`); }
  } else if (result.count) {
    console.log(`ok    ${result.id} · ${result.count} source${result.count === 1 ? '' : 's'}`);
  } else {
    console.log(`ok    ${result.id} · none — ${result.note}`);
  }
}

console.log('');
if (failed) {
  console.log(`${files.length - failed} passed, ${failed} FAILED`);
  process.exit(1);
}
console.log(`${files.length} passed, 0 failed`);
process.exit(0);
