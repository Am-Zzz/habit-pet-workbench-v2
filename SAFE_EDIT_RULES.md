# v8.html 安全编辑规范（团队硬性规则）

> 目的：v8.html 是一个 268KB 的单文件应用（HTML+内联 CSS+内联 JS）。它**没有构建步骤、没有模块系统**，所有逻辑直接挂在全局。这种结构极度脆弱——任何"随手改一处"都可能让整页在首屏直接崩。
> 本规范把历史上真实发生过的事故（TDZ 整页崩、脚本被重复追加、引号转义报错）固化成**禁止项 + 正确做法**，所有改动（无论人工还是 AI 助手）都必须遵守。

---

## 🔴 红线（违反即可能整页崩溃）

### 1. 禁止「正则 / 字符串手术式」改文件
- ❌ 写 `_xxx.py` 用 `s.replace(...)` / `re.sub(...)` 对 3900 行 HTML 做整段替换。
- 这是**头号事故源**：曾因 `s.index('</script>')` 命中错误的脚本标签，把整段内联脚本重复追加两次，导致 `let mgmtData` / `function init` 各出现两遍，触发 TDZ 连锁崩溃。
- ✅ 正确做法：
  - **直接编辑** `v8.html`（用编辑工具精确替换，而非整段重写）；
  - 若必须批量改，用**带唯一锚点的结构化 patch**（先 `Read` 定位精确上下文，再 `Edit` 局部替换），绝不对整文件做无锚点字符串替换。

### 2. 全局声明顺序 —— 防 TDZ
- ❌ 在 `let` / `const` 全局**声明之前**调用使用它的函数。
- 真实案例：原脚本顶部有 `loadMgmt();renderCheckins();renderStudies();` 初始化块，而 `let MODULES=[]` 被放在这段**之后**，导致 `renderStudies()` 访问 `MODULES` 时处于 TDZ（Cannot access 'MODULES' before initialization），整段脚本中断，其后所有全局（`GAMES`/`STORE_ITEMS`/`PERM_KEY` 等）全没初始化。
- ✅ 正确做法：**所有顶层 `let`/`const`（MODULES、mgmtData、GAMES、STORE_ITEMS、PERM_KEY、gamePerm、CHECKIN_KEY、GAMESCORE…）必须集中在文件最顶部声明**，任何会在加载期执行的初始化调用（含 `init()`）放在它们之后。

### 3. 禁止重复 DOM id
- ❌ 两个元素用同一个 `id`。会静默破坏 `getElementById` / 测试断言。
- ✅ 已有 306 个 id 零重复，新增必须全局查重（Grep `id="xxx"`）。

---

## 🟠 易错点（不崩但会埋雷）

### 4. 动态拼接 HTML 时的引号转义
- ❌ 在**单引号 JS 字符串**里拼 `onclick="openModule('xxx')"` —— 内部双引号会与外层冲突，强行转义 `\'` 极易产生语法错误。
- ✅ 正确做法（已验证安全）：
  - **优先传数字索引**而非字符串：`onclick="openModuleByIdx(0)"`、`onclick="toggleStudy(3)"`，彻底避免引号嵌套；
  - 若必须传字符串，用事件委托 / `addEventListener`，不要内联 onclick。

### 5. 禁止 `alert()`
- ❌ `alert()` 是阻塞式弹窗，破坏体验且难测试。
- ✅ 用已存在的 `toast()`（非阻塞轻提示）。

### 6. 禁止提交巨型数据 JSON
- ❌ `ci.json`(26MB) / `word.json`(27MB) / `idiom.json`(10MB) 等语料入库会永久膨胀仓库。
- ✅ 这些已在 `.gitignore` 排除。运行时只需 `chars_data.js` 与 `mengchong_content.json`，**只提交这两个**。

---

## 🟢 改动流程（每次改完必做）

1. **改前**：`git pull` / 确认基于最新提交。
2. **改中**：遵守上面 1–6 条；一次只做一类改动。
3. **改完**：**必须跑 `npm test`**（两套 jsdom 回归，共 ~69 项检查）。
   - 全绿 + `JS_ERRORS=0` 才算通过；有任何 FAIL / JS 错误**禁止提交**，先修。
4. **提交**：
   - 提交信息前缀：`feat:`（新功能）/ `fix:`（修 bug）/ `refactor:`（重构）/ `docs:`（文档）/ `test:`（测试）。
   - 例：`fix: 将 let MODULES 前置防止首屏 TDZ 崩溃`
   - **一个功能一个提交**，不要攒一大坨。
5. **禁止**把 `_*.py` / `_*.js` 临时脚本、`*.bak`、`deploy/` 提交入库（已在 `.gitignore`）。

---

## 🧪 测试说明（质量门禁）
- `tests/tasks.test.js`：底部导航 / 商城 / 学习乐园 / 家长模式增删 / 4 款游戏引擎 / 首页打卡 / 扭蛋机入口。
- `tests/gacha.test.js`：学习扭蛋机全功能（答题、抽卡、错题本、奖励权重、商店）。
- 运行：`npm test`（= 两个文件依次执行）。
- 实现要点：测试用 jsdom 以浏览器级方式执行页面，并把 `chars_data.js` 与内联脚本**合并为同一个 `<script>`**，让顶层 `let`/`const` 共享词法作用域——这能真实复现 TDZ / 初始化顺序问题，是这套测试最有价值的地方。

---

## 📌 备注
- 当前仍是单文件巨石（268KB / 3911 行）。**长期目标**是拆成 数据层 / 状态层 / UI 层 / 游戏层 四模块（见 code-quality-report.md 阶段 3）。在拆分完成前，上述红线是保命绳，务必遵守。
- 任何 AI 助手生成的改动，也必须走 `npm test` 这道闸，不能"看着像就对"。
