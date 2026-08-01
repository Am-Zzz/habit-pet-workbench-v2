const http=require('http'),fs=require('fs'),path=require('path');
const root=path.normalize('D:/workbuddy/2026-07-28-09-47-37/habit-pet-workbench');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const AI_CFG=path.join(root,'ai_config.json');

function setCORS(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
function readBody(req){return new Promise(function(res,rej){let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{res(b?JSON.parse(b):{});}catch(e){rej(e);}});});}
function readAiCfg(){try{return JSON.parse(fs.readFileSync(AI_CFG,'utf8'));}catch(e){return null;}}
function sendJSON(res,code,obj){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));}

// ===== 网盘解析代理辅助 =====
const NET_CFG=path.join(root,'netdisk_config.json');
function readNetCfg(){try{return JSON.parse(fs.readFileSync(NET_CFG,'utf8'));}catch(e){return {};}}
function writeNetCfg(o){try{fs.writeFileSync(NET_CFG,JSON.stringify(o,null,2));}catch(e){}}
function detectProvider(url){
  if(/aliyundrive\.com\/s\/|alipan\.com\/s\/|alywp\.net\/s\//.test(url))return 'aliyun';
  if(/pan\.baidu\.com/.test(url))return 'baidu';
  if(/quark\.cn|pan\.quark\.cn/.test(url))return 'quark';
  return '';
}
function postJSON(url,body,cookie,referer){
  const headers={'Content-Type':'application/json','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'};
  if(cookie)headers['Cookie']=cookie;
  if(referer)headers['Referer']=referer;
  return fetch(url,{method:'POST',headers:headers,body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){return {status:r.status,json:j};});});
}
// 阿里云盘：公开分享免登录即可解析出下载地址
async function resolveAliyun(shareUrl,pwd){
  const m=shareUrl.match(/\/s\/([A-Za-z0-9]+)/); if(!m)throw new Error('阿里云盘分享链接格式不对');
  const shareId=m[1];
  const lt=await postJSON('https://api.aliyundrive.com/v2/share/share_token',{share_id:shareId,share_pwd:pwd||''});
  const shareToken=lt.json&&lt.json.share_token; if(!shareToken)throw new Error('阿里云盘获取 share_token 失败：'+(lt.json&&lt.json.message||JSON.stringify(lt.json)));
  const list=await postJSON('https://api.aliyundrive.com/adrive/v3/share/file/list',{share_token:shareToken,parent_file_id:'root',limit:100,order_by:'name',order_direction:'ASC'});
  const items=(list.json&&list.json.items)||[]; if(!items.length)throw new Error('阿里云盘分享为空');
  const playable=items.find(function(x){return /video|audio/.test(x.mimeType||'')||/\.(mp4|webm|mkv|mov|mp3|m4a|flac|wav)$/i.test(x.name||'');})||items[0];
  const fileId=playable.file_id;
  const dl=await postJSON('https://api.aliyundrive.com/v2/file/get_download_url',{share_token:shareToken,file_id:fileId,drive_id:playable.drive_id||''});
  const durl=dl.json&&dl.json.url; if(!durl)throw new Error('阿里云盘获取下载地址失败：'+(dl.json&&dl.json.message||JSON.stringify(dl.json)));
  return {dlink:durl};
}
// 百度网盘：需要用户 BDUSS cookie（登录态代理）
async function resolveBaidu(cookie,shareUrl,pwd){
  const m=shareUrl.match(/s\/([A-Za-z0-9_-]+)/); if(!m)throw new Error('百度分享链接格式不对');
  let surl=m[1].replace(/^1/,''); const ts=Date.now();
  const C='BDUSS='+cookie;
  const ukR=await postJSON('https://pan.baidu.com/api/uk/surl?t='+ts,{shorturl:surl},C,'https://pan.baidu.com/');
  const uk=ukR.json&&ukR.json.uk; if(!uk)throw new Error('百度获取 uk 失败：'+(ukR.json&&ukR.json.errno!=null?('errno '+ukR.json.errno):JSON.stringify(ukR.json)));
  const pr=await postJSON('https://pan.baidu.com/share/params?t='+ts+'&channel=chunlei&web=1&app_id=250528&clienttype=0&dp-logid=&tid=&traceid=',{surl:surl,uk:uk},C,'https://pan.baidu.com/');
  const sekey=pr.json&&pr.json.data&&pr.json.data.sekey; const shareid=pr.json&&pr.json.data&&pr.json.data.shareid;
  if(!sekey)throw new Error('百度获取 sekey 失败：'+(pr.json&&pr.json.errno!=null?('errno '+pr.json.errno):JSON.stringify(pr.json)));
  const lr=await postJSON('https://pan.baidu.com/api/share/list?t='+ts+'&channel=chunlei&web=1&app_id=250528&clienttype=0',{surl:surl,uk:uk,shareid:shareid,sekey:sekey,page:1,num:10},C,'https://pan.baidu.com/');
  const rec=(lr.json&&lr.json.list&&lr.json.list[0]); if(!rec)throw new Error('百度分享无文件');
  const dr=await postJSON('https://pan.baidu.com/api/sharedown?app_id=250528&channel=chunlei&clienttype=0&web=1',{uk:uk,shareid:shareid,fs_id:rec.fs_id,sekey:sekey},C,'https://pan.baidu.com/');
  const dlink=(dr.json&&dr.json.list&&dr.json.list[0]&&dr.json.list[0].dlink); if(!dlink)throw new Error('百度获取 dlink 失败：'+(dr.json&&dr.json.errno!=null?('errno '+dr.json.errno):JSON.stringify(dr.json)));
  return {dlink:dlink,headers:{'Cookie':C,'Referer':'https://pan.baidu.com/'}};
}
// 夸克网盘：需要用户 cookie
async function resolveQuark(cookie,shareUrl,pwd){
  const m=shareUrl.match(/[?&]pwd_id=([A-Za-z0-9]+)/); if(!m)throw new Error('夸克分享链接格式不对（需含 pwd_id）');
  const pwdId=m[1];
  const tk=await postJSON('https://drive-pc.quark.cn/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc',{pwd_id:pwdId,passcode:pwd||''},cookie);
  const stoken=tk.json&&tk.json.data&&tk.json.data.stoken; if(!stoken)throw new Error('夸克获取 stoken 失败：'+(tk.json&&tk.json.message||JSON.stringify(tk.json)));
  const dt=await postJSON('https://drive-pc.quark.cn/1/clouddrive/share/sharepage/detail?pr=ucpro&fr=pc',{stoken:stoken,pwd_id:pwdId},cookie);
  const items=(dt.json&&dt.json.data&&dt.json.data.list)||[]; if(!items.length)throw new Error('夸克分享为空');
  const file=items.find(function(x){return /video|audio/.test(x.file_type||'')||/\.(mp4|webm|mkv|mov|mp3|m4a)$/i.test(x.file_name||'');})||items[0];
  const dl=await postJSON('https://drive-pc.quark.cn/1/clouddrive/share/sharepage/download?pr=ucpro&fr=pc',{stoken:stoken,pwd_id:pwdId,file_id:file.file_id},cookie);
  const durl=dl.json&&dl.json.data&&dl.json.data.download_url; if(!durl)throw new Error('夸克获取下载地址失败：'+(dl.json&&dl.json.message||JSON.stringify(dl.json)));
  return {dlink:durl,headers:{Cookie:cookie}};
}
// 带 Range 的流式代理，绕开网盘防盗链
function proxyStream(res,dlink,extraHeaders,req){
  const rng=req.headers['range'];
  let origin='https://pan.baidu.com/';
  try{origin=new URL(dlink).origin;}catch(e){}
  const hd={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Referer':origin,'Accept':'*/*'};
  if(rng)hd['Range']=rng;
  if(extraHeaders)Object.keys(extraHeaders).forEach(function(k){hd[k]=extraHeaders[k];});
  fetch(dlink,{headers:hd,redirect:'follow'}).then(function(up){
    const status=up.status; const h={};
    ['content-type','content-length','content-range','accept-ranges','cache-control','content-disposition'].forEach(function(k){const v=up.headers.get(k);if(v)h[k]=v;});
    res.writeHead(status,h);
    const body=up.body; if(!body){res.end();return;}
    const reader=body.getReader();
    function pump(){return reader.read().then(function(o){if(o.done){res.end();return;}res.write(Buffer.from(o.value));return pump();});}
    pump().catch(function(e){try{res.destroy();}catch(_){}});
  }).catch(function(e){try{res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});res.end('stream error: '+String(e&&e.message||e));}catch(_){}});
}

const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  // 预检
  if(req.method==='OPTIONS'){setCORS(res);res.writeHead(204);res.end();return;}

  // ===== AI 代理 =====
  if(p.indexOf('/api/ai/')===0){
    setCORS(res);
    const sub=p.replace('/api/ai/','').split('?')[0];
    if(sub==='config'){
      if(req.method==='GET'){const c=readAiCfg();return sendJSON(res,200,{configured:!!(c&&c.key),endpoint:c&&c.endpoint||'',model:c&&c.model||''});}
      if(req.method==='POST'){return readBody(req).then(function(d){const cfg={endpoint:(d.endpoint||'').replace(/\/+$/,''),key:d.key||'',model:d.model||''};fs.writeFileSync(AI_CFG,JSON.stringify(cfg,null,2));return sendJSON(res,200,{ok:true});}).catch(e=>sendJSON(res,400,{ok:false,err:String(e&&e.message||e)}));}
      return sendJSON(res,405,{ok:false});
    }
    // 需要 key 的接口
    const cfg=readAiCfg();
    if(!cfg||!cfg.key){return sendJSON(res,501,{ok:false,err:'未配置 AI：在家长设置填写 endpoint/key/model 并 node server.js'});}
    if(req.method!=='POST')return sendJSON(res,405,{ok:false});
    return readBody(req).then(function(body){
      const base=cfg.endpoint||'https://api.openai.com/v1';
      if(sub==='chat'){
        const payload={model:body.model||cfg.model||'gpt-4o-mini',messages:body.messages||[],temperature:body.temperature||0.8,stream:false};
        return fetch(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},body:JSON.stringify(payload)})
          .then(r=>r.json()).then(d=>{const reply=(d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||'';sendJSON(res,200,{reply:reply,raw:d});})
          .catch(e=>sendJSON(res,502,{ok:false,err:String(e&&e.message||e)}));
      }
      if(sub==='image'){
        const payload={model:body.model||cfg.model||'',prompt:body.prompt||'',n:1,size:body.size||'512x512'};
        let imgUrl=base+'/images/generations';
        // 部分厂商用 /v1/images/generations（base 已是 /v1 时避免重复）
        if(/\/v1$/.test(base))imgUrl=base+'/images/generations';
        return fetch(imgUrl,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},body:JSON.stringify(payload)})
          .then(r=>r.json()).then(d=>{const it=(d.data&&d.data[0])||{};const out=it.url?{url:it.url}:(it.b64_json?{b64:it.b64_json}:{});sendJSON(res,200,out);})
          .catch(e=>sendJSON(res,502,{ok:false,err:String(e&&e.message||e)}));
      }
      if(sub==='fetch'){
        const url=body.url;if(!url)return sendJSON(res,400,{ok:false,err:'缺少 url'});
        return fetch(url).then(r=>r.arrayBuffer()).then(buf=>{const b64=Buffer.from(buf).toString('base64');const ct=r.headers.get('content-type')||'image/jpeg';sendJSON(res,200,{dataUrl:'data:'+ct+';base64,'+b64});})
          .catch(e=>sendJSON(res,502,{ok:false,err:String(e&&e.message||e)}));
      }
      return sendJSON(res,404,{ok:false,err:'未知接口'});
    }).catch(e=>sendJSON(res,400,{ok:false,err:String(e&&e.message||e)}));
  }

  if(p==='/api/data'){
    if(req.method==='GET'){
      fs.readFile(path.join(root,'data.json'),'utf8',(e,data)=>{
        if(e){res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');return;}
        res.writeHead(200,{'Content-Type':'application/json'});res.end(data);
      });
      return;
    }
    if(req.method==='POST'){
      let body='';req.on('data',c=>body+=c);req.on('end',()=>{
        try{
          const obj=JSON.parse(body);
          const df=path.join(root,'data.json');
          if(fs.existsSync(df))fs.copyFileSync(df,path.join(root,'data.json.bak'));
          fs.writeFileSync(df+'.tmp',JSON.stringify(obj,null,2));
          fs.renameSync(df+'.tmp',df);
          res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');
        }catch(err){res.writeHead(500,{'Content-Type':'application/json'});res.end('{"ok":false,"err":"'+String(err&&err.message||err)+'"}');}
      });
      return;
    }
    res.writeHead(405);res.end('method not allowed');return;
  }
  // ===== 网盘解析 / 流式代理（百度 / 夸克 / 阿里云盘）=====
  if(p.indexOf('/api/netdisk/')===0){
    setCORS(res);
    const sub=p.replace('/api/netdisk/','').split('?')[0];
    if(sub==='config'){
      if(req.method==='GET'){const c=readNetCfg();return sendJSON(res,200,{baidu:!!c.baidu,quark:!!c.quark,aliyun:!!c.aliyun});}
      if(req.method==='POST'){return readBody(req).then(function(d){const c=readNetCfg();const prov=d.provider;if(!/^(baidu|quark|aliyun)$/.test(prov))return sendJSON(res,400,{ok:false,err:'未知网盘'});const cookie=(d.cookie||'').trim();if(cookie)c[prov]=cookie;else delete c[prov];writeNetCfg(c);return sendJSON(res,200,{ok:true,configured:!!cookie});}).catch(e=>sendJSON(res,400,{ok:false,err:String(e&&e.message||e)}));}
      return sendJSON(res,405,{ok:false});
    }
    if(sub==='resolve'){
      if(req.method!=='POST')return sendJSON(res,405,{ok:false});
      return readBody(req).then(async function(d){
        const url=d.url||''; const pwd=d.pwd||'';
        let provider=d.provider||detectProvider(url);
        const cfg=readNetCfg();
        try{
          if(provider==='aliyun'){ await resolveAliyun(url,pwd); return sendJSON(res,200,{ok:true,provider:'aliyun'}); }
          if(provider==='baidu'){ if(!cfg.baidu)return sendJSON(res,200,{ok:false,fallback:true,reason:'未配置百度网盘 cookie'}); await resolveBaidu(cfg.baidu,url,pwd); return sendJSON(res,200,{ok:true,provider:'baidu'}); }
          if(provider==='quark'){ if(!cfg.quark)return sendJSON(res,200,{ok:false,fallback:true,reason:'未配置夸克网盘 cookie'}); await resolveQuark(cfg.quark,url,pwd); return sendJSON(res,200,{ok:true,provider:'quark'}); }
          return sendJSON(res,200,{ok:false,fallback:true,reason:'不支持的网盘链接'});
        }catch(e){ return sendJSON(res,200,{ok:false,fallback:true,reason:String(e&&e.message||e)}); }
      }).catch(e=>sendJSON(res,400,{ok:false,err:String(e&&e.message||e)}));
    }
    if(sub==='stream'){
      const q=new URL(req.url,'http://localhost').searchParams;
      const provider=q.get('provider')||''; const share=q.get('share')||''; const pwd=q.get('pwd')||'';
      const cfg=readNetCfg();
      let promise;
      if(provider==='aliyun')promise=resolveAliyun(share,pwd);
      else if(provider==='baidu')promise=cfg.baidu?resolveBaidu(cfg.baidu,share,pwd):Promise.reject(new Error('未配置百度网盘 cookie'));
      else if(provider==='quark')promise=cfg.quark?resolveQuark(cfg.quark,share,pwd):Promise.reject(new Error('未配置夸克网盘 cookie'));
      else return sendJSON(res,400,{ok:false,err:'bad provider'});
      return promise.then(function(r){ return proxyStream(res,r.dlink,r.headers||{},req); })
        .catch(e=>{res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});res.end('解析失败：'+String(e&&e.message||e));});
    }
    return sendJSON(res,404,{ok:false,err:'未知接口'});
  }

  if(p==='/')p='/index.html';
  const fp=path.normalize(path.join(root,p));
  if(fp!==root && !fp.startsWith(root+path.sep)){res.writeHead(403);res.end('forbidden');return;}
  fs.readFile(fp,(e,data)=>{
    if(e){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(fp)]||'application/octet-stream'});
    res.end(data);
  });
});
server.listen(8124,'0.0.0.0',()=>console.log('SERVING_ON_8124_LAN + AI proxy'));
