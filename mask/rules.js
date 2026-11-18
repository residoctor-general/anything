// 個人情報を伏せる規則（ブラウザとNode.jsの両方で動く）
// 外部への送信は一切しない。入力された文章はこのファイルの関数の中だけで扱う。
(function (root) {
  'use strict';

  // ---- 文字の種類 ----
  var KANJI = '\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF々〆ヶ';
  var KATA = '\\u30A1-\\u30FAー・';
  var NAME = '[' + KANJI + KATA + ']';
  var KJ = '[' + KANJI + ']';
  var WEEKDAY = '(?:\\s*[(（][月火水木金土日][)）])?';

  // 全角の英数字・記号を半角にそろえる（文字数は変わらない）
  function normalize(text) {
    return text
      .replace(/[！-～]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
      })
      .replace(/　/g, ' ')
      .replace(/\r\n?/g, '\n');
  }

  // ---- 辞書 ----
  // よくある姓（2文字以上。1文字の姓は普通の言葉とぶつかるので入れない）
  var SURNAMES = (
    '佐藤 鈴木 高橋 髙橋 田中 伊藤 渡辺 渡部 渡邊 渡邉 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 清水 ' +
    '山崎 山﨑 阿部 池田 橋本 山下 石川 中島 前田 藤田 後藤 小川 岡田 村上 長谷川 近藤 石井 斎藤 斉藤 齋藤 齊藤 坂本 ' +
    '遠藤 藤井 青木 福田 三浦 西村 藤原 太田 松田 原田 岡本 中野 中川 小野 田村 竹内 金子 和田 中山 石田 上田 森田 ' +
    '小島 柴田 酒井 工藤 横山 宮崎 宮本 内田 高木 安藤 谷口 大野 丸山 今井 高田 藤本 武田 村田 上野 杉山 増田 小山 ' +
    '大塚 平野 菅原 久保 松井 千葉 岩崎 桜井 櫻井 木下 野口 松尾 菊地 菊池 野村 新井 渡部 佐野 杉本 古川 大西 浜田 濱田 ' +
    '市川 中西 原 北村 今村 小松 松下 河野 宮田 永井 西田 大川 吉川 吉村 中田 福井 関口 秋山 前川 荒木 本田 久保田 ' +
    '大島 小池 樋口 星野 平田 水野 安田 須藤 小田 片山 川口 中谷 山中 川村 堀 田辺 早川 岩田 森本 尾崎 西川 村井 ' +
    '飯田 島田 上原 高野 内藤 服部 大石 小西 熊谷 岡崎 栗原 宮下 坂口 松岡 石原 川上 東 西 南 北 浅野 黒田 大久保 ' +
    '小森 松村 北川 堀内 野田 富田 吉岡 川崎 大谷 桑原 古田 竹田 辻 新田 篠原 青山 長田 西山 松浦 藤川 河合 宮川 ' +
    '平井 森下 武藤 小沢 小澤 永田 長尾 細川 岡 稲葉 三宅 内山 安達 足立 根本 西尾 大田 高山 土屋 白石 本間 小野寺 ' +
    '神田 森山 菅野 堤 宮原 南 大森 加納 鈴村 中尾 浅井 杉浦 大橋 石塚 山内 寺田 植田 福島 吉野 河村 長島 宮内 望月 ' +
    '横田 西岡 奥村 奥田 有馬 小倉 上村 沢田 澤田 片岡 川島 嶋田 島崎 堀田 松山 森岡 原口 広瀬 廣瀬 竹中 中原 芦田'
  ).split(/\s+/).filter(function (s) { return s.length >= 2; });
  SURNAMES = Array.from(new Set(SURNAMES)).sort(function (a, b) { return b.length - a.length; });
  var SURNAME_RE_SRC = '(?:' + SURNAMES.join('|') + ')';

  var PREFS = '(?:北海道|東京都|京都府|大阪府|(?:青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)県)';

  // 診療科名など（「〇〇内科」の〇〇がこれだけでできていれば、施設名ではないと判断）
  var DEPT_WORDS = ('消化器 循環器 呼吸器 腎臓 神経 脳神経 血液 内分泌 代謝 糖尿病 総合 一般 心臓血管 心臓 乳腺 泌尿器 形成 ' +
    '救急 腫瘍 肝臓 肝胆膵 胆膵 膵臓 膠原病 リウマチ 感染症 緩和 老年 心療 精神 小児 産婦人 婦人 整形 脳 頭頸部 胸部 腹部 ' +
    '上部 下部 消化管 大腸 肛門 食道 胃 内 外 歯 口腔 美容 麻酔 放射線 病理 眼 皮膚 耳鼻 耳鼻咽喉 当 前 他 同 各 主 担当 ' +
    '専門 甲状腺 内視鏡 透析 在宅 訪問 漢方 睡眠 アレルギー ペイン リハビリ スポーツ 移植 小腸 腎 肝 心 肺 血管 ' +
    '一般内科 総合診療 小児外 成人 女性 男性 初診 再診 外来 病棟 院内 他院 各科').split(/\s+/);
  var DEPT_ONLY_RE = new RegExp('^(?:' + DEPT_WORDS.sort(function (a, b) { return b.length - a.length; }).join('|') + ')+$');

  // 名前の前に付きやすい言葉（取り除いてから名前かどうかを判断する）
  var LEADING_WORDS = ['紹介元', 'かかりつけ', '主治医', '担当医', '主治', '担当', '当直', '紹介', '研修医', '研修', '指導医', '指導',
    '上級医', '前医', '近医', '他院', '当院', '同院', '院長', '副院長', '部長', '医長', '科長', '教授', '准教授', '講師', '助教',
    '非常勤', '常勤', '外来', '病棟', '当科', '他科', '各科', '依頼', '担当看護師', '受け持ち', '受持', '患者', '本人', 'ご',
    '当', '前', '近', '他', '同', '貴', '本', '某', '旧'];
  var NOT_NAMES = ['患者', '本人', '家族', '奥', '旦那', '息子', '娘', '母', '父', '夫', '妻', '兄', '姉', '弟', '妹', '皆', '子', '孫',
    '祖母', '祖父', '同', '多', '異', '模', '仕', '一', '各', 'ヘルパー', 'ケアマネ', 'ナース', 'ドクター', '看護師', '同居人', '隣人',
    '知人', '友人', '上司', '同僚', '客', '神', '仏', '王', '医療者', '嬢', '坊', '赤', '主治', '担当', '当直', '研修', '指導', '専門',
    '開業', '主', '上級', '後期研修', '初期研修', '外来', '病棟', '内視鏡', '看護', '訪問', '認定', '専従', '救急', '麻酔', '外科', '内科',
    '女性', '男性', '若手', '同期', '院長', '副院長', '部長', '医長', '科長', '教授', '准教授', '講師', '助教', '当科', '他科', '各科',
    '紹介元', '依頼', '前医', '近医', '当院', '他院', '紹介', '代理', '代診', '非常勤', '常勤', '歯科', '産業', '学校', '担任', '保健'];
  // 「〇〇様」が「〜のような」の意味で使われる言葉
  var LIKE_SUFFIX_RE = new RegExp('(?:腫瘍|隆起|結節|腫瘤|陰影|病変|炎|症|瘤|癌|影|状|腫|潰瘍|膜|体|斑|疹|変化|所見|構造|形態|狭窄|肥厚|' +
    '浮腫|壁|像|突起|塊|物|性|粘膜|線|網|顆粒|絨毛|乳頭|脂肪|嚢胞|腺腫|管|血|胞|核|筋|層|部|片|粒|根|枝|点|帯|輪|糸|巣|丘|溝|窩|痕|' +
    '毛|皺|襞|孔|癒着|硬化|萎縮|不整|発赤|色|調|模|同|多|異|一|各|仕|紋|膿|便|液|苔|疣|痂|皮|凹|陥凹|隆|平坦|局面|域|洞|房|' +
    '発作|疼痛|痛|咳|音|感|反応|症状|徴候|陰性|陽性|所見)$');

  // ---- 日付 ----
  var ERA_BASE = { '令和': 2018, '平成': 1988, '昭和': 1925, '大正': 1911, R: 2018, H: 1988, S: 1925, T: 1911 };
  function eraYear(era, y) { return ERA_BASE[era] + (y === '元' ? 1 : parseInt(y, 10)); }
  function validDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;
    return dt;
  }
  function refUTC(ref) { return Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()); }
  function relDays(dt, ref) {
    var diff = Math.round((refUTC(ref) - dt.getTime()) / 86400000);
    if (diff === 0) return '当日';
    var a = Math.abs(diff), w = diff > 0 ? '前' : '後';
    if (a < 365) return a + '日' + w;
    var months = Math.round(a / 30.4375);
    var y = Math.floor(months / 12), mo = months % 12;
    return '約' + y + '年' + (mo ? mo + 'か月' : '') + w;
  }
  function relMonths(y, m, ref) {
    var diff = (ref.getFullYear() * 12 + ref.getMonth() + 1) - (y * 12 + m);
    if (diff === 0) return '今月';
    var a = Math.abs(diff), w = diff > 0 ? '前' : '後';
    if (a >= 24) return '約' + Math.round(a / 12) + '年' + w;
    return '約' + a + 'か月' + w;
  }
  function relYears(y, ref) {
    var diff = ref.getFullYear() - y;
    if (diff === 0) return '今年';
    return '約' + Math.abs(diff) + '年' + (diff > 0 ? '前' : '後');
  }
  var BIRTH_BEFORE_RE = /(生年月日|DOB|誕生日|生まれ)[\s:：]*$/;
  var BIRTH_AFTER_RE = /^\s*(生まれ|生(?![活検存理物化体命前後涯])|出生)/;
  function isBirth(text, s, e) {
    return BIRTH_BEFORE_RE.test(text.slice(Math.max(0, s - 12), s)) || BIRTH_AFTER_RE.test(text.slice(e, e + 4));
  }
  var FRACTION_AFTER_RE = /^\s*(陽性|陰性|陽|陰|錠|包|本|倍|周|量|回|T|A|V|g|mg|μg|ug|mL|ml|L|個|cm|mm|程度|以下|以上|未満|ずつ|ほど|視野|HPF|hpf|分割|筒|管|袋|枚|日分|日量|カプセル|C\b|cap|滴|単位|U\b|切片|生検|個中|検体|中)/;

  // ---- 年齢 ----
  function roundAge(n) {
    if (n < 10) return '10歳未満';
    if (n >= 90) return '90歳以上';
    return Math.floor(n / 10) * 10 + '代';
  }

  function stripLeading(name) {
    var changed = true;
    while (changed && name) {
      changed = false;
      for (var i = 0; i < LEADING_WORDS.length; i++) {
        var w = LEADING_WORDS[i];
        if (name === w) return '';
        if (name.length > w.length && name.indexOf(w) === 0) { name = name.slice(w.length); changed = true; break; }
      }
    }
    return name;
  }
  function isNotName(name) { return !name || NOT_NAMES.indexOf(name) >= 0; }

  // ---- 規則 ----
  // 各規則は正規表現と、見つかった箇所から「伏せる範囲」を作る関数の組。
  // kind: 'mask' = 自動で伏せる、'suspect' = 怪しい（色を付けるだけ）
  var SURNAME_START = new RegExp('^' + SURNAME_RE_SRC);
  // 名前の直前に残ったひらがな（例：「さくら台」の「さくら」）を怪しい箇所にする
  var PARTICLE_END = /(より|から|まで|では|には|とは|にて|へ|は|が|を|に|で|と|の|も|や|て|た|し|る|り|い|う|く|か|な|ね|よ|わ|だ|す|ず|ん)$/;
  function hiraganaBefore(text, s, label) {
    var m = /[\u3041-\u309F]{1,6}$/.exec(text.slice(Math.max(0, s - 6), s));
    if (!m) return [];
    if (PARTICLE_END.test(m[0]) && m[0].length <= 2) return [];
    return [{ s: s - m[0].length, e: s, label: label, kind: 'suspect' }];
  }

  function rules() {
    var R = [];
    function rule(name, re, fn) { R.push({ name: name, re: re, fn: fn }); }

    // 1. 「氏名：」「住所：」などの項目
    var LABELS = {
      '氏名': '氏名', '患者名': '氏名', '患者氏名': '氏名', '名前': '氏名', 'フリガナ': '氏名', 'ふりがな': '氏名', 'カナ': '氏名',
      '住所': '住所', '現住所': '住所', '電話番号': '電話番号', '電話': '電話番号', 'TEL': '電話番号', 'Tel': '電話番号',
      '携帯': '電話番号', '携帯電話': '電話番号', '緊急連絡先': '連絡先', '連絡先': '連絡先', '勤務先': '勤務先', '職場': '勤務先',
      '生年月日': '生年月日', '保険者番号': '番号', '被保険者番号': '番号', '記号番号': '番号', '保険証番号': '番号',
      'メール': 'メール', 'Email': 'メール', 'E-mail': 'メール', 'email': 'メール', 'キーパーソン': '氏名', '家族連絡先': '連絡先'
    };
    var labelKeys = Object.keys(LABELS).sort(function (a, b) { return b.length - a.length; }).join('|');
    // 値の形：氏名は名前の文字だけ、電話・番号は数字だけ、それ以外は行末（または空白2つ）まで
    var VALUE_RE = {
      '氏名': new RegExp('^' + NAME + '{1,10}(?: ' + NAME + '{1,10})?'),
      '電話番号': /^[0-9()（）\-−‐]+(?: [0-9()（）\-−‐]+)*/,
      '番号': /^[0-9A-Za-z\-−‐]+(?: [0-9A-Za-z\-−‐]+)*/,
      '生年月日': /^\S+(?: ?[(（]\S*[)）])?/
    };
    rule('項目', new RegExp('(?:^|(?<=[\\s、,/|]))(' + labelKeys + ')[ \\t]*[:：][ \\t]*([^\\n\\t]+?)(?=[ \\t]{2,}|\\t|[ ]+[^\\s:：]{1,6}[:：]|$)', 'gm'),
      function (m) {
        var label = LABELS[m[1]];
        var value = m[2];
        if (VALUE_RE[label]) {
          var v = VALUE_RE[label].exec(value);
          if (!v) return [];
          value = v[0];
        }
        var s = m.index + m[0].length - m[2].length;
        return [{ s: s, e: s + value.length, label: label }];
      });

    // 2. メールアドレス
    rule('メール', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, function (m) {
      return [{ s: m.index, e: m.index + m[0].length, label: 'メール' }];
    });

    // 3. 患者ID
    rule('ID', /(?<![A-Za-z])(患者ID|患者番号|患者No\.?|カルテ番号|カルテNo\.?|カルテID|診察券番号|受付番号|登録番号|ID)[ \t]*[:：#.]?[ \t]*([A-Za-z0-9-]*\d[A-Za-z0-9-]*)/g,
      function (m) {
        if (m[2].length < 3) return [];
        var s = m.index + m[0].length - m[2].length;
        return [{ s: s, e: s + m[2].length, label: 'ID' }];
      });

    // 4. 電話番号
    rule('電話', /(?<![\d-])(0\d{1,4}[-−‐(（]\d{1,4}[-−‐)）]\d{3,4}|0[5789]0\d{8}|0\d{9})(?![\d-])/g, function (m) {
      return [{ s: m.index, e: m.index + m[0].length, label: '電話番号' }];
    });

    // 5. 郵便番号
    rule('郵便番号', /〒\s*\d{3}[-−]?\d{4}/g, function (m) {
      return [{ s: m.index, e: m.index + m[0].length, label: '住所' }];
    });

    // 6. 日付（生年月日は【生年月日】、それ以外は基準日からの日数に）
    function dateHit(m, text, ref, dt, kindOfRel) {
      var s = m.index, e = m.index + m[0].length;
      if (isBirth(text, s, e)) return [{ s: s, e: e, label: '生年月日' }];
      return [{ s: s, e: e, label: '日付', repl: kindOfRel }];
    }
    rule('日付(和暦)', new RegExp('(?<![A-Za-z])(令和|平成|昭和|大正|[RHST])\\s*(\\d{1,2}|元)\\s*[年./-]\\s*(\\d{1,2})\\s*[月./-]\\s*(\\d{1,2})(?:\\s*日)?(?!\\d)' + WEEKDAY, 'g'),
      function (m, text, ref) {
        var dt = validDate(eraYear(m[1], m[2]), +m[3], +m[4]);
        return dt ? dateHit(m, text, ref, dt, relDays(dt, ref)) : [];
      });
    rule('日付(西暦)', new RegExp('(?<!\\d)((?:19|20)\\d{2})\\s*[年/.-]\\s*(\\d{1,2})\\s*[月/.-]\\s*(\\d{1,2})(?:\\s*日)?(?!\\d)' + WEEKDAY, 'g'),
      function (m, text, ref) {
        var dt = validDate(+m[1], +m[2], +m[3]);
        return dt ? dateHit(m, text, ref, dt, relDays(dt, ref)) : [];
      });
    rule('日付(8桁)', /(?<!\d)((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/g, function (m, text, ref) {
      var dt = validDate(+m[1], +m[2], +m[3]);
      return dt ? dateHit(m, text, ref, dt, relDays(dt, ref)) : [];
    });
    rule('年月(和暦)', /(令和|平成|昭和|大正)\s*(\d{1,2}|元)\s*年\s*(\d{1,2})\s*月(?!\s*\d)/g, function (m, text, ref) {
      var y = eraYear(m[1], m[2]), mo = +m[3];
      if (mo < 1 || mo > 12) return [];
      return dateHit(m, text, ref, null, relMonths(y, mo, ref));
    });
    rule('年月(西暦)', /(?<!\d)((?:19|20)\d{2})\s*(?:年\s*(\d{1,2})\s*月(?!\s*\d)|[/.](\d{1,2})(?![\d/.]))/g, function (m, text, ref) {
      var y = +m[1], mo = +(m[2] || m[3]);
      if (mo < 1 || mo > 12) return [];
      return dateHit(m, text, ref, null, relMonths(y, mo, ref));
    });
    rule('月日', new RegExp('(?<!\\d)(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日' + WEEKDAY, 'g'), function (m, text, ref) {
      return monthDay(m, text, ref, +m[1], +m[2]);
    });
    rule('月/日', new RegExp('(?<![\\d/.])(\\d{1,2})/(\\d{1,2})(?![\\d/.])' + WEEKDAY, 'g'), function (m, text, ref) {
      if (FRACTION_AFTER_RE.test(text.slice(m.index + m[0].length, m.index + m[0].length + 6))) return [];
      return monthDay(m, text, ref, +m[1], +m[2]);
    });
    function monthDay(m, text, ref, mo, d) {
      // 年がない日付は、基準日に一番近い年とみなす
      // 直前に「昨年」「今年」「来年」とあれば、その年にする
      var before = text.slice(Math.max(0, m.index - 4), m.index);
      var yr = ref.getFullYear(), from = yr - 1, to = yr + 1;
      if (/(昨年|去年)\s*$/.test(before)) from = to = yr - 1;
      else if (/(今年|本年)\s*$/.test(before)) from = to = yr;
      else if (/(来年|翌年)\s*$/.test(before)) from = to = yr + 1;
      var best = null, bestDiff = Infinity;
      for (var y = from; y <= to; y++) {
        var dt = validDate(y, mo, d);
        if (!dt) continue;
        var diff = Math.abs(dt.getTime() - refUTC(ref));
        if (diff < bestDiff) { best = dt; bestDiff = diff; }
      }
      return best ? dateHit(m, text, ref, best, relDays(best, ref)) : [];
    }
    rule('年(和暦)', /(令和|平成|昭和|大正)\s*(\d{1,2}|元)\s*年(度)?/g, function (m, text, ref) {
      return dateHit(m, text, ref, null, relYears(eraYear(m[1], m[2]), ref));
    });
    rule('年(西暦)', /(?<![\d.])((?:19|20)\d{2})\s*年(度)?(?!\s*\d)/g, function (m, text, ref) {
      return dateHit(m, text, ref, null, relYears(+m[1], ref));
    });

    // 7. 長い数字（7桁以上）と「123-4567」の形
    rule('番号', /(?<![\d.,])\d{7,}(?![\d.,])|(?<![\d-])\d{3}-\d{4}(?![\d-])/g, function (m) {
      return [{ s: m.index, e: m.index + m[0].length, label: '番号' }];
    });

    // 8. 年齢
    rule('年齢', /(?<![\d.])(\d{1,3})\s*(歳|才|y\.o\.|y\.o|y\/o|yo)(?![A-Za-z])/g, function (m) {
      var n = +m[1];
      if (n > 120) return [];
      return [{ s: m.index, e: m.index + m[0].length, label: '年齢', repl: roundAge(n) }];
    });
    rule('年齢(72M)', /(?<![\d.A-Za-z])(\d{2,3})\s?([MF])(?![A-Za-z0-9])/g, function (m) {
      var n = +m[1];
      if (n > 120) return [];
      var s = m.index, e = m.index + m[1].length;
      return [{ s: s, e: e, label: '年齢', repl: roundAge(n) }];
    });

    // 9. 住所
    rule('住所(都道府県)', new RegExp(PREFS + '[^\\s、。,()（）「」]{0,40}', 'g'), function (m) {
      return [{ s: m.index, e: m.index + m[0].length, label: '住所' }];
    });
    rule('住所(番地)', new RegExp(NAME + '{1,8}[市区郡](?:' + NAME + '{1,8}[町村])?' + NAME + '{0,10}\\d+(?:丁目|番地|番|号|[-−‐])(?:\\d+(?:番地|番|号|[-−‐])?)*', 'g'), function (m) {
      return [{ s: m.index, e: m.index + m[0].length, label: '住所' }];
    });
    rule('在住・出身', new RegExp('(' + NAME + '{1,10})(在住|出身|在勤|在学)', 'g'), function (m) {
      var place = m[1];
      if (/^(県内|市内|都内|府内|道内|町内|村内|区内|近隣|近所|海外|国内|県外|市外|都外|同|施設|自宅|独居|老健|特養|当地|地元|現|他県|同県|同市)$/.test(place)) return [];
      return [{ s: m.index, e: m.index + place.length, label: '地名' }];
    });

    // 10. 施設名（「病院」「クリニック」などの目印）
    var FAC_SUFFIX = '(?:大学病院|医療センター|メディカルセンター|健診センター|がんセンター|クリニック|ホスピタル|診療所|病院|医院)';
    var GENERIC_FAC = /^(大学|総合|市民|中央|県立|市立|国立|町立|公立|私立|一般|専門|地域|基幹|救急|精神科|療養型|療養|急性期|慢性期|高次|三次|二次|小規模|大|中小|大規模|地元|透析|回復期|リハビリ|ケアミックス|精神|総合病院|大学病院|入院|通院|転院|受診|退院|紹介|有床|無床|個人|民間|かかりつけ|近く|別|他|前|当|同|近|貴|本|某|旧)$/;
    rule('施設名', new RegExp('([' + KANJI + KATA + 'A-Za-z0-9&]{1,15}?)(' + FAC_SUFFIX + ')', 'g'), function (m, text) {
      var name = m[1];
      var stripped = stripLeading(name);
      if (!stripped || GENERIC_FAC.test(stripped) || GENERIC_FAC.test(name)) return [];
      var s = m.index + (name.length - stripped.length);
      return [{ s: s, e: m.index + name.length, label: '施設名' }].concat(hiraganaBefore(text, s, '施設名'));
    });
    rule('施設名(〇〇内科)', new RegExp('(' + NAME + '{1,6}?)(内科|外科|胃腸科|胃腸内科|眼科|皮膚科|耳鼻科|耳鼻咽喉科|整形外科|小児科|産婦人科|泌尿器科|婦人科|クリニック)', 'g'), function (m) {
      var name = stripLeading(m[1]);
      if (!name || DEPT_ONLY_RE.test(name) || DEPT_ONLY_RE.test(m[1])) return [];
      var s = m.index + (m[1].length - name.length);
      var kind = SURNAME_START.test(name) ? 'mask' : 'suspect';
      return [{ s: s, e: s + name.length, label: '施設名', kind: kind }];
    });

    // 11. 医師名・職員名
    rule('医師名(Dr.〇〇)', new RegExp('(?<![A-Za-z])(?:Dr\\.?|ドクター)\\s*(' + NAME + '{1,6}|[A-Z][a-z]+)', 'g'), function (m) {
      var s = m.index + m[0].length - m[1].length;
      if (isNotName(m[1])) return [];
      return [{ s: s, e: s + m[1].length, label: '医師名' }];
    });
    rule('医師名(主治医：〇〇)', new RegExp('(主治医師|担当医師|主治医|担当医|紹介医|記載医|執刀医|術者|指導医|上級医|担当看護師|担当Ns|受け持ち看護師)(?:[ \\t]*[:：][ \\t]*|[ \\t]+)(' + NAME + '{2,6})', 'g'), function (m) {
      var s = m.index + m[0].length - m[2].length;
      return [{ s: s, e: s + m[2].length, label: /看護|Ns/.test(m[1]) ? '職員名' : '医師名' }];
    });
    rule('医師名(〇〇先生)', new RegExp('(' + NAME + '{1,8}?)\\s?(先生|医師|Dr\\.?|ドクター|Ns|看護師|薬剤師|技師|栄養士|ケアマネ(?:ージャー)?|MSW)(?![A-Za-z])', 'g'), function (m) {
      var name = stripLeading(m[1]);
      if (isNotName(name) || DEPT_ONLY_RE.test(name)) return [];
      var s = m.index + (m[1].length - name.length);
      var label = /先生|医師|Dr|ドクター/.test(m[2]) ? '医師名' : '職員名';
      return [{ s: s, e: s + name.length, label: label }];
    });

    // 12. 患者さんの名前（「様」「さん」などの目印）
    rule('氏名(〇〇様)', new RegExp('(' + NAME + '{1,8}(?:[ ]' + NAME + '{1,6})?)(様|さん|氏|殿|くん|君|ちゃん)', 'g'), function (m, text) {
      var after = text.slice(m.index + m[0].length, m.index + m[0].length + 4);
      var marker = m[2];
      if (marker === '様' && /^[子式態相々]/.test(after)) return [];
      if (marker === '氏' && /^(病|症|徴|反射|法|変性|分類|手術|切開|輪|現象|試験|検査|管|腺|体|線|膜|囊|嚢|弁)/.test(after)) return [];
      var name = stripLeading(m[1]);
      if (isNotName(name)) return [];
      var s = m.index + (m[1].length - name.length);
      var hit = { s: s, e: s + name.length, label: '氏名' };
      if (marker === '様' || marker === '氏') {
        if (LIKE_SUFFIX_RE.test(name)) return [];
        if (/^[ァ-ヺー・]+$/.test(name)) {
          if (marker === '様') return [];
          hit.kind = 'suspect';
        } else if (!SURNAME_START.test(name)) {
          hit.kind = 'suspect';
        }
      }
      return [hit];
    });

    // 13. 姓の辞書
    rule('氏名(姓の辞書)', new RegExp('(?<![' + KANJI + '])(' + SURNAME_RE_SRC + ')(?:([ ]?' + KJ + '{1,3})(?![' + KANJI + ']))?', 'g'), function (m) {
      return [{ s: m.index, e: m.index + m[0].length, label: '氏名' }];
    });

    // 14. 怪しい箇所（色を付けるだけ）
    rule('地名?', new RegExp('(' + KJ + '{1,5})(市|町|村)(?![販場民立営長役内外議税])', 'g'), function (m) {
      if (/^(城下|下|門前|宿場|港|旧|同|当|隣|近隣|各|全|他|本|新|山|漁|農)$/.test(m[1])) return [];
      return [{ s: m.index, e: m.index + m[0].length, label: '地名', kind: 'suspect' }];
    });
    rule('大学名?', new RegExp('(' + NAME + '{1,8})大学(?!病院)', 'g'), function (m) {
      var name = stripLeading(m[1]);
      if (/^(医科|医|歯科|薬科|国立|公立|私立|他|当|同|各|出身)$/.test(name)) return [];
      var s = m.index + (m[1].length - name.length);
      return [{ s: s, e: m.index + m[0].length, label: '施設名', kind: 'suspect' }];
    });
    return R;
  }
  var RULES = rules();

  function overlaps(ranges, s, e) {
    for (var i = 0; i < ranges.length; i++) {
      if (s < ranges[i].e && ranges[i].s < e) return true;
    }
    return false;
  }

  // 文章を調べて、伏せる範囲の一覧を返す
  function analyze(input, refDate) {
    var text = normalize(input);
    var ref = refDate || new Date();
    var ranges = [];
    RULES.forEach(function (r) {
      r.re.lastIndex = 0;
      var m;
      while ((m = r.re.exec(text)) !== null) {
        if (m[0].length === 0) { r.re.lastIndex++; continue; }
        var hits = r.fn(m, text, ref) || [];
        hits.forEach(function (h) {
          if (h.e <= h.s) return;
          if (overlaps(ranges, h.s, h.e)) return;
          ranges.push({ s: h.s, e: h.e, label: h.label, repl: h.repl, kind: h.kind || 'mask', rule: r.name });
        });
      }
    });
    ranges.sort(function (a, b) { return a.s - b.s; });
    return { text: text, ranges: ranges };
  }

  function placeholder(r) { return r.repl !== undefined ? r.repl : '【' + r.label + '】'; }

  // 伏せた後の文章を作る（'suspect' はそのまま残す）
  function render(text, ranges) {
    var out = '', pos = 0, last = null;
    ranges.slice().sort(function (a, b) { return a.s - b.s; }).forEach(function (r) {
      if (r.kind !== 'mask') return;
      var ph = placeholder(r);
      // 隣り合った同じ種類の伏せ字は1つにまとめる（例：【施設名】【施設名】→【施設名】）
      if (!(r.s === pos && last === ph && r.repl === undefined)) out += text.slice(pos, r.s) + ph;
      last = ph;
      pos = r.e;
    });
    return out + text.slice(pos);
  }

  // 手で伏せる：選んだ範囲と重なるものを取り除いてから追加
  function addManual(ranges, s, e, label) {
    var kept = ranges.filter(function (r) { return !(s < r.e && r.s < e); });
    var ns = s, ne = e;
    ranges.forEach(function (r) { if (s < r.e && r.s < e) { ns = Math.min(ns, r.s); ne = Math.max(ne, r.e); } });
    kept.push({ s: ns, e: ne, label: label || '伏せ字', kind: 'mask', rule: '手動' });
    return kept.sort(function (a, b) { return a.s - b.s; });
  }
  // 元に戻す：選んだ範囲と重なるものを取り除く
  function removeRanges(ranges, s, e) {
    return ranges.filter(function (r) { return !(s < r.e && r.s < e) && !(s === e && r.s <= s && s <= r.e); });
  }
  function maskSuspects(ranges) {
    return ranges.map(function (r) { return r.kind === 'suspect' ? Object.assign({}, r, { kind: 'mask' }) : r; });
  }

  var api = { normalize: normalize, analyze: analyze, render: render, placeholder: placeholder,
    addManual: addManual, removeRanges: removeRanges, maskSuspects: maskSuspects, roundAge: roundAge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MaskRules = api;
})(this);
