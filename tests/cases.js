const R = require('../mask/rules.js');
const ref = new Date(2026, 10, 18);
const cases = process.argv.slice(2).length ? process.argv.slice(2) : [
 '佐藤花子さん（68）が来院', '患者：伊藤一郎', '令和7年3月1日入院', '2026年11月18日', '11月20日再診予定',
 '昨年12/3に吐血', '6/1-6/5入院', '田中様', 'ご家族（長男 渡辺 健）に連絡', '紹介状：みどり野総合病院 消化器内科 加藤先生御侍史',
 '国立がん研究センター中央病院', '東大病院で手術', '北区在住', '大阪市北区梅田1丁目2-3に住む', 'Kさん', '〒150-0001',
 '被保険者番号：12345678', 'TEL 0312345678', 'yamada@example.com', '55歳女性、65y.o.', '9歳', '95歳', '主治医 高橋',
 '前医の斉藤先生', '近医内科', 'ふじの内科クリニック', '慶應義塾大学病院', '鈴木内科胃腸科', '生年 1950年3月5日生',
 '小野寺さん', '藤田保健衛生大学', '山田胃腸科医院',
];
for (const c of cases) { const r = R.analyze(c, ref); console.log(c.padEnd(30,'　'), '=>', R.render(r.text, r.ranges), r.ranges.filter(x=>x.kind==='suspect').map(x=>'[?'+r.text.slice(x.s,x.e)+']').join('')); }
