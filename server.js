const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000;
const server=http.createServer((req,res)=>{fs.readFile(path.join(__dirname,'index.html'),(e,d)=>{
  if(e){res.writeHead(500);return res.end('Falta index.html junto a server.js')}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(d)})});
const wss=new WebSocketServer({server,maxPayload:1<<20});
const rooms=new Map();
const ips=()=>Object.values(os.networkInterfaces()).flat().filter(i=>i&&i.family=='IPv4'&&!i.internal).map(i=>i.address);
const send=(ws,m)=>{if(ws.readyState==1)ws.send(JSON.stringify(m))};
wss.on('connection',ws=>{
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m.t=='host'&&!ws.room){
      let c;do{c=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('')}while(rooms.has(c));
      const r={code:c,host:ws,peers:new Map()};rooms.set(c,r);ws.room=r;ws.id=0;
      send(ws,{t:'hosted',code:c,ips:ips(),port:PORT});console.log('Sala creada:',c);
    }else if(m.t=='join'&&!ws.room){
      const r=rooms.get(String(m.code||'').toUpperCase());
      if(!r)return send(ws,{t:'err',m:'Esa sala no existe'});
      let id=1;while(r.peers.has(id))id++;
      if(id>3)return send(ws,{t:'err',m:'La sala está llena (máximo 4)'});
      r.peers.set(id,ws);ws.room=r;ws.id=id;
      send(ws,{t:'joined',id,code:r.code});send(r.host,{t:'peer',id});console.log('Entró J'+(id+1)+' a',r.code);
    }else if(ws.room){
      const r=ws.room;
      if(ws.id==0){for(const p of r.peers.values())send(p,m)}
      else if(m.t=='in'){m.id=ws.id;send(r.host,m)}
    }
  });
  ws.on('close',()=>{
    const r=ws.room;if(!r)return;
    if(ws.id==0){for(const p of r.peers.values()){send(p,{t:'closed'});p.close()}rooms.delete(r.code);console.log('Sala cerrada:',r.code)}
    else{r.peers.delete(ws.id);send(r.host,{t:'leave',id:ws.id})}
  });
});
server.listen(PORT,'0.0.0.0',()=>{
  console.log('Granja Zombie online listo');
  console.log('  En esta PC:  http://localhost:'+PORT);
  ips().forEach(i=>console.log('  Otros dispositivos (misma WiFi):  http://'+i+':'+PORT));
});
