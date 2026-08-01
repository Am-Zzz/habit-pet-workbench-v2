// -*- coding: utf-8 -*-
// 验证网盘导入（百度/夸克）三板块链路：
//   选板块 -> 粘贴链接(分享页/直链) -> 导入存储 -> 渲染(直链可播放/分享页跳转) -> 删除
// 设计：音频板直链(.mp3/.m4a)用 <audio> 直听；视频板直链(.mp4/.webm)用 <video> 直看；
//       百度/夸克分享页链接只能「打开网盘」(登录后观看/收听/下载)。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'v8.html'), 'utf-8');
const chars = fs.readFileSync(path.join(ROOT, 'chars_data.js'), 'utf-8');

html = html.replace(/<script src="chars_data\.js"><\/script>/, '');
const inlineMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const combined = '<script>\n' + chars + '\n/* == merged inline == */\n' + inlineMatch[1] + '\n</script>';
html = html.replace(/<script>[\s\S]*?<\/script>/, combined);

const jsErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => jsErrors.push('JSERR: ' + (e && e.message ? e.message : String(e))));
vc.on('error', (...a) => jsErrors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'http://localhost/',
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
    window.confirm = () => true;
    window.alert = () => {};
    window.prompt = (m, def) => (def !== undefined ? def : 'x');
  }
});
const w = dom.window, d = w.document;
function G(e){ return w.eval(e); }
function S(s){ w.eval(s); }

let pass = 0, fail = 0;
function E(name, cond){ if(cond){ pass++; console.log('  ok ', name); } else { fail++; console.log('  XX ', name); } }

console.log('== 网盘导入验证（动画/绘本/故事 三板块）==');

// ---- 故事音频板：百度分享链接(带提取码) + 直链 .mp3 ----
S("document.getElementById('netBoard').value = 'audio';");
S("document.getElementById('netLinks').value = 'https://pan.baidu.com/s/abc123  提取码: x7y9\\nhttps://cdn.example.com/story.mp3';");
S("netTab='audio'; importNetLinks();");
S("var __items = getNetItems();");
S("var __baidu = __items.filter(function(x){return /pan\\.baidu\\.com/.test(x.url);})[0];");
S("var __mp3 = __items.filter(function(x){return /story\\.mp3$/.test(x.url);})[0];");
S("netTab='audio'; renderNetHub();");
S("var __hub = document.getElementById('netHubList').innerHTML;");

E('故事音频板导入 2 条', G("__items.length") === 2);
E('百度分享链接识别并带提取码', G("__baidu && __baidu.code === 'x7y9'"));
E('百度项标题自动推导', G("__baidu && __baidu.title === '百度网盘内容(x7y9)'"));
E('直链 .mp3 标记为可播放', G("__mp3 && __mp3.playable === true"));
E('音频板渲染含 <audio> 直听控件', /<audio[^>]*controls/.test(G("__hub")));
E('音频板渲染含「打开网盘」按钮', /打开网盘/.test(G("__hub")));
E('音频板渲染不含 <video>', !/<video/.test(G("__hub")));

// ---- 动画片板：百度分享链接 + 直链 .mp4 ----
S("document.getElementById('netBoard').value = 'video';");
S("document.getElementById('netLinks').value = 'https://pan.baidu.com/s/def456  提取码: a1b2\\nhttps://cdn.example.com/cartoon.mp4';");
S("netTab='video'; importNetLinks();");
S("var __items2 = getNetItems();");
S("var __mp4 = __items2.filter(function(x){return /cartoon\\.mp4$/.test(x.url);})[0];");
S("netTab='video'; renderNetHub();");
S("var __hub2 = document.getElementById('netHubList').innerHTML;");

E('累计导入 4 条', G("__items2.length") === 4);
E('直链 .mp4 标记为可播放', G("__mp4 && __mp4.playable === true"));
E('视频板渲染含 <video> 控件', /<video[^>]*controls/.test(G("__hub2")));
E('视频板渲染含「打开网盘」按钮', /打开网盘/.test(G("__hub2")));

// ---- 删除 ----
S("deleteNetItem(__baidu.id);");
S("var __items3 = getNetItems();");
E('删除百度项后剩 3 条', G("__items3.length") === 3);

// ---- 二次编辑 + 跳转 ----
E('netOpen 函数已定义（修复跳转）', typeof G("netOpen") === 'function');
S("editNetItem(__mp4.id);");
S("var __editOpen = document.getElementById('netEditPop').classList.contains('on');");
S("document.getElementById('netEditUrl').value='https://cdn.example.com/newcartoon.m4a';");
S("document.getElementById('netEditBoard').value='audio';");
S("netTab='audio'; saveNetEdit();");
S("var __after = getNetItem(__mp4.id);");
E('二次编辑：弹窗正确打开', G("__editOpen") === true);
E('二次编辑：链接已更新', G("__after && __after.url === 'https://cdn.example.com/newcartoon.m4a'"));
E('二次编辑：可跨板块移动(video→audio)', G("__after && __after.board === 'audio'"));
E('二次编辑：跨板块后按直链重算可播放', G("__after && __after.playable === true"));

E('无 JS 错误', jsErrors.length === 0);
if(jsErrors.length) console.log(jsErrors.join('\n'));

console.log('\n结果: PASS=' + pass + ' FAIL=' + fail + ' JS_ERRORS=' + jsErrors.length);
process.exit(fail ? 1 : 0);
