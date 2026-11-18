// 伏せるページの画面の動き。何も保存せず、外部にも送らない。
(function () {
  'use strict';
  var R = window.MaskRules, C = window.MaskCodec;
  // 受け取り用ページの場所（このページと同じ場所の r.html）。ファイルを直接開いたときだけ公開先を使う。
  var FALLBACK_RECEIVER = 'https://residoctor-general.github.io/anything/mask/r.html';

  var $ = function (id) { return document.getElementById(id); };
  var input = $('input'), view = $('view'), ref = $('ref'), status = $('status');
  var state = null;      // { text, ranges }
  var sel = null;        // 最後に選んだ範囲 { s, e }
  var qrParts = [], qrIndex = 0;

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  ref.value = todayStr();
  function refDate() {
    var v = ref.value.split('-');
    return v.length === 3 ? new Date(+v[0], +v[1] - 1, +v[2]) : new Date();
  }

  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function receiverURL() {
    if (/^https?:$/.test(location.protocol)) {
      var u = new URL('r.html', location.href);
      u.hash = ''; u.search = '';
      return u.toString();
    }
    return FALLBACK_RECEIVER;
  }

  // ---- 表示 ----
  function draw() {
    if (!state) { view.innerHTML = ''; updateButtons(); return; }
    var t = state.text, html = '', pos = 0;
    state.ranges.forEach(function (r) {
      if (r.s > pos) html += '<span data-s="' + pos + '">' + esc(t.slice(pos, r.s)) + '</span>';
      var orig = t.slice(r.s, r.e);
      if (r.kind === 'mask') {
        html += '<span class="m' + (r.rule === '手動' ? ' manual' : '') + '" data-s="' + r.s + '" data-e="' + r.e +
          '" data-kind="mask" title="元の文字：' + esc(orig) + '">' + esc(R.placeholder(r)) + '</span>';
      } else {
        html += '<span class="q" data-s="' + r.s + '" data-e="' + r.e + '" data-kind="suspect" title="怪しい箇所（' +
          esc(r.label) + '?）">' + esc(orig) + '</span>';
      }
      pos = r.e;
    });
    if (pos < t.length) html += '<span data-s="' + pos + '">' + esc(t.slice(pos)) + '</span>';
    view.innerHTML = html;
    sel = null;
    var nMask = state.ranges.filter(function (r) { return r.kind === 'mask'; }).length;
    var nSus = state.ranges.length - nMask;
    setStatus('伏せた箇所 ' + nMask + ' ／ 怪しい箇所 ' + nSus, nSus ? 'warn' : 'ok');
    hideQR();
    updateButtons();
  }
  function setStatus(msg, cls) { status.textContent = msg; status.className = 'status ' + (cls || ''); }
  function updateButtons() {
    var has = !!state;
    $('btn-qr').disabled = !has;
    $('btn-copy').disabled = !has;
    $('btn-mask').disabled = !(has && sel && sel.e > sel.s);
    $('btn-unmask').disabled = !(has && sel);
    $('btn-suspects').disabled = !(has && state.ranges.some(function (r) { return r.kind === 'suspect'; }));
  }

  // ---- 選んだ範囲を元の文章の位置に直す ----
  function posOf(node, offset, isEnd) {
    var el;
    if (node.nodeType === 3) { el = node.parentElement; }
    else if (node === view) {
      var kids = view.children;
      if (offset >= kids.length) return state.text.length;
      return +kids[offset].dataset.s;
    } else { el = node; offset = offset > 0 ? Infinity : 0; }
    var span = el && el.closest('[data-s]');
    if (!span || !view.contains(span)) return null;
    var s = +span.dataset.s;
    if (span.dataset.kind === 'mask') return isEnd ? +span.dataset.e : s;
    var len = span.dataset.e ? (+span.dataset.e - s) : span.textContent.length;
    return s + Math.min(offset, len);
  }
  function readSelection() {
    var ws = window.getSelection();
    if (!state || !ws || ws.rangeCount === 0) return;
    var rg = ws.getRangeAt(0);
    if (!view.contains(rg.commonAncestorContainer)) return;
    var a = posOf(rg.startContainer, rg.startOffset, false);
    var b = posOf(rg.endContainer, rg.endOffset, true);
    if (a === null || b === null) return;
    if (b < a) { var t = a; a = b; b = t; }
    sel = { s: a, e: b };
    updateButtons();
  }
  document.addEventListener('selectionchange', readSelection);
  // ボタンを押しても選択が消えないようにする
  ['btn-mask', 'btn-unmask'].forEach(function (id) {
    $(id).addEventListener('mousedown', function (ev) { ev.preventDefault(); });
  });

  // ---- ボタン ----
  $('btn-run').addEventListener('click', function () {
    if (!input.value.trim()) { setStatus('文章が入っていません', 'warn'); return; }
    state = R.analyze(input.value, refDate());
    draw();
  });
  ref.addEventListener('change', function () { if (state) { state = R.analyze(input.value, refDate()); draw(); } });
  input.addEventListener('input', function () {
    if (state) { state = null; draw(); setStatus('文章が変わりました。もう一度「伏せる」を押してください', 'warn'); }
  });
  $('btn-mask').addEventListener('click', function () {
    if (!sel || sel.e <= sel.s) return;
    state.ranges = R.addManual(state.ranges, sel.s, sel.e, $('label').value);
    window.getSelection().removeAllRanges();
    draw();
  });
  $('btn-unmask').addEventListener('click', function () {
    if (!sel) return;
    state.ranges = R.removeRanges(state.ranges, sel.s, sel.e);
    window.getSelection().removeAllRanges();
    draw();
  });
  $('btn-suspects').addEventListener('click', function () {
    state.ranges = R.maskSuspects(state.ranges);
    draw();
  });

  function output() { return R.render(state.text, state.ranges); }
  function confirmSuspects() {
    var n = state.ranges.filter(function (r) { return r.kind === 'suspect'; }).length;
    return !n || window.confirm('怪しい箇所が ' + n + ' 件、伏せないまま残っています。このまま進めますか？');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.className = 'offscreen';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }
  $('btn-copy').addEventListener('click', function () {
    if (!confirmSuspects()) return;
    copyText(output()).then(function () { setStatus('伏せた後の文章をコピーしました', 'ok'); },
      function () { setStatus('コピーできませんでした', 'warn'); });
  });

  // ---- QRコード ----
  function hideQR() { qrParts = []; $('qr-area').classList.add('hidden'); $('qr-box').innerHTML = ''; }
  function showQR() {
    $('qr-area').classList.remove('hidden');
    var url = receiverURL() + '#' + qrParts[qrIndex];
    var qr = qrcode(0, 'L');
    qr.addData(url, 'Byte');
    qr.make();
    // 1マスを整数ピクセルにして、くっきり表示する（読み取りやすくするため）
    var cells = qr.getModuleCount() + 8;
    var avail = Math.min(560, $('qr-area').clientWidth || 560);
    var px = Math.max(2, Math.floor(avail / cells));
    $('qr-box').innerHTML = qr.createSvgTag({ cellSize: 1, margin: 4, scalable: true });
    var svg = $('qr-box').querySelector('svg');
    svg.style.width = svg.style.height = (px * cells) + 'px';
    $('qr-count').textContent = (qrIndex + 1) + ' / ' + qrParts.length + ' 枚目';
    $('qr-prev').disabled = qrIndex === 0;
    $('qr-next').disabled = qrIndex === qrParts.length - 1;
    $('qr-note').textContent = qrParts.length > 1
      ? 'iPhoneのカメラで1枚ずつ読み取ってください。全部読むと、最後に開いたページに文章がまとまって表示されます。'
      : 'iPhoneのカメラで読み取り、表示されたリンクを開いてください。';
    $('qr-area').classList.remove('hidden');
  }
  $('btn-qr').addEventListener('click', function () {
    if (!confirmSuspects()) return;
    C.encode(output()).then(function (parts) {
      qrParts = parts; qrIndex = 0; showQR();
    });
  });
  $('qr-prev').addEventListener('click', function () { if (qrIndex > 0) { qrIndex--; showQR(); } });
  $('qr-next').addEventListener('click', function () { if (qrIndex < qrParts.length - 1) { qrIndex++; showQR(); } });

  // ---- 削除 ----
  $('btn-clear').addEventListener('click', function () {
    input.value = '';
    state = null; sel = null;
    draw(); hideQR();
    // コピーしたものもクリップボードから消す（できる環境のみ）
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText('').catch(function () {});
    setStatus('すべて消しました', 'ok');
  });
})();
