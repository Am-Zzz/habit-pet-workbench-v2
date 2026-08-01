// -*- coding: utf-8 -*-
// 验证网盘导入（百度/夸克）链路：粘贴链接 -> 导入存储 -> 渲染(直链可播/分享页跳转) -> 删除
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

console.log('== 网盘导入验证 ==');
S("document.getElementById('netLinks').value = 'https://pan.baidu.com/s/abc123  提取码: x7y9\\nhttps://cdn.example.com/story.mp3';");
S("document.getElementById('netKind').value = 'audio';");
S("importNetLinks();");

// 把关键值抽到 window 变量，避免嵌套括号/正则引发的解析问题
S("var __items = getNetItems();");
S("var __baidu = __items.filter(function(x){return /pan\\.baidu\\.com/.test(x.url);})[0];");
S("var __mp3 = __items.filter(function(x){return /story\\.mp3$/.test(x.url);})[0];");
S("var __list = document.getElementById('netList').innerHTML;");

E('导入 2 条网盘内容', G("__items.length") === 2);
E('百度分享链接识别并带提取码', G("__baidu && __baidu.code === 'x7y9'"));
E('百度项标题自动推导', G("__baidu && __baidu.title === '百度网盘内容(x7y9)'"));
E('直链 .mp3 标记为可播放', G("__mp3 && __mp3.playable === true"));
E('渲染列表含 audio 直听控件', /<audio[^>]*controls/.test(G("__list")));
E('渲染列表含去网盘跳转按钮', /去网盘收听\/查看/.test(G("__list")));

S("deleteNetItem(__baidu.id);");
S("var __items2 = getNetItems();");
S("var __list2 = document.getElementById('netList').innerHTML;");
E('删除后剩 1 条', G("__items2.length") === 1);
S("var __lst2ok = /story\\.mp3/.test(__list2) && !/pan\\.baidu/.test(__list2);");
E('删除后渲染只剩直链项', G("__lst2ok") === true);

E('无 JS 错误', jsErrors.length === 0);
if(jsErrors.length) console.log(jsErrors.join('\n'));

console.log('\n结果: PASS=' + pass + ' FAIL=' + fail + ' JS_ERRORS=' + jsErrors.length);
process.exit(fail ? 1 : 0);
