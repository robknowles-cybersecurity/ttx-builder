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
   not from a typical one. Re-measured against all four scenarios in content/
   on 2026-08-25, when scenarios 3 and 4 landed:
     option label   615 chars   (the-long-goodbye, decision 3)   was 392
     inject body   1754 chars   (the-long-goodbye, s21)          was 973
     narrative     2109 chars   (the-long-goodbye, s10)          was 1698
     question       364 chars   (the-approach, s-payroll, questions.all[1])
     inject header  193 chars   (dprk-hire, from + subject)
     prompt         103 chars   (the-approach, decision 2)
   A pptxgenjs text box does NOT clip: text longer than `h` spills out of the
   box and over whatever is underneath. Every box that renders authored prose
   therefore carries fit:'shrink' as a backstop, and prose is condensed to a
   character cap before it ever reaches a box.

   Caps and backstops are not enough on their own, and the 2026-08-25 pass
   replaced the remaining constants with measurement. Two rules now hold on
   every section slide:
     1. A box's height comes from an ESTIMATED line count (see estLines /
        estHeight), never from a literal.
     2. The cursor advances by what was actually placed, never by a constant
        stride. Constant strides were what left the ASK THE ROOM block 1.05in
        for 1.61in of text on every inject slide in the deck.
   Decision-option labels are the exception to the condense-first rule: they
   are placed whole and the point size steps down to make them fit, because the
   half of a label that a character cap eats is the half that states the cost.

   fit:'shrink' is present in the vendored build but is NOT a backstop you can
   rely on. vendor/pptxgen.bundle.js is PptxGenJS 4.0.1; it emits a bare
   <a:normAutofit/> for fit:'shrink' — with no fontScale attribute — and
   <a:spAutoFit/> for fit:'resize'. PowerPoint does not compute a scale for a
   bare normAutofit until the shape is next edited, so the shrink does not
   happen on first open, which is exactly when the deck is projected. Treat it
   as a repair for the second viewing only: the geometry above has to be right
   without it. Do not swap in an API from a different major version without
   re-reading the bundle.
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
     text is in the gamebook, which is where the facilitator reads from.

     Condensing alone was not enough. Six lines at 14pt is 1.61in, and the beat
     above was advancing the cursor by a CONSTANT stride rather than by what it
     had actually placed, so this block was handed 1.45in on a narrative beat
     and 1.05in on an inject beat. Both overran. The questions are now fitted
     against the space the beat really left, and any that do not fit are
     dropped with a count. */
  var QUESTION_CHARS = 180;

  /* Decision-option labels are the one place where condensing is the WRONG
     first move. The label is the thing the room votes on, and its second half
     is the "accept that…" clause that makes the vote a real trade — cutting it
     leaves a slide that shows the action and hides the cost.

     Labels are placed raw today and run to 615 characters (the-long-goodbye,
     decision 3), which is ~7 lines at 14pt in the 9.35in card column: 1.63in
     of text in a 1.35in box. It overflows through the card's own border and
     into the card beneath, which is the "boxes step on text" report.

     So: place the label whole, and buy the space by stepping the point size
     down instead. 615 characters is 6 lines at 13pt, which fits a two-option
     card with room to spare. Condensing is the last resort, reached only when
     even OPTION_MIN_PT cannot hold the label — a four-option decision, which
     no scenario carries today. Below 10pt a projected slide is unreadable
     anyway, so that is where the ladder stops. */
  var OPTION_MIN_PT = 10;

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

  /* -- text metrics ---------------------------------------------------------
     pptxgenjs cannot measure text and a PowerPoint text box does not clip, so
     anything taller than `h` renders on top of whatever is beneath it. Every
     box on a section slide is therefore sized from an ESTIMATED line count,
     and the cursor advances by what was actually placed rather than by a
     constant stride. Constant strides are what put the question block below
     the footer rule.

     CHAR_EM is the average advance of a character as a fraction of the font
     size. Courier New is monospaced at exactly 0.60em. Georgia's lowercase
     prose average is about 0.48em and is rounded UP to 0.50 so the estimate
     errs toward allocating too much room rather than too little.

     Line pitch follows OOXML: a spcPct line-spacing multiple scales the single
     line height, which PowerPoint takes as 1.2x the font size.

     fit:'shrink' stays on every prose box, but it is a backstop and not the
     fix. PptxGenJS 4.0.1 emits a bare <a:normAutofit/> with no fontScale
     attribute, so PowerPoint does not compute a scale until the shape is next
     edited: on first open — which is exactly when the deck is projected — the
     text renders at the authored size. The geometry has to be right without
     it. */

  var CHAR_EM = { 'Georgia': 0.50, 'Courier New': 0.60 };

  /* pptxgenjs' default bullet indent plus the glyph, taken off the usable
     column width before any bulleted list is measured. */
  var BULLET_INDENT = 0.40;

  function estLines(text, widthIn, fontSize, face) {
    var em = CHAR_EM[face] || 0.52;
    var perLine = Math.max(1, Math.floor(widthIn / (fontSize * em / 72)));
    var count = 0;
    String(text || '').split('\n').forEach(function (para) {
      count += Math.max(1, Math.ceil(para.length / perLine));
    });
    return Math.max(1, count);
  }

  function estHeight(lines, fontSize, mult) {
    return lines * fontSize * 1.2 * (mult || 1) / 72;
  }

  /* Height a bulleted list of authored strings needs at a given point size.
     PARA_PAD is the small gap PowerPoint leaves between bulleted paragraphs;
     it is not in the OOXML we emit, but it shows up on screen and three of
     them is a quarter of an inch. */
  var PARA_PAD = 0.06;

  function listHeight(items, widthIn, fontSize, mult, face) {
    return items.reduce(function (total, item) {
      return total + estHeight(estLines(item, widthIn - BULLET_INDENT, fontSize, face), fontSize, mult) + PARA_PAD;
    }, 0);
  }

  /* Ground rules, objectives and hotwash are whole-slide bulleted lists in a
     box already sized to CONTENT_BOTTOM, so they cannot be given more room —
     the only safe lever is point size. Step it down until the list fits, then
     place it. With the content in content/ today nothing steps below its
     authored size; this exists so that a longer AAR cannot silently print
     through the footer rule. */
  function fitBulletList(slide, items, opts) {
    var size = opts.fontSize;
    while (size > opts.minSize && listHeight(items, opts.w, size, opts.lineSpacingMultiple, SERIF) > opts.h) {
      size -= 1;
    }
    slide.addText(bullets(items), {
      x: opts.x, y: opts.y, w: opts.w, h: opts.h,
      fontFace: SERIF, fontSize: size, color: opts.color,
      lineSpacingMultiple: opts.lineSpacingMultiple, valign: 'top', fit: 'shrink'
    });
  }

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
    fitBulletList(rules, GROUND_RULES, {
      x: 0.75, y: 1.95, w: 11.9, h: CONTENT_BOTTOM - 1.95,
      fontSize: 17, minSize: 12, color: INK, lineSpacingMultiple: 1.25
    });

    /* -- 3. objectives ----------------------------------------------------- */
    if (ex.aar.objectives.length) {
      var objectives = contentSlide('WHAT WE ARE TESTING', 'Objectives');
      fitBulletList(objectives, ex.aar.objectives, {
        x: 0.75, y: 1.95, w: 11.9, h: CONTENT_BOTTOM - 1.95,
        fontSize: 16, minSize: 11, color: INK, lineSpacingMultiple: 1.22
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
        /* Prompts run to 103 characters, which is two lines at 20pt. Size the
           box from the line count so a longer prompt cannot reach into the
           first option card. */
        var promptH = Math.max(0.6, estHeight(estLines(section.decision.prompt, 11.9, 20, SERIF), 20, 1) + 0.12);
        slide.addText(section.decision.prompt, {
          x: 0.75, y: cursorY, w: 11.9, h: promptH,
          fontFace: SERIF, fontSize: 20, bold: true, color: INK, valign: 'top', fit: 'shrink'
        });
        cursorY += promptH + 0.20;

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

        /* Label point size follows the card, then steps down until the LONGEST
           label on this slide actually fits the card's text box. The old
           ladder was chosen from the card height alone and never looked at the
           text, so a 615-character label sat 1.63in of prose in a 1.35in box
           and printed through the border. */
        var labelBox = cardH - 0.20;
        var labelTexts = shown.map(function (opt) { return String(opt.label || ''); });

        var worstLabelH = function (texts, pt) {
          return texts.reduce(function (m, t) {
            return Math.max(m, estHeight(estLines(t, 9.35, pt, SERIF), pt, 1));
          }, 0);
        };

        var labelSize = cardH >= 1.3 ? 14 : (cardH >= 1.0 ? 12 : 11);
        while (labelSize > OPTION_MIN_PT && worstLabelH(labelTexts, labelSize) > labelBox) {
          labelSize -= 1;
        }

        /* Only if the floor of the ladder still overflows — a four-option
           decision with long labels — fall back to condensing, and condense to
           exactly what this point size can hold rather than to a guess. */
        if (worstLabelH(labelTexts, labelSize) > labelBox) {
          var labelPerLine = Math.max(1, Math.floor(9.35 / (labelSize * CHAR_EM[SERIF] / 72)));
          var labelFitLines = Math.max(1, Math.floor(labelBox / (labelSize * 1.2 / 72)));
          labelTexts = labelTexts.map(function (t) {
            return condense(t, labelPerLine * labelFitLines);
          });
        }

        shown.forEach(function (opt, optIndex) {
          slide.addShape(pptx.ShapeType.rect, {
            x: 0.75, y: cursorY, w: 11.9, h: cardH,
            fill: { color: PAPER_LIT }, line: { color: INK, width: 1.5 }
          });
          slide.addText(labelTexts[optIndex], {
            x: 0.95, y: cursorY + 0.10, w: 9.35, h: labelBox,
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
        /* from + subject runs to 193 characters (dprk-hire), which is two
           lines of Courier 12pt in an 11.5in column — 0.46in of text in a
           0.45in box inside a 0.55in bar. The knocked-out white text spilled
           below the black bar onto cream stock and became unreadable. Size the
           bar from the line count, and cap the header at what two lines hold
           so a third can never appear. */
        var HEADER_LINES_MAX = 2;
        var headerPerLine = Math.floor(11.5 / (12 * CHAR_EM['Courier New'] / 72));
        var header = condense(
          [section.inject.from, section.inject.subject].filter(Boolean).join('  —  '),
          HEADER_LINES_MAX * headerPerLine
        );
        var headerH = estHeight(
          Math.min(HEADER_LINES_MAX, estLines(header, 11.5, 12, 'Courier New')), 12, 1.15
        );
        var barH = Math.max(0.55, headerH + 0.18);

        slide.addShape(pptx.ShapeType.rect, {
          x: 0.75, y: cursorY, w: 11.9, h: barH,
          fill: { color: INK }, line: { color: INK, width: 1 }
        });
        slide.addText(header, {
          x: 0.95, y: cursorY + 0.05, w: 11.5, h: barH - 0.10,
          fontFace: 'Courier New', fontSize: 12, color: KNOCK, valign: 'middle', fit: 'shrink'
        });
        cursorY += barH + 0.16;

        /* Was a fixed 2.5in box on a fixed 2.7in stride. 520 condensed
           characters of Courier 13pt is five lines — 1.25in — so the stride
           spent an inch of slide on nothing and then handed the question block
           1.05in for six lines of 14pt. Size from the text, advance by what
           was placed, and clamp so the box itself can never reach the rule. */
        var injectText = condense(section.inject.body, 520);
        var injectH = Math.min(
          estHeight(estLines(injectText, 11.9, 13, 'Courier New'), 13, 1.15) + 0.10,
          CONTENT_BOTTOM - cursorY
        );
        slide.addText(injectText, {
          x: 0.75, y: cursorY, w: 11.9, h: injectH,
          fontFace: 'Courier New', fontSize: 13, color: INK, lineSpacingMultiple: 1.15,
          valign: 'top', fit: 'shrink'
        });
        cursorY += injectH + 0.20;
      } else {
        /* Same defect on the narrative path: a fixed 2.9in box on a fixed
           3.1in stride, where 620 condensed characters of Georgia 16pt is six
           lines, or 1.92in. */
        var bodyText = condense(section.body, 620);
        var bodyH = Math.min(
          estHeight(estLines(bodyText, 11.9, 16, SERIF), 16, 1.2) + 0.10,
          CONTENT_BOTTOM - cursorY
        );
        slide.addText(bodyText, {
          x: 0.75, y: cursorY, w: 11.9, h: bodyH,
          fontFace: SERIF, fontSize: 16, color: INK, lineSpacingMultiple: 1.2,
          valign: 'top', fit: 'shrink'
        });
        cursorY += bodyH + 0.20;
      }

      /* Room-wide questions are the discussion prompt worth projecting.

         The box height was already correct arithmetic — CONTENT_BOTTOM minus
         the box's own y — but a correct box is not a correct fit: the text is
         what overflows, and three condensed questions are ~1.61in of it. The
         old `cursorY < 5.55` guard was a proxy for "is there room", tuned
         against a stride that no longer exists. Fit the questions instead, and
         say how many were left behind. */
      var QUESTION_TOP_GAP = 0.35;
      var NOTE_H = 0.30;
      var allQuestions = section.questions.all;
      var qAvail = CONTENT_BOTTOM - (cursorY + QUESTION_TOP_GAP);

      if (allQuestions.length && qAvail >= 0.45) {
        /* Always reserve the note line. It costs at most one question on a
           cramped slide and it removes any chance of the note landing on top
           of the last bullet. */
        var qBudget = qAvail - NOTE_H;
        var roomQuestions = [];
        var qUsed = 0;

        allQuestions.forEach(function (q) {
          if (roomQuestions.length >= 3) { return; }
          var text = condense(q, QUESTION_CHARS);
          var qh = estHeight(estLines(text, 11.9 - BULLET_INDENT, 14, SERIF), 14, 1.15) + PARA_PAD;
          if (qUsed + qh <= qBudget) {
            roomQuestions.push(text);
            qUsed += qh;
          }
        });

        if (roomQuestions.length) {
          slide.addText('ASK THE ROOM', {
            x: 0.75, y: cursorY, w: 11.9, h: 0.3,
            fontFace: SERIF, fontSize: 11, bold: true, color: SIGNAL, charSpacing: 3
          });
          slide.addText(bullets(roomQuestions), {
            x: 0.75, y: cursorY + QUESTION_TOP_GAP, w: 11.9, h: qUsed,
            fontFace: SERIF, fontSize: 14, color: INK_SOFT, lineSpacingMultiple: 1.15,
            valign: 'top', fit: 'shrink'
          });

          var leftBehind = allQuestions.length - roomQuestions.length;
          if (leftBehind > 0) {
            slide.addText(leftBehind + ' more in the gamebook.', {
              x: 0.75, y: Math.min(cursorY + QUESTION_TOP_GAP + qUsed, CONTENT_BOTTOM - NOTE_H),
              w: 11.9, h: NOTE_H,
              fontFace: SERIF, fontSize: 11, italic: true, color: INK_SOFT, fit: 'shrink'
            });
          }
        }
      }
    });

    /* -- 5. hotwash closer -------------------------------------------------- */
    var hotwash = contentSlide('STOP THE CLOCK', 'Hotwash');
    fitBulletList(hotwash, ex.aar.hotwash.length
                             ? ex.aar.hotwash
                             : ['What would you change on Monday, and who owns it?'], {
      x: 0.75, y: 1.95, w: 11.9, h: CONTENT_BOTTOM - 1.95,
      fontSize: 15, minSize: 10, color: INK, lineSpacingMultiple: 1.18
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
