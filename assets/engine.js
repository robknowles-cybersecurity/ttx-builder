/* ============================================================================
   TTX Builder — assembly engine
   ----------------------------------------------------------------------------
   Pure functions. No DOM, no network, no globals beyond window.TTX.
   Takes (scenario JSON, selections) and returns a fully-resolved exercise
   object that the renderers turn into HTML and the deck builder turns into
   slides. All filtering, variant selection and section renumbering happens
   here and ONLY here, so "turn to section N" has exactly one source of truth.
   ========================================================================== */
'use strict';

var TTX = (function () {

  /* -- token substitution ---------------------------------------------------
     Content uses {{org_name}}-style tokens so one scenario reads correctly for
     every industry. Unknown tokens are left visible on purpose: a stray
     {{typo}} in authored content should be obvious in review, not silently
     swallowed. */

  function orgDomain(orgName) {
    var slug = String(orgName || 'example').toLowerCase().replace(/[^a-z0-9]+/g, '');
    return (slug || 'example') + '.example';
  }

  function buildTokens(industry) {
    var ind = industry || {};
    return {
      org_name: ind.org_name || 'the organization',
      crown_jewels: ind.crown_jewels || 'your most sensitive systems',
      regulator: ind.regulator || 'your regulator',
      flavor_notes: ind.flavor_notes || '',
      org_domain: orgDomain(ind.org_name)
    };
  }

  function subst(text, tokens) {
    if (typeof text !== 'string') { return text; }
    return text.replace(/\{\{(\w+)\}\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : whole;
    });
  }

  function substAll(list, tokens) {
    if (!Array.isArray(list)) { return []; }
    return list.map(function (item) { return subst(item, tokens); });
  }

  /* -- difficulty -----------------------------------------------------------
     first_timer : swap in the first_timer variant where present, show coaching,
                   omit red herrings.
     standard    : base body, no coaching, omit red herrings.
     veteran     : swap in the veteran variant where present, no coaching,
                   INCLUDE red herrings. */

  /* Works on ANY object carrying `body` + `difficulty_variants`, because two
     levels of the schema now use that shape:

       section.difficulty_variants.<level>.body         (s02 — reframes the section)
       section.inject.difficulty_variants.<level>.body  (s07 — rewrites the artefact itself)

     The inject-level form was added by the desk after the original dispatch:
     a first-timer needs the DLP alert's own text to spell out what it is
     showing, which is a different edit from softening the narrative around it.
     Keeping one function means the two levels can never drift apart. */

  function bodyForDifficulty(carrier, difficulty) {
    var variants = (carrier && carrier.difficulty_variants) || {};
    var chosen = variants[difficulty];
    if (chosen && typeof chosen.body === 'string' && chosen.body.length) {
      return { body: chosen.body, variantUsed: difficulty };
    }
    return { body: (carrier && carrier.body) || '', variantUsed: null };
  }

  /* -- filtering ------------------------------------------------------------
     A section with no `durations` key is treated as always-on. An explicit
     empty array is also always-on; authors who want a section suppressed
     should delete it rather than encode an empty list. */

  function passesDuration(section, duration) {
    if (!Array.isArray(section.durations) || section.durations.length === 0) { return true; }
    return section.durations.indexOf(String(duration)) !== -1;
  }

  function passesDifficulty(section, difficulty) {
    if (section.red_herring === true && difficulty !== 'veteran') { return false; }
    return true;
  }

  /* -- questions ------------------------------------------------------------
     Questions are keyed by role id, or by the literal "all".
       - "all"                     -> asked of the whole room
       - key matching a SELECTED   -> that role's question, printed on their
         role                         sheet and in the facilitator's copy
       - key matching an ABSENT    -> folded into the facilitator's set and
         role                         labelled, so the seat's perspective is
                                      still represented at the table */

  function foldQuestions(section, tokens, selectedRoleIds, rolesById) {
    var raw = section.questions || {};
    var out = { all: [], byRole: [], folded: [] };

    Object.keys(raw).forEach(function (key) {
      var items = substAll(raw[key], tokens);
      if (!items.length) { return; }

      if (key === 'all') {
        out.all = out.all.concat(items);
        return;
      }

      var role = rolesById[key];
      var title = role ? subst(role.title, tokens) : key;

      if (selectedRoleIds.indexOf(key) !== -1) {
        out.byRole.push({ roleId: key, roleTitle: title, items: items });
      } else {
        out.folded.push({ roleId: key, roleTitle: title, items: items });
      }
    });

    return out;
  }

  /* -- main assembly ------------------------------------------------------ */

  function assemble(scenario, sel) {
    var warnings = [];
    var industry = (scenario.industries || {})[sel.industry];
    if (!industry) {
      warnings.push('Industry "' + sel.industry + '" not found in this scenario; generic wording used.');
    }
    var tokens = buildTokens(industry);

    var allRoles = Array.isArray(scenario.roles) ? scenario.roles : [];
    var rolesById = {};
    allRoles.forEach(function (r) { rolesById[r.id] = r; });

    var selectedRoleIds = (sel.roles || []).filter(function (id) {
      if (!rolesById[id]) {
        warnings.push('Role "' + id + '" is not defined in this scenario and was ignored.');
        return false;
      }
      return true;
    });

    /* 1. Filter. Order is preserved from the source file. */
    var source = Array.isArray(scenario.sections) ? scenario.sections : [];
    var kept = source.filter(function (s) {
      return passesDuration(s, sel.duration) && passesDifficulty(s, sel.difficulty);
    });

    if (!kept.length) {
      warnings.push('No sections survived filtering for this combination of duration and difficulty.');
    }

    /* 2. Assign display numbers AFTER filtering. This map is the only place
          section ids become printed numbers. */
    var numberById = {};
    kept.forEach(function (s, i) { numberById[s.id] = i + 1; });

    var sourceOrder = source.map(function (s) { return s.id; });

    /* 3. Resolve a goto target to a display number that always exists.
          If the literal target survived filtering, use it. If it did not,
          walk forward through the ORIGINAL order to the next surviving
          section — that is the next thing that actually happens in the story.
          If nothing survives after it, land on the final section. */
    function resolveGoto(targetId) {
      if (numberById[targetId]) {
        return { num: numberById[targetId], id: targetId, exact: true };
      }
      var idx = sourceOrder.indexOf(targetId);
      if (idx === -1) {
        warnings.push('Decision points at unknown section id "' + targetId + '".');
        return null;
      }
      for (var i = idx + 1; i < sourceOrder.length; i++) {
        var candidate = sourceOrder[i];
        if (numberById[candidate]) {
          warnings.push('Section "' + targetId + '" was filtered out of this run; its pointer was retargeted to "' + candidate + '".');
          return { num: numberById[candidate], id: candidate, exact: false };
        }
      }
      if (kept.length) {
        var last = kept[kept.length - 1];
        warnings.push('Section "' + targetId + '" was filtered out and nothing follows it; its pointer was retargeted to the closing section.');
        return { num: numberById[last.id], id: last.id, exact: false };
      }
      return null;
    }

    /* 4. Build the resolved sections. */
    var sections = kept.map(function (s, i) {
      var picked = bodyForDifficulty(s, sel.difficulty);
      var type = s.type || 'narrative';

      /* Flow control — contract items 2 and 4.
         The gamebook is read in array order and falls through from one section
         to the next, EXCEPT where flow terminates. Two types terminate it:

           'decision' — the room chooses and jumps. Reading on is wrong, and in
                        this scenario it is actively misleading: the branches are
                        contiguous array slices, so the section printed after a
                        branch's closing decision is the OTHER branch's opening.
                        Falling through from s21 would land the room in s17.
           'epilogue' — an ending. The four endings sit consecutively in the
                        array, so falling out of one reads the next three.

         Everything else falls through safely, precisely because every branch
         slice is terminated by a decision (contract item 3). The renderer must
         print a visible stop for anything non-null here. */
      var flowStop = (type === 'decision') ? 'decision'
                   : (type === 'epilogue') ? 'epilogue'
                   : null;

      var view = {
        id: s.id,
        num: i + 1,
        type: type,
        flowStop: flowStop,
        body: subst(picked.body, tokens),
        variantUsed: picked.variantUsed,
        redHerring: s.red_herring === true,
        coaching: sel.difficulty === 'first_timer' ? substAll(s.coaching, tokens) : [],
        questions: foldQuestions(s, tokens, selectedRoleIds, rolesById),
        inject: null,
        decision: null
      };

      if (s.inject) {
        /* Same variant rule as the section body, one level down. The result
           still goes through subst() — the first-timer variant of s07 carries
           {{crown_jewels}}, so skipping substitution here would print literal
           braces on a handout that lands in a participant's hands. */
        var injectPick = bodyForDifficulty(s.inject, sel.difficulty);
        view.inject = {
          kind: (s.inject.kind || 'memo').toLowerCase(),
          from: subst(s.inject.from || '', tokens),
          subject: subst(s.inject.subject || '', tokens),
          body: subst(injectPick.body, tokens),
          variantUsed: injectPick.variantUsed,
          sectionNum: view.num
        };
      }

      if (s.decision) {
        var opts = Array.isArray(s.decision.options) ? s.decision.options : [];
        /* Classic linear collapses every branch to the first option, so the
           book reads start-to-finish with no page turning. */
        var used = sel.classicLinear ? opts.slice(0, 1) : opts;
        view.decision = {
          prompt: subst(s.decision.prompt || '', tokens),
          collapsed: !!sel.classicLinear && opts.length > 1,
          options: used.map(function (o) {
            var target = resolveGoto(o.goto);
            return {
              label: subst(o.label || '', tokens),
              gotoId: o.goto,
              gotoNum: target ? target.num : null,
              exact: target ? target.exact : false
            };
          })
        };
      }

      return view;
    });

    /* 5. Role sheets, pruned to the seats actually at the table. */
    var roleSheets = selectedRoleIds.map(function (id) {
      var r = rolesById[id];
      var mine = [];
      sections.forEach(function (sec) {
        sec.questions.byRole.forEach(function (q) {
          if (q.roleId === id) { mine.push({ num: sec.num, items: q.items }); }
        });
      });
      return {
        id: r.id,
        title: subst(r.title || '', tokens),
        briefing: subst(r.briefing || '', tokens),
        authorities: substAll(r.authorities, tokens),
        privateKnowledge: substAll(r.private_knowledge, tokens),
        questionsBySection: mine
      };
    });

    /* 6. Injects, in play order, each destined for its own printed page. */
    var injects = sections.filter(function (s) { return s.inject; })
                          .map(function (s) { return s.inject; });

    var aar = scenario.aar || {};

    return {
      meta: {
        id: (scenario.meta || {}).id || 'unknown',
        title: subst((scenario.meta || {}).title || 'Untitled exercise', tokens),
        tagline: subst((scenario.meta || {}).tagline || '', tokens),
        version: (scenario.meta || {}).version || '0'
      },
      selections: {
        industry: sel.industry,
        industryLabel: industry ? industry.org_name : sel.industry,
        maturity: sel.maturity,
        maturityLabel: sel.maturity === 'formal' ? 'Formal program' : 'Ad hoc / emerging',
        duration: sel.duration,
        difficulty: sel.difficulty,
        difficultyLabel: ({
          first_timer: 'First-timer friendly',
          standard: 'Standard',
          veteran: 'Veteran'
        })[sel.difficulty] || sel.difficulty,
        classicLinear: !!sel.classicLinear,
        roles: selectedRoleIds.map(function (id) { return subst(rolesById[id].title || '', tokens); })
      },
      /* org_name / crown_jewels / regulator are the token VALUES, so they are
         emitted as authored — running subst over them would be a no-op at best.
         flavor_notes is prose the desk may well write with tokens in it, so it
         goes through like every other body-bearing field. */
      industry: industry ? {
        orgName: industry.org_name,
        crownJewels: industry.crown_jewels,
        regulator: industry.regulator,
        flavorNotes: subst(industry.flavor_notes || '', tokens)
      } : null,
      sections: sections,
      roleSheets: roleSheets,
      injects: injects,
      aar: {
        hotwash: substAll(aar.hotwash, tokens),
        objectives: substAll(aar.objectives, tokens)
      },
      warnings: warnings
    };
  }

  return {
    assemble: assemble,
    /* exported for inspection / future unit tests */
    _internal: { subst: subst, buildTokens: buildTokens, orgDomain: orgDomain }
  };

})();

if (typeof module !== 'undefined' && module.exports) { module.exports = TTX; }
