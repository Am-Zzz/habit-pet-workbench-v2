// -*- coding: utf-8 -*-
// 正式回归测试：学习扭蛋机(gacha) 全功能
// 运行：npm test  (本文件由 `node tests/gacha.test.js` 触发)
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'v8.html'), 'utf-8');
const data = fs.readFileSync(path.join(ROOT, 'chars_data.js'), 'utf-8');
html = html.replace('<script src="chars_data.js"></script>', '<script>' + data + '</script>');

const vc = new VirtualConsole();
let errs = [];
vc.on('jsdomError', e => errs.push(e.message));
vc.on('error', e => errs.push('console.error: ' + e));

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc,
  beforeParse(window) {
    window.scrollTo = () => {};
    window.speechSynthesis = { speak(){}, getVoices(){ return []; } };
    window.SpeechSynthesisUtterance = function(){};
    const c = window.HTMLCanvasElement.prototype;
    c.getContext = () => ({ scale(){}, clearRect(){}, fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, fillText(){}, save(){}, restore(){}, font:0, strokeStyle:0, fillStyle:0, lineWidth:0, lineCap:0, lineJoin:0 });
  }
});
const { window } = dom;

let pass = 0, fail = 0;
function chk(n, c){ if(c){ pass++; } else { fail++; console.log('FAIL', n); } }
function E(code){ try{ return window.eval(code); } catch(e){ console.log('  EVAL ERR ['+code+']:', e.message); fail++; return undefined; } }

chk('init 无 jsdomError', errs.length === 0);
if(errs.length) console.log('  errs:', errs.slice(0, 3));

chk('sc-gacha 存在', !!window.document.getElementById('sc-gacha'));
chk('游戏中心含扭蛋机入口', E("GAMES.some(function(g){return g.screen==='gacha';})") === true);
chk('go(gacha) 切屏', E("go('gacha'); document.getElementById('sc-gacha').classList.contains('on')") === true);
chk('题库载入 17', E('gachaQuestions.length') === 17);
chk('奖励载入 5', E('gachaRewards.length') === 5);
chk('初始硬币0', E('gachaCoins') === 0);
chk('顶部硬币显示0', window.document.getElementById('gachaCoins').textContent === '0');

E("startGachaQuiz()");
chk('答题视图开启', E("document.getElementById('gv-quiz').classList.contains('on')") === true);
chk('题目渲染有选项', E("document.querySelectorAll('#gqCard .gq-opt').length") >= 2);
E("var __q=gachaCur; answerGacha(__q.ans);");
chk('答对后硬币+1', E('gachaCoins') === 1);
chk('答对后库存+1', E('gachaStock') === 1);

E("startGachaQuiz(); var __q2=gachaCur; var __w=(__q2.ans+1)%__q2.opts.length; answerGacha(__w);");
chk('答错入错题本', E('gachaWrong.length') >= 1);
chk('错题结构完整', E("gachaWrong[0].q && gachaWrong[0].opts && typeof gachaWrong[0].ans==='number'"));

E("var __r=Math.random; Math.random=function(){return 0;}; gachaCoins=5; gachaStock=5; renderGachaTop(); drawGacha(); Math.random=__r;");
chk('抽后硬币-1', E('gachaCoins') === 4);
chk('抽后库存-1', E('gachaStock') === 4);
chk('最近奖励+1', E('gachaRecent.length') === 1);
chk('抽中奖励在列表', E("gachaRecent[0] && gachaRewards.some(r=>r.name===gachaRecent[0].name)"));
chk('加权抽奖励返回', E("weightedGachaReward() !== null"));

E("gachaMgtShow('bank', document.querySelector('#gachaMgtTabs button'));");
chk('题库管理渲染', E("document.getElementById('gachaMgtBody').innerHTML.length>0"));
E("document.getElementById('qbCat').value='arith'; document.getElementById('qbQ').value='测试题？'; ['A','B','C','D'].forEach((o,i)=>document.getElementById('qbO'+i).value=o); addGachaQ();");
chk('手动加题成功', E("gachaQuestions.some(q=>q.q==='测试题？')"));
E("aiGenGachaQ();");
chk('AI生成填充题目', E("document.getElementById('qbQ').value.length>0"));
E("var __tid=gachaQuestions.find(q=>q.q==='测试题？').id; deleteGachaQ(__tid);");
chk('删题成功', E("!gachaQuestions.some(q=>q.q==='测试题？')"));

E("gachaMgtShow('wrong', document.querySelector('#gachaMgtTabs button'));");
chk('错题视图渲染', E("document.getElementById('gachaMgtBody').innerHTML.length>0"));
chk('错题含正确高亮', E("document.querySelectorAll('#gachaMgtBody .wc-opt.correct').length>0"));
E("exportGachaWrong();");
chk('导出不抛错', true);

E("gachaMgtShow('reward', document.querySelector('#gachaMgtTabs button'));");
E("document.getElementById('rwName').value='测试奖励'; document.getElementById('rwType').value='points'; document.getElementById('rwVal').value='5'; document.getElementById('rwW').value='8'; addGachaReward();");
chk('奖励新增', E("gachaRewards.some(r=>r.name==='测试奖励')"));
E("var __rid=gachaRewards.find(r=>r.name==='测试奖励').id; setRewardWeight(__rid,'15');");
chk('权重修改', E("gachaRewards.find(r=>r.name==='测试奖励').weight===15"));
E("var __rid2=gachaRewards.find(r=>r.name==='测试奖励').id; toggleReward(__rid2);");
chk('奖励启停', E("gachaRewards.find(r=>r.name==='测试奖励').enabled===false"));
E("gachaMgtShow('prob', document.querySelector('#gachaMgtTabs button'));");
chk('概率视图渲染', E("document.querySelectorAll('#gachaMgtBody .prob-bar').length>0"));

E("gachaPoints=100; renderGachaStore();");
chk('商店渲染4项', E("document.querySelectorAll('#gachaStore .store-item').length") === 4);
E("buyGachaItem('cap');");
chk('扩容购买容量150', E('gachaCapacity') === 150);
chk('购买扣积分', E('gachaPoints') === 60);
E("buyGachaItem('deco_gold');");
chk('金色皮肤装备', E('gachaDeco.gold') === true);
chk('机身class添加', E("document.getElementById('gachaMachine').classList.contains('gacha-gold')"));

console.log('\nRESULT pass=' + pass + ' fail=' + fail + ' jsdomErr=' + errs.length);
process.exit(fail > 0 || errs.length > 0 ? 1 : 0);
