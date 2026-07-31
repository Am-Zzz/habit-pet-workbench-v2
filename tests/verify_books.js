// -*- coding: utf-8 -*-
// 绘本功能专项验证：种子20本 / 合并 / 渲染 / 字段映射 / 封面覆盖 / 导入 / 我的绘本CRUD
// 运行：node tests/verify_books.mjs
// 与 tasks.test.js 同样的 jsdom 加载方式（合并 chars_data.js + 内联脚本）。
// 不加载 books_content.js（1.2MB 外部脚本），因此BOOK_CONTENT在jsdom为空，
// 断言只依赖“用户库(种子20本)”与 mergeBooks/renderBookList 行为，健壮不依赖内置数量。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'v8.html'), 'utf-8');
const chars = fs.readFileSync(path.join(ROOT, 'chars_data.js'), 'utf-8');

html = html.replace(/<script src="chars_data\.js"><\/script>/, '');
const inlineMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!inlineMatch) { console.error('could not find inline script'); process.exit(2); }
const combined = '<script>\n' + chars + '\n/* == merged inline == */\n' + inlineMatch[1] + '\n</script>';
html = html.replace(/<script>[\s\S]*?<\/script>/, combined);

const jsErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => jsErrors.push('JSERR: ' + (e && e.message ? e.message : String(e))));
vc.on('error', (...a) => jsErrors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/',
  virtualConsole: vc,
  beforeParse(window) {
    window.scrollTo = () => {};
    window.speechSynthesis = { speak(){}, cancel(){}, getVoices(){ return []; } };
    window.SpeechSynthesisUtterance = function(){};
    window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
    window.cancelAnimationFrame = id => clearTimeout(id);
    window.Audio = function(){ return { play(){}, pause(){}, load(){}, addEventListener(){} }; };
    window.HTMLCanvasElement.prototype.getContext = function(){
      return { fillRect(){}, clearRect(){}, getImageData(){ return []; }, putImageData(){},
        createImageData(){ return []; }, setTransform(){}, drawImage(){}, save(){}, restore(){},
        beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, stroke(){}, translate(){}, scale(){},
        rotate(){}, arc(){}, fill(){}, measureText(){ return { width: 0 }; }, transform(){}, rect(){}, clip(){} };
    };
    window.prompt = (msg, def) => (def !== undefined ? def : '测试模块');
    window.confirm = () => true;
    window.alert = () => {};
  }
});

const w = dom.window;
const d = w.document;
function G(expr){ return w.eval(expr); }
function S(stmt){ w.eval(stmt); }

let pass = 0, fail = 0;
function E(name, cond){ if (cond) { pass++; console.log('  ok :', name); } else { fail++; console.log('  FAIL:', name); } }

// 1. 种子数据量
E('SEED_BOOK_RAW 有 20 本', G('SEED_BOOK_RAW.length') === 20);

// 2. init 自动 seed 写入用户库
E('seed 后 getUserBooks 有 20 本', G('getUserBooks().length') === 20);

// 3. mergeBooks 至少包含 20 本种子书
E('mergeBooks 数量 >= 20', G('mergeBooks().length') >= 20);
const seedTitles = G('SEED_BOOK_RAW.map(function(b){return b.title;})');
const mergedTitles = G('mergeBooks().map(function(b){return b.title;})');
const allSeededPresent = seedTitles.every(t => mergedTitles.indexOf(t) >= 0);
E('mergeBooks 包含全部 20 本种子书', allSeededPresent);

// 4. renderBookList 把全部书渲染到 #bookList
S('renderBookList();');
E('renderBookList 渲染数 == mergeBooks 数', d.getElementById('bookList').children.length === G('mergeBooks().length'));

// 5. 字段映射：第一本种子书
const firstRaw = G('SEED_BOOK_RAW[0]');
const firstUser = G('getUserBooks()[0]');
E('种子书 desc <- intro', firstUser.desc === firstRaw.intro);
E('种子书 pages 是数组且含 chars', Array.isArray(firstUser.pages) && firstUser.pages.length > 0 && Array.isArray(firstUser.pages[0].chars));
E('种子书 age 经 diffToAge 映射', firstUser.age === G('diffToAge(' + JSON.stringify(firstRaw.difficulty) + ')'));
E('种子书 tags 为数组且有值', Array.isArray(firstUser.tags) && firstUser.tags.length > 0);

