/* The Josty — page renderer. Text, headlines, photographs. No build step. */
(function () {
  'use strict';

  var D = window.EDITION;
  var pageEl = document.getElementById('page');
  if (!D) { pageEl.innerHTML = '<p>The presses have stopped: no edition data found.</p>'; return; }

  var MH = D.masthead;
  var prevBtn = document.getElementById('prev');
  var nextBtn = document.getElementById('next');
  var dotsEl = document.getElementById('dots');
  var selectEl = document.getElementById('jump');
  var counterEl = document.getElementById('counter');
  var footPage = document.getElementById('foot-page');
  var footTotal = document.getElementById('foot-total');

  document.getElementById('dateline-date').textContent = MH.place + ', ' + MH.date;
  document.getElementById('dateline-edition').textContent = MH.volume + ' \u2014 ' + MH.issue;
  document.getElementById('m-volume').textContent = MH.volume;
  document.getElementById('m-price').textContent = MH.price;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function shown(s) {
    return esc(s).replace(/\$/g, '<span class="currency">$</span>');
  }
  function j(a) { return a.join(''); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  function paras(list, drop, pull, pullAt) {
    var out = [];
    (list || []).forEach(function (p, i) {
      out.push('<p' + (drop && i === 0 ? ' class="first"' : '') + '>' + esc(p) + '</p>');
      if (pull && i === pullAt) out.push(pull);
    });
    if (pull && pullAt < 0) out.unshift(pull);
    return j(out);
  }
  function pullQuote(s) {
    if (!s.pullquote) return '';
    return '<blockquote class="pull"><p>' + esc(s.pullquote) + '</p>' +
      (s.pullquote_by ? '<cite>' + esc(s.pullquote_by) + '</cite>' : '') + '</blockquote>';
  }
  // How wide the slot is, so the browser can pick a variant instead of always
  // taking the largest. The desk is 1180px with up to 54px of padding, so a
  // full-width figure tops out at 1072px; the front page's two-up grid halves it.
  var SIZE_FULL = '(max-width: 1270px) 92vw, 1072px';
  var SIZE_HALF = '(max-width: 700px) 92vw, (max-width: 1270px) 46vw, 520px';

  function figure(s, priority, sizes) {
    if (!s.photo) return '';
    var ph = s.photo;
    // Intrinsic dimensions let the browser reserve the box before the file
    // arrives; without them every photograph shifts the column under the reader.
    var dims = (ph.w && ph.h) ? ' width="' + ph.w + '" height="' + ph.h + '"' : '';
    // The lead photograph is what sets the largest paint, so it is fetched first;
    // everything below the fold is told to wait its turn rather than competing
    // for the same connection.
    var load = priority
      ? ' loading="eager" fetchpriority="high" decoding="async"'
      : ' loading="lazy" fetchpriority="low" decoding="async"';
    var img = '<img src="' + esc(ph.src) + '" alt="' + esc(s.caption || '') + '"' +
      dims + load + '>';
    var markup = img;
    if (ph.webp) {
      markup = '<picture><source type="image/webp" srcset="' + esc(ph.webp) +
        '" sizes="' + esc(sizes || SIZE_FULL) + '">' + img + '</picture>';
    }
    return '<figure class="photo">' + markup +
      '<figcaption><span class="cap">' + esc(s.caption || '') + '</span>' +
      '<span class="credit">' + esc(ph.credit) + '</span></figcaption></figure>';
  }
  function byline(s) {
    return '<div class="byline">' + esc(s.byline || 'By The Ledger Staff') +
      (s.dateline ? '<span class="dateline-inline">' + esc(s.dateline) + '</span>' : '') + '</div>';
  }
  function story(s, opts) {
    opts = opts || {};
    var lead = !!opts.lead;
    var body = s.body || [];
    var pull = pullQuote(s);
    var pullAt = pull ? Math.min(1, Math.max(0, body.length - 2)) : -1;
    var kick = opts.kicker || s.kicker;
    var h = ['<article class="story' + (lead ? ' lead' : '') + '" id="' + esc(s.id) + '">'];
    if (kick) h.push('<div class="kicker">' + esc(kick) + '</div>');
    h.push('<h2 class="headline ' + (lead ? 'hl-lead' : 'hl-a') + '">' + shown(s.headline) + '</h2>');
    if (s.deck) h.push('<p class="deck">' + shown(s.deck) + '</p>');
    h.push(byline(s));
    h.push(figure(s, lead, opts.sizes));
    h.push('<div class="body' + (lead ? ' drop' : ' two') + '">' + paras(body, lead, pull, pullAt) + '</div>');
    h.push('</article>');
    return h.join('');
  }
  function briefs(items, title) {
    if (!items || !items.length) return '';
    var h = ['<section class="briefs"><h3 class="briefs-head">' + esc(title || 'News in Brief') + '</h3>'];
    h.push('<div class="brief-grid">');
    items.forEach(function (b) {
      h.push('<article class="brief"><h4>' + esc(b.headline) + '</h4>' +
        j((b.body || []).map(function (p) { return '<p>' + esc(p) + '</p>'; })) +
        '</article>');
    });
    h.push('</div></section>');
    return h.join('');
  }
  function settleBox(items) {
    if (!items || !items.length) return '';
    var h = ['<section class="settle"><h3 class="settle-head">What Would Settle It</h3>'];
    h.push('<div class="settle-grid">');
    items.forEach(function (it) {
      h.push('<div class="settle-item"><span class="settle-label">' + esc(it.label) + '</span>' +
        '<p>' + esc(it.question) + '</p></div>');
    });
    h.push('</div></section>');
    return h.join('');
  }
  function numbersStrip(items) {
    if (!items || !items.length) return '';
    var h = ['<section class="numbers"><h3 class="numbers-head">Numbers on the Record</h3>'];
    h.push('<table class="numbers-table"><tbody>');
    items.forEach(function (n) {
      h.push('<tr><td class="n-fig">' + shown(n.figure) + '</td>' +
        '<td class="n-what">' + esc(n.measures) + '</td>' +
        '<td class="n-status">' + esc(n.status) + '</td></tr>');
    });
    h.push('</tbody></table></section>');
    return h.join('');
  }
  function pageHead(section, folio) {
    return '<div class="page-head"><span class="section">' + esc(section) +
      '</span><span class="folio">' + esc(folio) + '</span></div>';
  }
  function insideStrip() {
    var items = D.sections.map(function (s, i) { return s.name + ' ' + (i + 2); });
    return '<p class="inside"><b>Inside:</b> ' + esc(items.join(' \u00b7 ')) +
      ' \u00b7 Sources ' + (D.sections.length + 2) + '</p>';
  }

  function renderFront() {
    var h = [pageHead('Front Page', MH.date)];
    h.push(story(D.front[0], { lead: true, kicker: 'Special Report' }));
    h.push('<div class="rule-fat"></div>');
    h.push('<div class="front-grid">');
    D.front.slice(1).forEach(function (s) {
      h.push('<div class="front-item">' + story(s, { sizes: SIZE_HALF }) + '</div>');
    });
    h.push('</div>');
    h.push(settleBox(D.settle));
    h.push(briefs(D.frontBriefs, 'News in Brief'));
    h.push(insideStrip());
    return h.join('');
  }

  function renderSection(sec) {
    var h = [pageHead(sec.name, MH.date)];
    h.push('<div class="section-flag"><h2>' + esc(sec.name) + '</h2><p>' + esc(sec.standfirst) + '</p></div>');
    h.push(story(sec.stories[0], { lead: true }));
    sec.stories.slice(1).forEach(function (s) {
      h.push('<hr class="rule-thin">');
      h.push(story(s, {}));
    });
    h.push(numbersStrip(sec.numbers));
    h.push(briefs(sec.briefs, 'In Brief'));
    return h.join('');
  }

  function renderSources() {
    var h = [pageHead('Sources', MH.date)];
    h.push('<div class="section-flag"><h2>Sources and Further Reading</h2>' +
      '<p>Every article carries its sources below. Some rest on a single outlet; where a source could not carry the wording, the edition says so on The Press.</p></div>');
    var order = [], bySec = {};
    D.sources.forEach(function (s) {
      if (!bySec[s.section]) { bySec[s.section] = []; order.push(s.section); }
      bySec[s.section].push(s);
    });
    order.forEach(function (name) {
      h.push('<h3 class="src-sec">' + esc(name) + '</h3>');
      h.push('<ul class="src-list">' + j(bySec[name].map(function (s) {
        return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.publisher) + '</a>' +
          '<span class="src-date">' + esc(s.date || '') + '</span><em>' + esc(s.story) + '</em></li>';
      })) + '</ul>');
    });
    return h.join('');
  }

  var PAGES = [{ id: 'front', label: 'Front Page', render: renderFront }];
  D.sections.forEach(function (sec, i) {
    PAGES.push({ id: slug(sec.name), label: sec.name, section: sec, render: function () { return renderSection(sec); } });
  });
  PAGES.push({ id: 'sources', label: 'Sources', render: renderSources });

  var index = 0;
  // index.html now pre-renders page one and fetches this file late, so the first
  // render usually happens after the reader has been reading for a while.
  // Scrolling to the top then would yank them back; the browser is already at the
  // top on a real load, so the first render never needs to scroll.
  var firstRender = true;
  function current() { return PAGES[index]; }

  var earNodes = document.querySelectorAll('.masthead .ear');
  var earHome = [];
  Array.prototype.forEach.call(earNodes, function (el) { earHome.push(el.innerHTML); });

  function teasers() {
    var items = [];
    D.sections.forEach(function (sec, i) {
      var lead = (sec.stories || [])[0];
      if (!lead) return;
      items.push({
        id: slug(sec.name),
        kick: sec.name + ' \u00b7 Page ' + (i + 2),
        title: lead.headline
      });
    });
    return items;
  }

  function fillEar(el, item) {
    el.innerHTML = '<div class="ear-kick">' + esc(item.kick) + '</div>' +
      '<a class="ear-head" href="#' + esc(item.id) + '">' + esc(item.title) + '</a>';
  }

  function paintEars() {
    if (!earNodes.length) return;
    if (current().id === 'front') {
      earNodes[0].innerHTML = earHome[0];
      if (earNodes[1]) earNodes[1].innerHTML = earHome[1];
      return;
    }
    var items = teasers();
    var at = -1;
    for (var i = 0; i < items.length; i++) { if (items[i].id === current().id) at = i; }
    if (at < 0) return;
    var prev = items[(at + items.length - 1) % items.length];
    var next = items[(at + 1) % items.length];
    fillEar(earNodes[0], prev);
    if (earNodes[1]) fillEar(earNodes[1], next);
  }

  // Everything about a page turn except the markup itself: counters, button
  // states, the hash and the masthead ears.
  function syncChrome(scroll) {
    counterEl.textContent = (index + 1) + ' / ' + PAGES.length;
    footPage.textContent = String(index + 1);
    footTotal.textContent = String(PAGES.length);
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === PAGES.length - 1;
    selectEl.value = String(index);
    Array.prototype.forEach.call(dotsEl.children, function (b, i) {
      b.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
    if (window.location.hash !== '#' + current().id) history.replaceState(null, '', '#' + current().id);
    paintEars();
    if (scroll) window.scrollTo(0, 0);
  }

  function render() {
    var p = current();
    pageEl.innerHTML = p.render();
    pageEl.classList.remove('turn-in');
    void pageEl.offsetWidth;
    pageEl.classList.add('turn-in');
    syncChrome(!firstRender);
    firstRender = false;
  }

  function go(i, skipHash) {
    if (i < 0 || i >= PAGES.length) return;
    index = i;
    render();
    if (!skipHash && window.location.hash !== '#' + current().id) history.replaceState(null, '', '#' + current().id);
  }

  // Clear first: when index.html has been pre-rendered by tools/prerender.js the
  // dots and options are already in the markup, and appending would duplicate them.
  dotsEl.innerHTML = '';
  selectEl.innerHTML = '';
  PAGES.forEach(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(i + 1);
    b.setAttribute('aria-label', 'Page ' + (i + 1) + ': ' + p.label);
    b.addEventListener('click', function () { go(i); });
    dotsEl.appendChild(b);
    var o = document.createElement('option');
    o.value = String(i);
    o.textContent = (i + 1) + '. ' + p.label;
    selectEl.appendChild(o);
  });

  function renderAll() {
    document.body.classList.add('all-pages');
    pageEl.innerHTML = j(PAGES.map(function (p, i) {
      return '<section class="all-page" id="all-' + i + '">' + p.render() + '</section>';
    }));
    counterEl.textContent = PAGES.length + ' pages';
    footPage.textContent = String(PAGES.length);
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    var bar = document.querySelector('.controls');
    if (bar) bar.style.display = 'none';
  }

  var params = new URLSearchParams(window.location.search);
  if (params.has('all')) { renderAll(); return; }

  prevBtn.addEventListener('click', function () { go(index - 1); });
  nextBtn.addEventListener('click', function () { go(index + 1); });
  selectEl.addEventListener('change', function () { go(parseInt(selectEl.value, 10)); });
  document.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(index + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(PAGES.length - 1); }
  });
  window.addEventListener('hashchange', function () {
    var id = window.location.hash.replace('#', '');
    for (var i = 0; i < PAGES.length; i++) { if (PAGES[i].id === id && i !== index) { go(i, true); return; } }
  });

  var startId = (window.location.hash || '').replace('#', '');
  var startIndex = 0;
  for (var k = 0; k < PAGES.length; k++) { if (PAGES[k].id === startId) startIndex = k; }
  if (params.has('p')) { var q = parseInt(params.get('p'), 10); if (!isNaN(q)) startIndex = q; }
  var target = Math.min(Math.max(startIndex, 0), PAGES.length - 1);
  // index.html already contains page one, and these scripts are fetched late so
  // they do not race the photographs. Re-rendering identical markup would rebuild
  // every node after the reader has the page, which counts as a fresh largest
  // paint and makes the page look slower than it is. Adopt what is already there.
  if (target === 0 && pageEl.querySelector('.page-head')) {
    index = 0;
    syncChrome(false);
  } else {
    go(target, true);
  }
})();
