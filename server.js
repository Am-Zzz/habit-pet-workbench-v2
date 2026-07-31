const http=require('http'),fs=require('fs'),path=require('path');
const root=path.normalize('D:/workbuddy/2026-07-28-09-47-37/habit-pet-workbench');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
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
}).listen(8124,'0.0.0.0',()=>console.log('SERVING_ON_8124_LAN'));
