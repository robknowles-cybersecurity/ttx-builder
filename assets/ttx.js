/* ============================================================================
   TTX Builder — config screen
   ----------------------------------------------------------------------------
   Reads the six dials plus the linear toggle, encodes them into a query string,
   and hands off to exercise.html. Nothing is stored and nothing is sent
   anywhere; the query string IS the saved state, which means a facilitator can
   bookmark or email a configured exercise.

   Query contract (kept short so the URL stays mailable):
     s = scenario id      i = industry key     m = maturity
     d = duration         x = difficulty       l = 1 for classic linear
     r = comma-separated role ids
   ========================================================================== */
'use strict';

(function () {

  var form = document.getElementById('console');
  if (!form) { return; }

  /* JS is clearly running, so retire the no-JS notice. */
  var note = document.getElementById('nojs-note');
  if (note) { note.hidden = true; }

  function checkedValue(name, fallback) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : fallback;
  }

  function checkedList(name) {
    var els = form.querySelectorAll('input[name="' + name + '"]:checked');
    return Array.prototype.map.call(els, function (el) { return el.value; });
  }

  function warn(message) {
    var existing = document.getElementById('console-warning');
    if (existing) { existing.parentNode.removeChild(existing); }

    var box = document.createElement('div');
    box.className = 'notice';
    box.id = 'console-warning';

    var head = document.createElement('p');
    head.className = 'notice__head';
    head.textContent = 'Hold on';
    box.appendChild(head);

    var body = document.createElement('p');
    body.textContent = message;
    box.appendChild(body);

    var actions = form.querySelector('.actions');
    form.insertBefore(box, actions);
    box.scrollIntoView({ block: 'center' });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var roles = checkedList('roles');
    if (!roles.length) {
      warn('Pick at least one seat for the table. An exercise with nobody in it is just a document.');
      return;
    }

    var params = [
      ['s', checkedValue('scenario', 'dprk-hire')],
      ['i', checkedValue('industry', 'finserv')],
      ['m', checkedValue('maturity', 'formal')],
      ['d', checkedValue('duration', '90')],
      ['x', checkedValue('difficulty', 'standard')],
      ['l', form.querySelector('#linear').checked ? '1' : '0'],
      ['r', roles.join(',')]
    ];

    var query = params.map(function (pair) {
      return encodeURIComponent(pair[0]) + '=' + encodeURIComponent(pair[1]);
    }).join('&');

    window.location.href = 'exercise.html?' + query;
  });

})();
