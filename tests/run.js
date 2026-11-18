const R = require('../mask/rules.js');
const fs = require('fs');
const text = fs.readFileSync(__dirname + '/sample.txt', 'utf8');
const res = R.analyze(text, new Date(2026, 10, 18));
console.log(R.render(res.text, res.ranges));
console.log('--- suspects');
res.ranges.filter(r => r.kind === 'suspect').forEach(r => console.log(r.rule, JSON.stringify(res.text.slice(r.s, r.e))));
console.log('--- masks');
res.ranges.filter(r => r.kind === 'mask').forEach(r => console.log(r.rule.padEnd(14), JSON.stringify(res.text.slice(r.s, r.e)), '->', R.placeholder(r)));