// 6. transformRawBook 映射测试（用超过40字长文，触发按标点分页为>=2页）
const tr = G("transformRawBook({icon:'🍎',title:'测',intro:'简介',storyContent:'一。二。三。四。五。六。七。八。九。十。十一。十二。十三。十四。十五。十六。十七。十八。十九。二十。',difficulty:'初级',tags:['a','b']})");
E('transformRawBook.desc <- intro', tr.desc === '简介');
E('transformRawBook.pages 按标点分页(>=2)', Array.isArray(tr.pages) && tr.pages.length >= 2);
E('transformRawBook.age <- diffToAge(初级)', tr.age === '小学1-3');
E('transformRawBook.tags <- tags', Array.isArray(tr.tags) && tr.tags.join() === 'a,b');

// 7. 封面覆盖（getBookCover / setBookCover）
const coverId = firstUser.id;
S("setBookCover('" + coverId + "','DATAURL_X');");
E('setBookCover 后 getBookCover 返回覆盖值', G("getBookCover('" + coverId + "')") === 'DATAURL_X');
S("setBookCover('" + coverId + "','');");
E('移除封面后回退到 book.cover', G("getBookCover('" + coverId + "')") === (G("findBook('" + coverId + "').cover") || ''));

// 8. looksLikeBook 判定（bug 修复根因：识别 Desktop JSON 形状）
// 说明：looksLikeBook 返回匹配字段(真值/假值)而非严格布尔，断言用 !! 取布尔
E('looksLikeBook 识别 {title,storyContent}', !!G("looksLikeBook({title:'x',storyContent:'y'})"));
E('looksLikeBook 拒绝非书对象', !G("looksLikeBook({foo:1})"));

// 9. importUserBooksData 新增一本（路径：importContent -> importUserBooksData）
const before = G('getUserBooks().length');
S("importUserBooksData([{icon:'🆕',title:'新增测试书',intro:'x',storyContent:'内容一。内容二。',difficulty:'中级',tags:['t']}]);");
E('importUserBooksData 新增 1 本', G('getUserBooks().length') === before + 1);
const newId = G("getUserBooks().filter(function(b){return b.title==='新增测试书';})[0].id");
E('新增书可被 findBook 找到', !!G("findBook('" + newId + "')"));

// 10. 我的绘本渲染
S('openMyBooks();');
E('renderMyBooks 渲染数 == 用户书数', d.getElementById('mbList').children.length === G('getUserBooks().length'));

// 11. saveUserBook 表单新增
const before2 = G('getUserBooks().length');
S("document.getElementById('mbFTitle').value='表单新增书';");
S("document.getElementById('mbFContent').value='表单内容一。表单内容二。';");
S('saveUserBook();');
E('saveUserBook 表单新增 1 本', G('getUserBooks().length') === before2 + 1);
const formId = G("getUserBooks().filter(function(b){return b.title==='表单新增书';})[0].id");
E('表单新增书可 findBook', !!G("findBook('" + formId + "')"));

// 12. deleteUserBook 删除（confirm=true）
const before3 = G('getUserBooks().length');
S("deleteUserBook('" + formId + "');");
E('deleteUserBook 删除 1 本', G('getUserBooks().length') === before3 - 1);

// 13. exportUserBooks 接线正确（jsdom 未实现 Blob/URL.createObjectURL，仅校验函数存在与数据可序列化）
E('exportUserBooks 函数已接线', typeof G('exportUserBooks') === 'function');
let exportDataOk = true;
try { JSON.stringify(G('getUserBooks()')); } catch (e) { exportDataOk = false; }
E('用户书数据可 JSON 序列化(导出基础)', exportDataOk);

console.log('\nBOOKS_PASS=' + pass + '  BOOKS_FAIL=' + fail + '  JS_ERRORS=' + jsErrors.length);
if (jsErrors.length) { jsErrors.slice(0, 12).forEach(e => console.log('  ERR:', e)); }
process.exit(fail === 0 && jsErrors.length === 0 ? 0 : 1);
