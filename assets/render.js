/* ============================================================================
   TTX Builder — renderers
   ----------------------------------------------------------------------------
   Reads the query string, loads the scenario JSON, runs it through the
   assembly engine, and paints the four views. All DOM is built with
   createElement + textContent — never innerHTML — so authored content can
   contain angle brackets and ampersands without becoming markup.
   ========================================================================== */
'use strict';

(function () {

  var KIND_LABEL = {
    narrative:  'Narrative',
    inject:     'Inject',
    discussion: 'Discussion',
    decision:   'Decision point',
    epilogue:   'Close'
  };

  var INJECT_LABEL = {
    email: 'Electronic mail',
    dlp:   'Data loss prevention alert',
    hr:    'Human resources memorandum',
    news:  'News item',
    memo:  'Memorandum'
  };

  /* -- tiny DOM helpers --------------------------------------------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  function paragraphs(container, body) {
    String(body || '').split(/\n{2,}/).forEach(function (chunk) {
      var trimmed = chunk.trim();
      if (trimmed) { container.appendChild(el('p', null, trimmed)); }
    });
  }

  function list(items, className) {
    var ul = el('ul', className || null);
    (items || []).forEach(function (item) { ul.appendChild(el('li', null, item)); });
    return ul;
  }

  function printBar(label) {
    var bar = el('div', 'actions no-print');
    var btn = el('button', 'btn btn--quiet', label || 'Print / Save as PDF');
    btn.type = 'button';
    btn.addEventListener('click', function () { window.print(); });
    bar.appendChild(btn);
    return bar;
  }

  /* -- query string -------------------------------------------------------- */

  function readSelections() {
    var q = new URLSearchParams(window.location.search);
    var roles = (q.get('r') || 'int_lead,soc,hr,legal,it_iam')
                  .split(',')
                  .map(function (s) { return s.trim(); })
                  .filter(Boolean);
    return {
      scenario:      q.get('s') || 'dprk-hire',
      industry:      q.get('i') || 'finserv',
      maturity:      q.get('m') || 'formal',
      duration:      q.get('d') || '90',
      difficulty:    q.get('x') || 'standard',
      classicLinear: q.get('l') === '1',
      roles:         roles
    };
  }

  /* -- inject block (shared by gamebook and handout views) ----------------- */

  function injectBlock(inject, forHandout) {
    var box = el('article', 'inject inject--' + inject.kind);

    var chrome = el('div', 'inject__chrome');
    chrome.appendChild(el('span', null, INJECT_LABEL[inject.kind] || 'Handout'));
    chrome.appendChild(el('span', null,
      forHandout ? 'Deal at section ' + inject.sectionNum : 'Handout — section ' + inject.sectionNum));
    box.appendChild(chrome);

    var meta = el('div', 'inject__meta');
    if (inject.kind === 'news') {
      meta.appendChild(el('div', null, inject.subject));
    } else {
      if (inject.from) {
        var f = el('div');
        f.appendChild(el('b', null, 'FROM'));
        f.appendChild(document.createTextNode(inject.from));
        meta.appendChild(f);
      }
      if (inject.subject) {
        var s = el('div');
        s.appendChild(el('b', null, 'SUBJECT'));
        s.appendChild(document.createTextNode(inject.subject));
        meta.appendChild(s);
      }
    }
    box.appendChild(meta);

    box.appendChild(el('pre', 'inject__body', inject.body));
    return box;
  }

  /* -- gamebook ------------------------------------------------------------ */

  function renderFrontMatter(ex) {
    var fm = el('section', 'frontmatter');
    fm.appendChild(el('h2', null, ex.meta.title));
    if (ex.meta.tagline) { fm.appendChild(el('p', 'frontmatter__tagline', ex.meta.tagline)); }

    var dl = el('dl', 'specsheet');
    function row(term, def) {
      dl.appendChild(el('dt', null, term));
      dl.appendChild(el('dd', null, def));
    }

    row('Organisation', ex.industry ? ex.industry.orgName : ex.selections.industry);
    if (ex.industry) {
      row('Crown jewels', ex.industry.crownJewels);
      row('Regulator', ex.industry.regulator);
    }
    row('Posture', ex.selections.maturityLabel);
    row('Runtime', ex.selections.duration + ' minutes');
    row('Difficulty', ex.selections.difficultyLabel);
    row('Mode', ex.selections.classicLinear ? 'Classic linear (branches collapsed)' : 'Branching');
    row('Sections', String(ex.sections.length));
    row('At the table', ex.selections.roles.length ? ex.selections.roles.join(', ') : 'Facilitator only');
    fm.appendChild(dl);

    if (ex.industry && ex.industry.flavorNotes) {
      var notes = el('div', 'coaching');
      notes.appendChild(el('p', 'coaching__head', 'Setting'));
      notes.appendChild(el('p', null, ex.industry.flavorNotes));
      fm.appendChild(notes);
    }

    return fm;
  }

  function renderQuestions(section) {
    var frag = document.createDocumentFragment();
    var q = section.questions;

    if (q.all.length) {
      var block = el('div', 'qblock');
      block.appendChild(el('p', 'qblock__head', 'Ask the room'));
      block.appendChild(list(q.all, 'qlist'));
      frag.appendChild(block);
    }

    q.byRole.forEach(function (entry) {
      var block = el('div', 'qblock');
      block.appendChild(el('p', 'qblock__head', 'Ask — ' + entry.roleTitle));
      block.appendChild(list(entry.items, 'qlist'));
      frag.appendChild(block);
    });

    q.folded.forEach(function (entry) {
      var block = el('div', 'qblock qblock--folded');
      block.appendChild(el('p', 'qblock__head', 'Empty seat — ' + entry.roleTitle));
      block.appendChild(el('p', 'folded-why',
        'Nobody is filling this seat. Put these to the room yourself, or answer them aloud as the absent party.'));
      block.appendChild(list(entry.items, 'qlist'));
      frag.appendChild(block);
    });

    return frag;
  }

  function renderDecision(decision) {
    var box = el('div', 'decision');
    box.appendChild(el('p', 'decision__prompt', decision.prompt));

    var ul = el('ul', 'decision__list');
    decision.options.forEach(function (opt) {
      var li = el('li', 'decision__item');

      li.appendChild(document.createTextNode('If the room chooses '));
      li.appendChild(el('strong', null, opt.label));
      li.appendChild(document.createTextNode(','));

      var turn = el('span', 'turn-to' + (opt.exact ? '' : ' turn-to--retarget'));
      turn.appendChild(document.createTextNode('turn to section '));
      turn.appendChild(el('span', 'turn-to__n', opt.gotoNum === null ? '—' : String(opt.gotoNum)));
      li.appendChild(turn);

      ul.appendChild(li);
    });
    box.appendChild(ul);

    if (decision.collapsed) {
      box.appendChild(el('p', 'decision__collapsed',
        'Classic linear mode: the alternative branches are collapsed for this run. The exercise continues at the section above.'));
    }

    return box;
  }

  function renderGamebook(ex, mount) {
    mount.appendChild(printBar('Print the gamebook'));

    if (ex.warnings.length) {
      var warn = el('div', 'notice no-print');
      warn.appendChild(el('p', 'notice__head', 'Assembly notes'));
      warn.appendChild(list(ex.warnings));
      mount.appendChild(warn);
    }

    mount.appendChild(renderFrontMatter(ex));

    if (ex.aar.objectives.length) {
      var obj = el('section', 'frontmatter');
      obj.appendChild(el('h2', null, 'Objectives'));
      obj.appendChild(list(ex.aar.objectives, 'qlist'));
      mount.appendChild(obj);
    }

    ex.sections.forEach(function (section) {
      var art = el('article', 'section' + (section.redHerring ? ' section--herring' : ''));

      var head = el('div', 'section__head');
      head.appendChild(el('span', 'section__num', String(section.num)));
      var kind = el('span', 'section__kind', KIND_LABEL[section.type] || section.type);
      head.appendChild(kind);
      if (section.redHerring) {
        head.appendChild(el('span', 'herring-flag', 'Red herring'));
      }
      art.appendChild(head);

      var body = el('div', 'section__body');
      paragraphs(body, section.body);
      art.appendChild(body);

      if (section.inject) { art.appendChild(injectBlock(section.inject, false)); }
      art.appendChild(renderQuestions(section));
      if (section.decision) { art.appendChild(renderDecision(section.decision)); }

      if (section.coaching.length) {
        var coach = el('div', 'coaching');
        coach.appendChild(el('p', 'coaching__head', 'Facilitator coaching'));
        coach.appendChild(list(section.coaching));
        art.appendChild(coach);
      }

      mount.appendChild(art);
    });
  }

  /* -- role sheets --------------------------------------------------------- */

  function renderRoles(ex, mount) {
    mount.appendChild(printBar('Print all role sheets'));

    if (!ex.roleSheets.length) {
      mount.appendChild(el('p', null, 'No seats were selected, so there are no role sheets to print.'));
      return;
    }

    ex.roleSheets.forEach(function (role) {
      var sheet = el('section', 'sheet');
      sheet.appendChild(el('p', 'sheet__kicker', ex.meta.title + ' — character sheet'));
      sheet.appendChild(el('h3', 'sheet__title', role.title));

      var brief = el('div', 'sheet__briefing');
      paragraphs(brief, role.briefing);
      sheet.appendChild(brief);

      if (role.authorities.length) {
        sheet.appendChild(el('h4', null, 'What you can do without asking'));
        sheet.appendChild(list(role.authorities));
      }

      if (role.questionsBySection.length) {
        sheet.appendChild(el('h4', null, 'Your questions'));
        var ul = el('ul');
        role.questionsBySection.forEach(function (entry) {
          entry.items.forEach(function (text) {
            var li = el('li');
            li.appendChild(el('strong', null, 'Section ' + entry.num + '. '));
            li.appendChild(document.createTextNode(text));
            ul.appendChild(li);
          });
        });
        sheet.appendChild(ul);
      }

      if (role.privateKnowledge.length) {
        var box = el('div', 'private');
        box.appendChild(el('span', 'private__head', 'Private knowledge'));
        box.appendChild(el('p', 'private__warn',
          'Do not volunteer this. Reveal it only if the room asks the right question — or if the facilitator prompts you.'));
        box.appendChild(list(role.privateKnowledge));
        sheet.appendChild(box);
      }

      mount.appendChild(sheet);
    });
  }

  /* -- inject handouts ----------------------------------------------------- */

  function renderInjects(ex, mount) {
    mount.appendChild(printBar('Print all handouts'));

    if (!ex.injects.length) {
      mount.appendChild(el('p', null, 'This configuration produced no inject handouts.'));
      return;
    }

    var intro = el('div', 'notice no-print');
    intro.appendChild(el('p', 'notice__head', 'How to use these'));
    intro.appendChild(el('p', null,
      'Each handout prints on its own page. Print, cut nothing, and deal them face down at the section noted on each one.'));
    mount.appendChild(intro);

    ex.injects.forEach(function (inject) {
      mount.appendChild(injectBlock(inject, true));
    });
  }

  /* -- after-action pack --------------------------------------------------- */

  function renderAar(ex, mount) {
    mount.appendChild(printBar('Print the after-action pack'));

    mount.appendChild(el('h2', 'aar__head', 'Hotwash'));
    if (ex.aar.hotwash.length) {
      var ol = el('ol', 'worksheet');
      ex.aar.hotwash.forEach(function (question) {
        var li = el('li');
        li.appendChild(el('p', 'worksheet__q', question));
        li.appendChild(el('div', 'worksheet__lines'));
        ol.appendChild(li);
      });
      mount.appendChild(ol);
    } else {
      mount.appendChild(el('p', null, 'This scenario defines no hotwash questions yet.'));
    }

    mount.appendChild(el('h2', 'aar__head', 'Objectives — met, partly met, not met'));
    if (ex.aar.objectives.length) {
      ex.aar.objectives.forEach(function (objective) {
        var row = el('div', 'objective');
        row.appendChild(el('span', 'objective__box'));
        row.appendChild(el('p', 'worksheet__q', objective));
        mount.appendChild(row);
      });
    } else {
      mount.appendChild(el('p', null, 'This scenario defines no objectives yet.'));
    }
  }

  /* -- tabs ---------------------------------------------------------------- */

  function wireTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[role="tab"]'));

    function show(target) {
      tabs.forEach(function (tab) {
        var panel = document.getElementById(tab.getAttribute('aria-controls'));
        var active = (tab === target);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        if (panel) { panel.hidden = !active; }
      });
      window.scrollTo(0, 0);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { show(tab); });
    });
  }

  /* -- failure ------------------------------------------------------------- */

  function fail(status, headline, detail) {
    status.className = 'notice';
    status.textContent = '';
    status.appendChild(el('p', 'notice__head', headline));
    status.appendChild(el('p', null, detail));
    var back = el('p');
    var link = el('a', null, 'Go back to the console');
    link.href = 'index.html';
    back.appendChild(link);
    status.appendChild(back);
  }

  /* -- boot ---------------------------------------------------------------- */

  function boot() {
    var status = document.getElementById('status');
    var sel = readSelections();

    /* Scenario ids come from the query string, so constrain them to a safe
       shape before they reach a URL — no slashes, no traversal. */
    if (!/^[a-z0-9-]{1,64}$/.test(sel.scenario)) {
      fail(status, 'That scenario id is not valid',
        'Scenario ids are lowercase letters, numbers and hyphens. Nothing was loaded.');
      return;
    }

    fetch('content/' + sel.scenario + '.json', { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) { throw new Error('HTTP ' + response.status); }
        return response.json();
      })
      .then(function (scenario) {
        var ex = TTX.assemble(scenario, sel);

        document.getElementById('head-title').textContent = ex.meta.title;
        document.getElementById('head-tagline').textContent = ex.meta.tagline;
        document.getElementById('head-kicker').textContent =
          ex.selections.duration + '-minute exercise · ' + ex.selections.difficultyLabel;
        document.title = ex.meta.title + ' — TTX Builder';

        renderGamebook(ex, document.getElementById('view-gamebook'));
        renderRoles(ex,    document.getElementById('view-roles'));
        renderInjects(ex,  document.getElementById('view-injects'));
        renderAar(ex,      document.getElementById('view-aar'));

        wireTabs();

        var deck = document.getElementById('deck');
        if (deck && window.TTXDeck) {
          deck.addEventListener('click', function () { window.TTXDeck.build(ex); });
        } else if (deck) {
          deck.disabled = true;
          deck.textContent = 'Deck export unavailable';
        }

        status.hidden = true;
      })
      .catch(function (error) {
        fail(status, 'That exercise could not be assembled',
          'The scenario file "content/' + sel.scenario + '.json" could not be loaded or parsed (' +
          error.message + ').');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
