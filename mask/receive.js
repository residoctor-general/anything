// 受け取り用ページ（iPhone側）。複数枚のQRコードは、そろうまでこのiPhoneの中に一時的に置く（30分で消える）。
(function () {
  'use strict';
  var C = window.MaskCodec;
  var KEY = 'rx:';
  var TTL = 30 * 60 * 1000;
  var $ = function (id) { return document.getElementById(id); };
  var out = $('out'), status = $('status');

  function setStatus(msg, cls) { status.textContent = msg; status.className = 'status ' + (cls || ''); }
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function clearAll() {
    var st = store(); if (!st) return;
    Object.keys(st).forEach(function (k) { if (k.indexOf(KEY) === 0) st.removeItem(k); });
  }
  function purgeOld() {
    var st = store(); if (!st) return;
    Object.keys(st).forEach(function (k) {
      if (k.indexOf(KEY) !== 0) return;
      try { if (Date.now() - JSON.parse(st.getItem(k)).t > TTL) st.removeItem(k); } catch (e) { st.removeItem(k); }
    });
  }
  function show(text) {
    out.value = text;
    out.classList.remove('hidden');
    $('btn-copy').classList.remove('hidden');
    setStatus('受け取りました（' + text.length + '文字）', 'ok');
  }

  var frag = location.hash.slice(1);
  // 文章をアドレス欄と履歴に残さないよう、すぐにURLから消す
  if (frag) history.replaceState(null, '', location.pathname);
  purgeOld();

  var part = frag ? C.parsePart(frag) : null;
  if (!frag) {
    setStatus('伏せるページのQRコードを、iPhoneのカメラで読み取ってください。');
  } else if (!part) {
    setStatus('QRコードの内容を読み取れませんでした。', 'warn');
  } else if (part.n === 1) {
    C.decode(part.flag, part.data).then(show, function () { setStatus('文章に戻せませんでした。', 'warn'); });
  } else {
    var st = store();
    if (!st) {
      setStatus('このブラウザでは複数枚の受け取りができません（プライベートブラウズを切ってください）。', 'warn');
    } else {
      var key = KEY + part.id;
      var rec;
      try { rec = JSON.parse(st.getItem(key)) || null; } catch (e) { rec = null; }
      if (!rec || rec.n !== part.n || rec.flag !== part.flag) rec = { n: part.n, flag: part.flag, parts: {}, t: Date.now() };
      rec.parts[part.i] = part.data;
      var missing = [];
      for (var i = 1; i <= rec.n; i++) if (rec.parts[i] === undefined) missing.push(i);
      if (missing.length) {
        st.setItem(key, JSON.stringify(rec));
        setStatus((rec.n - missing.length) + ' / ' + rec.n + ' 枚 受け取りました。残り：' + missing.join('、') + ' 枚目を読み取ってください。');
      } else {
        st.removeItem(key);
        var data = '';
        for (var j = 1; j <= rec.n; j++) data += rec.parts[j];
        C.decode(rec.flag, data).then(show, function () { setStatus('文章に戻せませんでした。最初から読み取り直してください。', 'warn'); });
      }
    }
  }

  $('btn-copy').addEventListener('click', function () {
    var done = function () { setStatus('コピーしました。Claudeに貼り付けてください。', 'ok'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(out.value).then(done, function () { out.select(); setStatus('コピーできませんでした。文章を長押ししてコピーしてください。', 'warn'); });
    } else { out.select(); try { document.execCommand('copy'); done(); } catch (e) { setStatus('長押ししてコピーしてください。', 'warn'); } }
  });
  $('btn-clear').addEventListener('click', function () {
    out.value = ''; out.classList.add('hidden'); $('btn-copy').classList.add('hidden');
    clearAll();
    setStatus('消しました。このタブを閉じてください。', 'ok');
  });
})();
