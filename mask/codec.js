// 伏せた文章をQRコード用に詰める／受け取り側で元に戻す
// 形式：#<方式><ID>.<何枚目>.<全部で何枚>.<データ>
//   方式 z = 圧縮あり、u = 圧縮なし。データはURLで使える文字だけ（base64url）。
(function (root) {
  'use strict';
  var CHUNK = 1300; // 1枚あたりのデータの文字数（QRコードが大きくなりすぎない量）

  function toB64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(str) {
    var b = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    var bin = atob(b), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function streamBytes(bytes, stream) {
    var s = new Blob([bytes]).stream().pipeThrough(stream);
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function canCompress() { return typeof CompressionStream !== 'undefined'; }

  function encode(text) {
    var bytes = new TextEncoder().encode(text);
    var p = canCompress()
      ? streamBytes(bytes, new CompressionStream('deflate-raw')).then(function (b) { return { flag: 'z', b: b }; })
      : Promise.resolve({ flag: 'u', b: bytes });
    return p.then(function (r) {
      var data = toB64url(r.b);
      var id = Math.random().toString(36).slice(2, 6);
      var n = Math.max(1, Math.ceil(data.length / CHUNK));
      var parts = [];
      for (var i = 0; i < n; i++) {
        parts.push(r.flag + id + '.' + (i + 1) + '.' + n + '.' + data.slice(i * CHUNK, (i + 1) * CHUNK));
      }
      return parts;
    });
  }

  // 1枚分を読み取る
  function parsePart(frag) {
    var m = /^([zu])([a-z0-9]{1,8})\.(\d+)\.(\d+)\.([A-Za-z0-9_-]*)$/.exec(frag);
    if (!m) return null;
    var i = +m[3], n = +m[4];
    if (i < 1 || n < 1 || i > n || n > 50) return null;
    return { flag: m[1], id: m[2], i: i, n: n, data: m[5] };
  }

  // 全部そろったデータを文章に戻す
  function decode(flag, data) {
    var bytes = fromB64url(data);
    var p = flag === 'z'
      ? streamBytes(bytes, new DecompressionStream('deflate-raw'))
      : Promise.resolve(bytes);
    return p.then(function (b) { return new TextDecoder().decode(b); });
  }

  var api = { encode: encode, parsePart: parsePart, decode: decode, CHUNK: CHUNK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MaskCodec = api;
})(this);
