// 数学题自校验证：直接从 v8.html 抽取真实的 MATH_LEVELS，实跑大量题目，
// 用题目字符串重算正确答案，断言生成的 ans 与之一致。
// 目的：确保出题逻辑（尤其是减法）答案正确，且 verifyMathProblem 能兜底。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'v8.html'), 'utf8');

// 与 v8.html 中一致的基础函数（gen 内会调用）
function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// 抽取 MATH_LEVELS 对象字面量
const start = src.indexOf('const MATH_LEVELS=');
if (start < 0) { console.error('未找到 MATH_LEVELS'); process.exit(1); }
const after = src.slice(start);
const brace = after.indexOf('{');
const endIdx = after.indexOf('\n  };');
if (endIdx < 0) { console.error('未找到 MATH_LEVELS 结束'); process.exit(1); }
const objText = after.slice(brace, endIdx + 4); // 包含末尾的 }
const MATH_LEVELS = eval('(' + objText + ')');

function recompute(q, p) {
  // 纯算式题：从 q 重算
  const m = String(q).match(/^(\d+)\s*([+\-−])\s*(\d+)$/);
  if (m) {
    const a = +m[1], b = +m[3];
    return a + (m[2] === '+' ? b : -b);
  }
  // 比较题：取 visual 中较大的
  if (p && p.visual && p.visual.type === 'compare') {
    return Math.max(p.visual.a, p.visual.b);
  }
  return null; // 无法判断则跳过
}

let bad = 0, checked = 0;
const N = 4000;
for (const k of ['yx', 'l13', 'cmp']) {
  for (let i = 0; i < N; i++) {
    const p = MATH_LEVELS[k].gen();
    const correct = recompute(p.q, p);
    if (correct === null) continue;
    checked++;
    if (p.ans !== correct) {
      bad++;
      if (bad <= 10) console.log('❌ BAD', k, '| q=', p.q, '| gen.ans=', p.ans, '| correct=', correct);
    }
  }
}
console.log(`校验题目数: ${checked} | 错误: ${bad}`);
// 定向验证用户报的 7-6 场景：构造减法并复算
const sample = MATH_LEVELS.yx.gen;
let hitSub = 0;
for (let i = 0; i < 20000 && hitSub < 5; i++) {
  const p = sample();
  const m = String(p.q).match(/^(\d+)\s*([+\-−])\s*(\d+)$/);
  if (m && m[2] !== '+') {
    const correct = +m[1] - +m[3];
    if (p.ans !== correct) { console.log('❌ 减法样例错误', p.q, p.ans, correct); bad++; }
    hitSub++;
  }
}
console.log(`减法定向样例命中: ${hitSub}`);
if (bad === 0) { console.log('✅ 全部通过：数学题答案正确'); process.exit(0); }
else { console.log('❌ 存在错误答案'); process.exit(1); }
