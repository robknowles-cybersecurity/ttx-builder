/* ============================================================================
   TTX Builder — companion deck
   ----------------------------------------------------------------------------
   Builds a .pptx from the SAME assembled exercise object the HTML views render,
   so the deck can never drift from the gamebook. Uses pptxgenjs, vendored under
   /vendor (see THIRDPARTY.md) — no CDN, no network call at export time.

   Deck shape:
     1  title
     2  ground rules
     3  objectives
     n  one slide per section beat (decision points get their own treatment)
     z  hotwash closer

   Typeface note: the web design uses a Bookman-family display stack, but that
   face is not reliably installed with Office on either platform, and PowerPoint
   silently substitutes. Georgia ships with Office on Windows and macOS, so the
   deck uses Georgia throughout and accepts the small divergence from the site
   rather than shipping a deck that renders differently on every machine.
   ========================================================================== */
'use strict';

window.TTXDeck = (function () {

  var PAPER  = 'F4EAD6';
  var PAPER_LIT = 'FBF5E8';
  var INK    = '1D1815';
  var INK_SOFT = '4A4038';
  var SIGNAL = 'B0202A';
  var KNOCK  = 'FFFDF6';

  var SERIF = 'Georgia';

  /* Ground rules are a site-level default: the content schema does not carry
     them today. If the desk wants per-scenario rules, add a `ground_rules`
     array to the schema and prefer it over this list. */
  var GROUND_RULES = [
    'No-fault. We are testing the process, not the people in the room.',
    'Play the org you actually have, not the one in the policy document.',
    'If you do not have the authority, say so out loud. That is a finding, not a failure.',
    '"We would have to find out" is a legitimate answer. We will write down how long finding out takes.',
    'Decisions are made in the room and on the clock. Not offline, not after.',
    'What is said here informs the report. Nobody is quoted by name.'
  ];

  var KIND_LABEL = {
    narrative:  'NARRATIVE',
    inject:     'INJECT',
    discussion: 'DISCUSSION',
    decision:   'DECISION POINT',
    epilogue:   'CLOSE'
  };

  /* Slides are not documents. Trim long authored prose to the first beats and
     let the facilitator read the rest from the gamebook. */
  function condense(text, limit) {
    var flat = String(text || '').replace(/\s*\n+\s*/g, ' ').trim();
    if (flat.length <= limit) { return flat; }
    var cut = flat.slice(0, limit);
    var lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    if (lastStop > limit * 0.55) { return cut.slice(0, lastStop + 1); }
    return cut.replace(/\s+\S*$/, '') + '…';
  }

  function bullets(items, options) {
    return items.map(function (item) {
      return { text: item, options: Object.assign({ bullet: true, breakLine: true }, options || {}) };
    });
  }

  function build(ex) {
    if (typeof PptxGenJS !== 'function') {
      window.alert('The deck library did not load, so the deck cannot be built. The printable views are unaffected.');
      return;
    }

    var pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';           /* 13.33in x 7.5in */
    pptx.author = 'TTX Builder';
    pptx.company = ex.industry ? ex.industry.orgName : '';
    pptx.title = ex.meta.title;
    pptx.subject = 'Insider threat tabletop exercise';

    /* -- master: cream stock, red spine bar, slide numbers ----------------- */
    pptx.defineSlideMaster({
      title: 'TTX_BASE',
      background: { color: PAPER },
      objects: [
        { rect: { x: 0, y: 0, w: 0.22, h: '100%', fill: { color: SIGNAL } } },
        { rect: { x: 0, y: 7.16, w: '100%', h: 0.04, fill: { color: INK } } }
      ],
      slideNumber: { x: 12.7, y: 7.0, color: INK_SOFT, fontFace: SERIF, fontSize: 10 }
    });

    function contentSlide(kindLabel, headline) {
      var slide = pptx.addSlide({ masterName: 'TTX_BASE' });
      slide.addText(kindLabel, {
        x: 0.62, y: 0.42, w: 9, h: 0.3,
        fontFace: SERIF, fontSize: 11, bold: true, color: SIGNAL, charSpacing: 3
      });
      slide.addText(headline, {
        x: 0.62, y: 0.78, w: 12.1, h: 0.85,
        fontFace: SERIF, fontSize: 28, bold: true, color: INK
      });
      slide.addShape(pptx.ShapeType.line, {
        x: 0.62, y: 1.62, w: 3.2, h: 0,
        line: { color: SIGNAL, width: 2.5 }
      });
      return slide;
    }

    /* -- 1. title ---------------------------------------------------------- */
    var title = pptx.addSlide({ masterName: 'TTX_BASE' });
    title.addShape(pptx.ShapeType.rect, {
      x: 0.22, y: 1.55, w: 12.9, h: 2.75,
      fill: { color: SIGNAL }, line: { color: INK, width: 2 }
    });
    title.addText('AN INSIDER THREAT EXERCISE', {
      x: 0.5, y: 1.85, w: 12.3, h: 0.35,
      fontFace: SERIF, fontSize: 13, bold: true, color: KNOCK, align: 'center', charSpacing: 5
    });
    title.addText(ex.meta.title.toUpperCase(), {
      x: 0.5, y: 2.25, w: 12.3, h: 1.15,
      fontFace: SERIF, fontSize: 48, bold: true, color: KNOCK, align: 'center', charSpacing: 2
    });
    title.addText(ex.meta.tagline, {
      x: 0.9, y: 3.42, w: 11.5, h: 0.6,
      fontFace: SERIF, fontSize: 15, italic: true, color: KNOCK, align: 'center'
    });
    title.addText([
      ex.industry ? ex.industry.orgName : '',
      ex.selections.duration + ' minutes',
      ex.selections.difficultyLabel,
      ex.selections.maturityLabel
    ].filter(Boolean).join('   ·   '), {
      x: 0.5, y: 4.65, w: 12.3, h: 0.4,
      fontFace: SERIF, fontSize: 14, color: INK, align: 'center'
    });
    title.addText('At the table: ' + (ex.selections.roles.join(', ') || 'facilitator only'), {
      x: 1.2, y: 5.15, w: 10.9, h: 0.6,
      fontFace: SERIF, fontSize: 12, italic: true, color: INK_SOFT, align: 'center'
    });

    /* -- 2. ground rules --------------------------------------------------- */
    var rules = contentSlide('BEFORE WE START', 'Ground rules');
    rules.addText(bullets(GROUND_RULES), {
      x: 0.75, y: 1.95, w: 11.9, h: 4.9,
      fontFace: SERIF, fontSize: 17, color: INK, lineSpacingMultiple: 1.25
    });

    /* -- 3. objectives ----------------------------------------------------- */
    if (ex.aar.objectives.length) {
      var objectives = contentSlide('WHAT WE ARE TESTING', 'Objectives');
      objectives.addText(bullets(ex.aar.objectives), {
        x: 0.75, y: 1.95, w: 11.9, h: 4.9,
        fontFace: SERIF, fontSize: 16, color: INK, lineSpacingMultiple: 1.22
      });
    }

    /* -- 4. one slide per beat --------------------------------------------- */
    ex.sections.forEach(function (section) {
      var kind = KIND_LABEL[section.type] || 'SECTION';
      var slide = contentSlide('SECTION ' + section.num + '  ·  ' + kind,
                               section.type === 'decision' ? 'The room must decide'
                                                           : condense(section.body, 78));

      var cursorY = 1.95;

      /* Decision points earn the whole slide — this is the moment the room
         commits, and it is what the facilitator projects while they argue. */
      if (section.decision) {
        slide.addText(section.decision.prompt, {
          x: 0.75, y: cursorY, w: 11.9, h: 0.8,
          fontFace: SERIF, fontSize: 20, bold: true, color: INK
        });
        cursorY += 1.0;

        section.decision.options.forEach(function (opt) {
          slide.addShape(pptx.ShapeType.rect, {
            x: 0.75, y: cursorY, w: 11.9, h: 1.15,
            fill: { color: PAPER_LIT }, line: { color: INK, width: 1.5 }
          });
          slide.addText(opt.label, {
            x: 0.95, y: cursorY + 0.12, w: 9.4, h: 0.9,
            fontFace: SERIF, fontSize: 16, color: INK, valign: 'middle'
          });
          slide.addText('SECTION ' + (opt.gotoNum === null ? '—' : opt.gotoNum), {
            x: 10.5, y: cursorY + 0.3, w: 2.0, h: 0.55,
            fontFace: SERIF, fontSize: 15, bold: true, color: KNOCK, align: 'center',
            fill: { color: SIGNAL }, charSpacing: 1
          });
          cursorY += 1.35;
        });

        if (section.decision.collapsed) {
          slide.addText('Classic linear mode — alternative branches collapsed.', {
            x: 0.75, y: cursorY, w: 11.9, h: 0.4,
            fontFace: SERIF, fontSize: 12, italic: true, color: INK_SOFT
          });
        }
        return;
      }

      /* Inject beats show the artefact's header — the full text is on the
         printed handout, which is where the room should be reading it. */
      if (section.inject) {
        var header = [section.inject.from, section.inject.subject].filter(Boolean).join('  —  ');
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.75, y: cursorY, w: 11.9, h: 0.55,
          fill: { color: INK }, line: { color: INK, width: 1 }
        });
        slide.addText(header, {
          x: 0.95, y: cursorY + 0.05, w: 11.5, h: 0.45,
          fontFace: 'Courier New', fontSize: 12, color: KNOCK, valign: 'middle'
        });
        cursorY += 0.8;

        slide.addText(condense(section.inject.body, 520), {
          x: 0.75, y: cursorY, w: 11.9, h: 2.5,
          fontFace: 'Courier New', fontSize: 13, color: INK, lineSpacingMultiple: 1.15
        });
        cursorY += 2.7;
      } else {
        slide.addText(condense(section.body, 620), {
          x: 0.75, y: cursorY, w: 11.9, h: 2.9,
          fontFace: SERIF, fontSize: 16, color: INK, lineSpacingMultiple: 1.2
        });
        cursorY += 3.1;
      }

      /* Room-wide questions are the discussion prompt worth projecting. */
      var roomQuestions = section.questions.all.slice(0, 3);
      if (roomQuestions.length && cursorY < 5.9) {
        slide.addText('ASK THE ROOM', {
          x: 0.75, y: cursorY, w: 11.9, h: 0.3,
          fontFace: SERIF, fontSize: 11, bold: true, color: SIGNAL, charSpacing: 3
        });
        slide.addText(bullets(roomQuestions), {
          x: 0.75, y: cursorY + 0.35, w: 11.9, h: 6.9 - cursorY,
          fontFace: SERIF, fontSize: 14, color: INK_SOFT, lineSpacingMultiple: 1.15
        });
      }
    });

    /* -- 5. hotwash closer -------------------------------------------------- */
    var hotwash = contentSlide('STOP THE CLOCK', 'Hotwash');
    hotwash.addText(bullets(ex.aar.hotwash.length ? ex.aar.hotwash
                                                  : ['What would you change on Monday, and who owns it?']), {
      x: 0.75, y: 1.95, w: 11.9, h: 4.6,
      fontFace: SERIF, fontSize: 15, color: INK, lineSpacingMultiple: 1.18
    });

    var close = pptx.addSlide({ masterName: 'TTX_BASE' });
    close.addText('The findings are the deliverable.', {
      x: 0.8, y: 3.0, w: 11.9, h: 0.9,
      fontFace: SERIF, fontSize: 34, bold: true, color: INK, align: 'center'
    });
    close.addText('Everywhere the answer was “we would have to find out” — that is the list. Take it to Monday.', {
      x: 1.4, y: 3.95, w: 10.7, h: 0.9,
      fontFace: SERIF, fontSize: 16, italic: true, color: INK_SOFT, align: 'center'
    });

    var fileName = 'ttx-' + ex.meta.id + '-' + ex.selections.duration + 'min.pptx';
    return pptx.writeFile({ fileName: fileName }).catch(function (error) {
      window.alert('The deck could not be written: ' + error.message);
    });
  }

  return { build: build };

})();
