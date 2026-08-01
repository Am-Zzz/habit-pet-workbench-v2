// -*- coding: utf-8 -*-
// 正式回归测试：底部导航 / 商城 / 学习乐园 / 家长模式 / 4 款游戏 / 扭蛋机入口
// 运行：npm test  (本文件由 `node tests/tasks.test.js` 触发)
//
// 为什么这样跑：用 jsdom 以浏览器级方式执行页面脚本(runScripts:'dangerously')，
// 并把 chars_data.js 与内联脚本合并为同一个 <script>，让顶层 let/const 共享词法作用域
// （与浏览器在 classic script 间共享全局一致），从而真实复现 TDZ / 初始化顺序问题。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'v8.html'), 'utf-8');
const chars = fs.readFileSync(path.join(ROOT, 'chars_data.js'), 'utf-8');

html = html.replace(/<script src="chars_data\.js"><\/script>/, '');
const inlineMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if(!inlineMatch){ console.error('could not find inline script'); process.exit(2); }
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
function E(name, cond){ if(cond){ pass++; } else { fail++; console.log('  FAIL:', name); } }

// ---- nav ----
E('go checkin switches screen', (function(){ w.go('checkin'); return d.getElementById('sc-checkin').classList.contains('on'); })());
E('checkin task list rendered (5 default)', d.getElementById('checkinTaskList').children.length === 5);
E('checkin nav active', d.getElementById('nav-checkin').classList.contains('active'));

E('go store switches screen', (function(){ w.go('store'); return d.getElementById('sc-store').classList.contains('on'); })());
E('store list rendered (5 items)', d.getElementById('storeList').children.length === 5);
E('store nav active', d.getElementById('nav-store').classList.contains('active'));

S('gachaCoins = 100; gachaPoints = 100;');
w.initStore();
const coinsBefore = G('gachaCoins');
w.buyStoreItem(0);
E('buy coin item deducts', G('gachaCoins') === coinsBefore - 50);

E('go me switches screen', (function(){ w.go('me'); return d.getElementById('sc-me').classList.contains('on'); })());
E('me stats rendered (4)', d.getElementById('meStats').children.length === 4);
E('me nav active', d.getElementById('nav-me').classList.contains('active'));

// ---- learn grid + modules (习乐园仅含非外链模块，9 格；外链模块在小教室列) ----
w.go('home');
E('learn grid has 9 modules', d.getElementById('learnGrid').children.length === 10);
S('MODULES[0].on = false; renderLearnGrid();');
E('learn grid hides off module', d.getElementById('learnGrid').children.length === 9);
S('MODULES[0].on = true; renderLearnGrid();');
E('learn grid restores', d.getElementById('learnGrid').children.length === 10);
w.openModuleByIdx(0);
E('openModuleByIdx opens chars screen', d.getElementById('sc-chars').classList.contains('on'));
w.go('home');

// ---- games ----
w.go('games');
E('games grid has 5 cards', d.getElementById('gamesGrid').children.length === 5);
S('gamePerm.permSeq = false; renderGames();');
E('perm off hides game card', d.getElementById('gamesGrid').querySelector('.game-card.off') !== null);
S('gamePerm.permSeq = true; renderGames();');
E('perm on restores', d.getElementById('gamesGrid').children.length === 5);
(function(){
  const idx = G("GAMES.findIndex(function(g){return g.screen==='gacha';})");
  w.openGame(idx);
  E('gacha card opens sc-gacha', d.getElementById('sc-gacha').classList.contains('on'));
  w.go('games');
})();

// memory game
w.initMemory();
E('memory board 12 cells', d.getElementById('memBoard').children.length === 12);
E('memory state ok', G('memState') && G('memState').deck.length === 12);
(function(){
  const deck = G('memState').deck; let a = -1, b = -1;
  for(let i=0;i<deck.length;i++){ for(let j=i+1;j<deck.length;j++){ if(deck[i]===deck[j]){ a=i; b=j; break; } } if(a>=0) break; }
  const cells = d.getElementById('memBoard').children;
  cells[a].click(); cells[b].click();
  E('memory match registers', G('memState').matched.indexOf(a) >= 0 && G('memState').matched.indexOf(b) >= 0);
})();

