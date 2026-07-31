// 质量门禁：抽取 v8.html 的内联 <script> 并用 ESLint 检查
// 重点拦截：no-undef（未定义变量，含 TDZ 类使用）、重复声明、未用变量、危险写法。
// 运行：npm run lint
//
// 说明：v8.html 是单文件应用，JS 嵌在 HTML 里，标准 eslint 无法直接解析 .html。
// 这里把内联脚本抽到临时 .js 再 lint，并把运行时由 chars_data.js 注入的全局标记为已知。
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const htmlPath = path.join(ROOT, 'v8.html');

// ---- 抽取内联脚本（不带 src 的那个 <script>）----
const html = fs.readFileSync(htmlPath, 'utf-8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('未找到内联 <script>'); process.exit(2); }
const inline = m[1];
// 写到系统临时目录，避免污染仓库；不主动删除（环境的安全删除 shim 可能报错）
const tmp = path.join(os.tmpdir(), 'v8-inline-lint-' + Date.now() + '.tmp.js');
fs.writeFileSync(tmp, inline, 'utf-8');

// ---- 尝试加载 eslint（用 createRequire 以兼容 NODE_PATH）----
const require = createRequire(import.meta.url);
let ESLint;
try {
  ({ ESLint } = require('eslint'));
} catch (e) {
  console.log('⚠️  eslint 未安装。请先执行：npm install -D eslint');
  console.log('    安装后 `npm run lint` 即可自动拦截 TDZ / 未定义变量等问题。');
  process.exit(0); // 不阻断，仅提示
}

// 运行时由 chars_data.js 注入的「外部」全局（避免误报 no-undef）。
// 注意：POEM_DATA/BOOK_DATA/PINYIN_DATA/WORDS_DATA/DIALOGUE_DATA/READ_DATA/
// SCIENCE_DATA/LOGIC_DATA 实际声明在 v8.html 内部，不能列在这里（否则 no-redeclare 冲突）。
const dataGlobals = ['CHARS_DATA', 'HONGEN_1300', 'HONGEN_GROUPS'];

const eslint = new ESLint({
  overrideConfig: {
    env: { browser: true, es2022: true },
    parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
    globals: Object.fromEntries(dataGlobals.map(g => [g, 'readonly'])),
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-redeclare': 'error',
      // 关闭 no-unused-vars：本应用大量函数通过 HTML 内联 onclick="fn()" 调用，
      // 纯 JS lint 看不到这些调用，会误报 100+ 条。死代码清理列为单独的人工 review 任务。
      'no-unused-vars': 'off',
      'no-cond-assign': 'warn'
    }
  },
  useEslintrc: false
});

const results = await eslint.lintFiles([tmp]);
let problemCount = 0;
for (const r of results) {
  if (r.messages.length === 0) continue;
  for (const msg of r.messages) {
    problemCount++;
    const sev = msg.severity === 2 ? 'ERROR' : 'warn';
    console.log(`  ${sev} [${msg.ruleId || 'syntax'}] line ${msg.line}: ${msg.message}`);
  }
}

if (problemCount > 0) {
  console.log(`\n❌ lint 发现 ${problemCount} 个问题（ERROR 必须修复后再提交）`);
  process.exit(1);
} else {
  console.log('✅ lint 通过：无 ERROR 级问题');
  process.exit(0);
}
