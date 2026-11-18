const R = require('../mask/rules.js');
const t = require('fs').readFileSync(__dirname + '/no_pii.txt', 'utf8');
const res = R.analyze(t, new Date(2026, 10, 18));
res.ranges.forEach(r => console.log(r.kind, r.rule, JSON.stringify(res.text.slice(r.s, r.e)), '->', R.placeholder(r)));
