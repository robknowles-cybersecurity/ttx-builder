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

   LAYOUT CONTRACT (2026-08-21) — read this before changing any x/y/w/h.
   ----------------------------------------------------------------------------
   The slide is 13.33in x 7.5in. The master paints a footer rule at y=7.16 and
   a slide-number field at y=7.00. Nothing this file draws may cross y=6.85.
   That is what CONTENT_BOTTOM is for; use it instead of a literal.

   Boxes here are sized from the LONGEST string the content schema can produce,
   not from a typical one. Measured against content/ on 2026-08-21:
     option label   392 chars   (the-approach, decision 3, "CONTROLLED CONTINUATION")
     question       364 chars   (the-approach, s-payroll, questions.all[1])
     prompt         103 chars   (the-approach, decision 2)
   A pptxgenjs text box does NOT clip: text longer than `h` spills out of the
   box and over whatever is underneath. Every box that renders authored prose
   therefore carries fit:'shrink' as a backstop, and prose is condensed to a
   character cap before it ever reaches a box.

   fit:'shrink' is verified present in the vendored build. vendor/
   pptxgen.bundle.js is PptxGenJS 4.0.1 and emits <a:normAutofit/> for
   fit:'shrink' and <a:spAutoFit/> for fit:'resize'. Do not swap in an API from
   a different major version without re-reading the bundle.
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

  /* The lowest y any content box may reach. The master's footer rule sits at
     7.16 and the slide-number field at 7.00; crossing either is the bug this
     constant exists to prevent. */
  var CONTENT_BOTTOM = 6.85;

  /* Headline cap. At 26pt Georgia bold in a 12.1in column roughly 64 characters
     fit on one line, so this keeps the beat headline to a single line in the
     common case and lets fit:'shrink' handle the rest. It was 78, which was
     reliably two lines — 0.93in of text in a 0.85in box — and the second line
     crossed the red rule at y=1.62 on essentially every narrative slide. */
  var HEADLINE_CHARS = 64;

  /* Room-question cap. Three questions of the length this schema actually
     carries (up to 364 chars) is ~8 lines, which overran the box and the footer
     rule. Condensing each to 180 keeps three questions at ~6 lines. The full
     text is in the gamebook, which is where the facilitator reads from. */
  var QUESTION_CHARS = 180;

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
      /* Ends at 1.54, clear of the red rule at 1.62. Two lines at 26pt is
         0.87in, so a headline that still wraps is shrunk rather than allowed
         to cross the rule. */
      slide.addText(headline, {
        x: 0.62, y: 0.76, w: 12.1, h: 0.78,
        fontFace: SERIF, fontSize: 26, bold: true, color: INK,
        valign: 'top', fit: 'shrink'
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
    /* Today's scenario titles are short ("The Approach", "The New Hire") and
       fit on one line at 48pt. fit:'shrink' is insurance against a future
       scenario whose title wraps: two lines at 48pt is 1.6in in a 1.15in box,
       which would push the second line down onto the tagline at 3.42. */
    title.addText(ex.meta.title.toUpperCase(), {
      x: 0.5, y: 2.25, w: 12.3, h: 1.15,
      fontFace: SERIF, fontSize: 48, bold: true, color: KNOCK, align: 'center', charSpacing: 2,
      valign: 'middle', fit: 'shrink'
    });
    title.addText(ex.meta.tagline, {
      x: 0.9, y: 3.42, w: 11.5, h: 0.6,
      fontFace: SERIF, fontSize: 15, italic: true, color: KNOCK, align: 'center',
      valign: 'middle', fit: 'shrink'
    });
    title.addText([
      ex.industry ? ex.industry.orgName : '',
      ex.selections.duration + ' minutes',
      ex.selections.difficultyLabel,
      ex.selections.maturityLabel
    ].filter(Boolean).join('   ·   '), {
      x: 0.5, y: 4.65, w: 12.3, h: 0.4,
      fontFace: SERIF, fontSize: 14, color: INK, align: 'center', fit: 'shrink'
    });
    title.addText('At the table: ' + (ex.selections.roles.join(', ') || 'facilitator only'), {
      x: 1.2, y: 5.15, w: 10.9, h: 0.6,
      fontFace: SERIF, fontSize: 12, italic: true, color: INK_SOFT, align: 'center', fit: 'shrink'
    });

    /* -- 2. ground rules --------------------------------------------------- */
    var rules = contentSlide('BEFORE WE START', 'Ground rules');
    rules.addText(bullets(GROUND_RULES), {
      x: 0.75, y: 1.95, w: 11.9, h: CONTENT_BOTTOM - 1.95,
      fontFace: SERIF, fontSize: 17, color: INK, lineSpacingMultiple: 1.25, fit: 'shrink'
    });

    /* -- 3. objectives ----------------------------------------------------- */
    if (ex.aar.objectives.length) {
      var objectives = contentSlide('WHAT WE ARE TESTING', 'Objectives');
      objectives.addText(bullets(ex.aar.objectives), {
        x: 0.75, y: 1.95, w: 11.9, h: CONTENT_BOTTOM - 1.95,
        fontFace: SERIF, fontSize: 16, color: INK, lineSpacingMultiple: 1.22, fit: 'shrink'
      });
    }

    /* -- 4. one slide per beat --------------------------------------------- */
    ex.sections.forEach(function (section) {
      var kind = KIND_LABEL[section.type] || 'SECTION';
      var slide = contentSlide('SECTION ' + section.num + '  ·  ' + kind,
                               section.type === 'decision' ? 'The room must decide'
                                                           : condense(section.body, HEADLINE_CHARS));

      var cursorY = 1.95;

      /* Decision points earn the whole slide — this is the moment the room
         commits, and it is what the facilitator projects while they argue. */
      if (section.decision) {
        slide.addText(section.decision.prompt, {
          x: 0.75, y: cursorY, w: 11.9, h: 0.8,
          fontFace: SERIF, fontSize: 20, bold: true, color: INK, valign: 'top', fit: 'shrink'
        });
        cursorY += 1.0;

        /* Option cards are sized from the space that is actually left, not from
           a constant. The old code used a fixed 1.15in card on a fixed 1.35in
           stride: option labels in this schema run to 392 characters, which is
           ~5 lines at 16pt in a 9.4in column — 1.33in of text in a 0.9in box.
           The overflow rendered straight through the card's own border, which
           is the "boxes step on text" report. Four options also walked the
           stack off the bottom of the slide (the fourth card started at 7.00).

           Now: cards divide the remaining space, never exceed MAX_CARD, and the
           stack is capped so it cannot pass CONTENT_BOTTOM. */
        var MAX_CARD = 1.55;
        var GAP = 0.18;
        var MAX_CARDS = 4;

        var allOptions = section.decision.options;
        var shown = allOptions.slice(0, MAX_CARDS);
        var hidden = allOptions.length - shown.length;

        /* Reserve a line for the overflow/collapsed note when one is coming. */
        var noteH = (hidden > 0 || section.decision.collapsed) ? 0.45 : 0;
        var avail = (CONTENT_BOTTOM - noteH) - cursorY;
        var cardH = Math.min(MAX_CARD, (avail - GAP * (shown.length - 1)) / shown.length);

        /* Label point size follows the card. fit:'shrink' is still the backstop
           for the 392-character worst case. */
        var labelSize = cardH >= 1.3 ? 14 : (cardH >= 1.0 ? 12 : 11);

        shown.forEach(function (opt) {
          slide.addShape(pptx.ShapeType.rect, {
            x: 0.75, y: cursorY, w: 11.9, h: cardH,
            fill: { color: PAPER_LIT }, line: { color: INK, width: 1.5 }
          });
          slide.addText(opt.label, {
            x: 0.95, y: cursorY + 0.10, w: 9.35, h: cardH - 0.20,
            fontFace: SERIF, fontSize: labelSize, color: INK,
            valign: 'middle', fit: 'shrink'
          });
          slide.addText('SECTION ' + (opt.gotoNum === null ? '—' : opt.gotoNum), {
            x: 10.5, y: cursorY + (cardH - 0.55) / 2, w: 2.0, h: 0.55,
            fontFace: SERIF, fontSize: 15, bold: true, color: KNOCK, align: 'center',
            fill: { color: SIGNAL }, charSpacing: 1, valign: 'middle'
          });
          cursorY += cardH + GAP;
        });

        var notes = [];
        if (hidden > 0) {
          notes.push(hidden + ' further option' + (hidden === 1 ? '' : 's') + ' in the gamebook.');
        }
        if (section.decision.collapsed) {
          notes.push('Classic linear mode — alternative branches collapsed.');
        }
        if (notes.length) {
          /* Clamped: with a full stack cursorY can land past the rule, and the
             old code wrote this line at whatever y the loop left behind. */
          slide.addText(notes.join(' '), {
            x: 0.75, y: Math.min(cursorY, CONTENT_BOTTOM - 0.4), w: 11.9, h: 0.4,
            fontFace: SERIF, fontSize: 12, italic: true, color: INK_SOFT, fit: 'shrink'
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
          fontFace: 'Courier New', fontSize: 12, color: KNOCK, valign: 'middle', fit: 'shrink'
        });
        cursorY += 0.8;

        slide.addText(condense(section.inject.body, 520), {
          x: 0.75, y: cursorY, w: 11.9, h: 2.5,
          fontFace: 'Courier New', fontSize: 13, color: INK, lineSpacingMultiple: 1.15,
          valign: 'top', fit: 'shrink'
        });
        cursorY += 2.7;
      } else {
        slide.addText(condense(section.body, 620), {
          x: 0.75, y: cursorY, w: 11.9, h: 2.9,
          fontFace: SERIF, fontSize: 16, color: INK, lineSpacingMultiple: 1.2,
          valign: 'top', fit: 'shrink'
        });
        cursorY += 3.1;
      }

      /* Room-wide questions are the discussion prompt worth projecting. */
      var roomQuestions = section.questions.all.slice(0, 3).map(function (q) {
        return condense(q, QUESTION_CHARS);
      });
      /* The guard was cursorY < 5.9, which left as little as 0.6in for a label
         plus three bullets. 5.55 guarantees at least ~0.95in of bullet space. */
      if (roomQuestions.length && cursorY < 5.55) {
        slide.addText('ASK THE ROOM', {
          x: 0.75, y: cursorY, w: 11.9, h: 0.3,
          fontFace: SERIF, fontSize: 11, bold: true, color: SIGNAL, charSpacing: 3
        });
        /* h was `6.9 - cursorY` on a box whose y is `cursorY + 0.35`, so the
           box bottom evaluated to 7.25 for every value of cursorY — through the
           master's footer rule at 7.16 and across the slide-number field at
           7.00. It is a height, not a bottom coordinate. */
        slide.addText(bullets(roomQuestions), {
          x: 0.75, y: cursorY + 0.35, w: 11.9, h: CONTENT_BOTTOM - (cursorY + 0.35),
          fontFace: SERIF, fontSize: 14, color: INK_SOFT, lineSpacingMultiple: 1.15,
          valign: 'top', fit: 'shrink'
        });
      }
    });

    /* -- 5. hotwash closer -------------------------------------------------- */
    var hotwash = contentSlide('STOP THE CLOCK', 'Hotwash');
    hotwash.addText(bullets(ex.aar.hotwash.length ? ex.aar.hotwash
                                                  : ['What would you change on Monday, and who owns it?']), {
      x: 0.75, y: 1.95, w: 11.9, h: CONTENT_BOTTOM - 1.95,
      fontFace: SERIF, fontSize: 15, color: INK, lineSpacingMultiple: 1.18, fit: 'shrink'
    });

    var close = pptx.addSlide({ masterName: 'TTX_BASE' });
    close.addText('The findings are the deliverable.', {
      x: 0.8, y: 3.0, w: 11.9, h: 0.9,
      fontFace: SERIF, fontSize: 34, bold: true, color: INK, align: 'center',
      valign: 'middle', fit: 'shrink'
    });
    close.addText('Everywhere the answer was “we would have to find out” — that is the list. Take it to Monday.', {
      x: 1.4, y: 3.95, w: 10.7, h: 0.9,
      fontFace: SERIF, fontSize: 16, italic: true, color: INK_SOFT, align: 'center',
      valign: 'middle', fit: 'shrink'
    });

    var fileName = 'ttx-' + ex.meta.id + '-' + ex.selections.duration + 'min.pptx';
    return pptx.writeFile({ fileName: fileName }).catch(function (error) {
      window.alert('The deck could not be written: ' + error.message);
    });
  }

  return { build: build };

})();