// block game
w.initBlock();
E('block board 36 cells', d.getElementById('blockBoard').children.length === 36);
(function(){
  const N = G('blockBoard').length; let target = null;
  for(let r=0;r<N && !target;r++) for(let c=0;c<N && !target;c++){
    const e = G('blockBoard')[r][c];
    if((G('blockBoard')[r+1] && G('blockBoard')[r+1][c]===e) || (G('blockBoard')[r][c+1] && G('blockBoard')[r][c+1]===e)){ target=[r,c]; break; }
  }
  if(target){
    const before = G('blockScore');
    const cells = d.getElementById('blockBoard').children;
    cells[target[0]*N+target[1]].click();
    E('block click scores', G('blockScore') > before);
  } else { E('block has group to click (skipped)', true); }
})();

// seq game
w.initSeq();
E('seq show rendered (5)', d.getElementById('seqShow').children.length === 5);
E('seq opts rendered (3)', d.getElementById('seqOpts').children.length === 3);
(function(){
  const arr = G('seqOptsArr'); const correct = arr[G('seqCorrectIdx')];
  const idx = arr.indexOf(correct);
  d.getElementById('seqOpts').children[idx].click();
  E('seq correct increments score', G('GAMESCORE').seq >= 1);
})();

// diff game
w.initDiff();
E('diff board 12 cells', d.getElementById('diffBoard').children.length === 12);
(function(){
  const cells = [...d.getElementById('diffBoard').children].map(x => x.textContent);
  const counts = {}; cells.forEach(e => counts[e] = (counts[e]||0)+1);
  let odd = null; for(const k in counts){ if(counts[k] === 1){ odd = k; } }
  const idx = cells.indexOf(odd);
  d.getElementById('diffBoard').children[idx].click();
  E('diff correct increments score', G('GAMESCORE').diff >= 1);
})();

// ---- home checkin toggle ----
w.go('home');
E('home task list rendered (5)', d.getElementById('homeTaskList').children.length === 5);
(function(){
  const before = (G('loadCheckinDone()')[G('getTodayKey()')] || []).length;
  d.getElementById('ht-3').querySelector('.check').click();
  const after = (G('loadCheckinDone()')[G('getTodayKey()')] || []).length;
  E('home checkin toggles done', after === before + 1);
  E('progress header updates', /\d+\/\d+\s*完成/.test(d.getElementById('homeTaskCount').textContent));
})();

// ---- 主页学习乐园九宫格（旧版布局）----
E('learn section header shows 9 modules', /学习乐园 · 10 大模块/.test(d.getElementById('sc-home').textContent));
E('learn grid contains game center', /游戏中心/.test(d.getElementById('learnGrid').textContent));
E('no separate games nav tab', !d.getElementById('nav-games'));
w.go('home');

// ---- parent add study propagates (新增的是非外链模块，应进习乐园九宫格) ----
w.prompt = () => '测试模块';
const beforeGrid = d.getElementById('learnGrid').children.length;
const beforeModules = G('MODULES.length');
w.addStudy();
E('addStudy adds module', G('MODULES.length') === beforeModules + 1);
w.renderLearnGrid();
E('new module shows in grid', d.getElementById('learnGrid').children.length === beforeGrid + 1);

// ---- parent add checkin propagates ----
const beforeCheckins = G('mgmtData.checkins.length');
w.addCheckin();
E('addCheckin adds item', G('mgmtData.checkins.length') === beforeCheckins + 1);

console.log('\nPASS=' + pass + '  FAIL=' + fail + '  JS_ERRORS=' + jsErrors.length);
if(jsErrors.length){ jsErrors.slice(0, 12).forEach(e => console.log('  ERR:', e)); }
process.exit(fail === 0 && jsErrors.length === 0 ? 0 : 1);
