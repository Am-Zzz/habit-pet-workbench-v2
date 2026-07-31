const http=require('http'),fs=require('fs'),path=require('path');
const root=path.normalize('D:/workbuddy/2026-07-28-09-47-37/habit-pet-workbench');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const AI_CFG=path.join(root,'ai_config.json');

function setCORS(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
function readBody(req){return new Promise(function(res,rej){let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{res(b?JSON.parse(b):{});}catch(e){rej(e);}});});}
function readAiCfg(){try{return JSON.parse(fs.readFileSync(AI_CFG,'utf8'));}catch(e){return null;}}
function sendJSON(res,code,obj){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));}

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
