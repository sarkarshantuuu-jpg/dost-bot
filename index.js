const{default:makeWASocket,useMultiFileAuthState,DisconnectReason,downloadMediaMessage,Browsers}=require("@whiskeysockets/baileys");
const P=require("pino"),sharp=require("sharp"),ffmpegPath=require("ffmpeg-static"),fs=require("fs"),path=require("path");
const{spawn}=require("child_process");

const PREFIX=".",START_TIME=Date.now();
const OWNER=String(process.env.OWNER_NUMBER||"919999999999").replace(/\D/g,"");
const AUTH_DIR="./auth",DATA_DIR="./data",TEMP_DIR="./temp";
for(const d of[DATA_DIR,TEMP_DIR])if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});
const COMMANDS_FILE=path.join(DATA_DIR,"commands.json");
let botEnabled=true,pairingRequested=false;

function loadCmd(){try{if(!fs.existsSync(COMMANDS_FILE))fs.writeFileSync(COMMANDS_FILE,"{}");return JSON.parse(fs.readFileSync(COMMANDS_FILE,"utf8"))}catch{return{}}}
function saveCmd(c){fs.writeFileSync(COMMANDS_FILE,JSON.stringify(c,null,2))}
let customCommands=loadCmd();

const HELP=`╭┈───〔 DOST-ULTRA 〕┈───⊷
├✦ Prefix: .
├✦ Mode: Public
├✦ Status: 🟢 ONLINE
╰───────────────────────⊷

『 🛠 MEDIA 』
.sticker
.toimg
.tovideo
.crop
.caption <text>
.blur
.mirror
.rotate
.gif

『 👥 WHATSAPP 』
.dp
.mydp
.tagall
.admins
.groupinfo
.link

『 😂 FUN 』
.roast
.joke
.meme
.fact
.shayari
.quote
.ship
.8ball
.dice
.coin

『 🤖 BOT 』
.help
.ping
.alive
.uptime
.owner

『 👑 OWNER 』
.bot on
.bot off
.addcmd hello | Hello 👋
.delcmd hello
.listcmd
╰───────────────────────⊷`;

const jidNum=j=>String(j||"").split("@")[0];
const isOwner=s=>jidNum(s)===OWNER;
const isGroup=j=>j?.endsWith("@g.us");
const uptime=ms=>{let s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return`${d}d ${h}h ${m}m ${s%60}s`};

function quoted(m){return m?.extendedTextMessage?.contextInfo?.quotedMessage||m?.imageMessage?.contextInfo?.quotedMessage||m?.videoMessage?.contextInfo?.quotedMessage}
function media(m){
 if(!m)return null;
 if(m.imageMessage)return["image",m.imageMessage];
 if(m.videoMessage)return["video",m.videoMessage];
 if(m.stickerMessage)return["sticker",m.stickerMessage];
 return null
}
function text(m){return m?.message?.conversation||m?.message?.extendedTextMessage?.text||""}
async function dl(sock,m){return downloadMediaMessage(m,"buffer",{}, {logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage})}
async function sticker(sock,j,b){let w=await sharp(b).resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).webp({quality:85}).toBuffer();await sock.sendMessage(j,{sticker:w})}
async function ff(args){return new Promise((res,rej)=>{let p=spawn(ffmpegPath,args),e="";p.stderr.on("data",d=>e+=d);p.on("close",c=>c?rej(Error(e||`FFmpeg ${c}`)):res())})}

async function videoSticker(b){
 let i=path.join(TEMP_DIR,`i${Date.now()}.mp4`),o=path.join(TEMP_DIR,`o${Date.now()}.webp`);
 fs.writeFileSync(i,b);
 await ff(["-y","-i",i,"-t","8","-vf","scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0","-an","-loop","0","-c:v","libwebp","-q:v","70",o]);
 let r=fs.readFileSync(o);try{fs.unlinkSync(i);fs.unlinkSync(o)}catch{}return r
}

async function stickerVideo(b){
 let i=path.join(TEMP_DIR,`s${Date.now()}.webp`),o=path.join(TEMP_DIR,`v${Date.now()}.mp4`);
 fs.writeFileSync(i,b);
 await ff(["-y","-loop","1","-i",i,"-t","3","-vf","scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2","-c:v","libx264","-pix_fmt","yuv420p",o]);
 let r=fs.readFileSync(o);try{fs.unlinkSync(i);fs.unlinkSync(o)}catch{}return r
}

async function startBot(){
 const{state,saveCreds}=await useMultiFileAuthState(AUTH_DIR);
 const sock=makeWASocket({auth:state,logger:P({level:"silent"}),printQRInTerminal:false,browser:Browsers.macOS("Desktop")});
 sock.ev.on("creds.update",saveCreds);

 sock.ev.on("connection.update",async u=>{
  const{connection,lastDisconnect}=u;
  if(connection==="connecting"&&!state.creds.registered&&!pairingRequested){
   pairingRequested=true;
   const phone=String(process.env.PHONE_NUMBER||"").replace(/\D/g,"");
   if(!phone){console.log("❌ PHONE_NUMBER missing");pairingRequested=false;return}
   try{
    await new Promise(r=>setTimeout(r,1500));
    let code=await sock.requestPairingCode(phone);
    console.log("\n╔══════════════════════════════╗\n║ DOST-ULTRA PAIRING CODE      ║\n╠══════════════════════════════╣\n║ "+code+"\n╚══════════════════════════════╝\n");
   }catch(e){pairingRequested=false;console.log("❌ Pairing Error:",e.message)}
  }
  if(connection==="open"){pairingRequested=false;console.log("✅ DOST-ULTRA CONNECTED")}
  if(connection==="close"){
   let c=lastDisconnect?.error?.output?.statusCode;
   console.log("❌ Connection closed:",c);
   if(c!==DisconnectReason.loggedOut){pairingRequested=false;setTimeout(()=>startBot().catch(console.error),3000)}
   else console.log("⚠️ WhatsApp logout detected.")
  }
 });

 sock.ev.on("messages.upsert",async({messages})=>{
  const msg=messages[0];
  if(!msg?.message||msg.key.fromMe)return;
  const jid=msg.key.remoteJid;if(!jid)return;
  const sender=msg.key.participant||jid;
  let t=text(msg).trim();if(!t.startsWith(PREFIX))return;
  let x=t.slice(PREFIX.length).trim();if(!x)return;
  let a=x.split(/\s+/),cmd=a.shift().toLowerCase(),args=a.join(" ").trim();

  if(!botEnabled&&!isOwner(sender))return;

  if(customCommands[cmd]&&!["addcmd","delcmd","listcmd"].includes(cmd)){
   await sock.sendMessage(jid,{text:customCommands[cmd]});return
  }

  try{

   if(cmd==="help"||cmd==="menu"){await sock.sendMessage(jid,{text:HELP});return}

   if(cmd==="ping"){
    let s=Date.now();await sock.sendMessage(jid,{text:"🏓 Checking..."});
    await sock.sendMessage(jid,{text:`🏓 *PONG!*\n⚡ Speed: ${Date.now()-s}ms`});return
   }

   if(cmd==="alive"){await sock.sendMessage(jid,{text:`🤖 *DOST-ULTRA*\n🟢 ONLINE\n⚙️ Public\n🔧 Prefix: ${PREFIX}\n⏱️ ${uptime(Date.now()-START_TIME)}`});return}
   if(cmd==="uptime"){await sock.sendMessage(jid,{text:`⏱️ *UPTIME*\n${uptime(Date.now()-START_TIME)}`});return}

   if(cmd==="owner"){
    await sock.sendMessage(jid,{contacts:{displayName:"DOST-ULTRA OWNER",contacts:[{vcard:`BEGIN:VCARD\nVERSION:3.0\nFN:DOST-ULTRA OWNER\nTEL;type=CELL;type=VOICE:+${OWNER}\nEND:VCARD`}]}});return
   }

   if(cmd==="bot"){
    if(!isOwner(sender)){await sock.sendMessage(jid,{text:"❌ Owner only."});return}
    if(args==="on"){botEnabled=true;await sock.sendMessage(jid,{text:"🟢 Bot ON"});return}
    if(args==="off"){botEnabled=false;await sock.sendMessage(jid,{text:"🔴 Bot OFF"});return}
   }

   if(cmd==="addcmd"){
    if(!isOwner(sender)){await sock.sendMessage(jid,{text:"❌ Owner only."});return}
    let [n,...v]=args.split("|");n=n?.trim().toLowerCase();v=v.join("|").trim();
    if(!n||!v){await sock.sendMessage(jid,{text:"Example: `.addcmd hello | Hello 👋`"});return}
    customCommands[n]=v;saveCmd(customCommands);
    await sock.sendMessage(jid,{text:`✅ Added .${n}`});return
   }

   if(cmd==="delcmd"){
    if(!isOwner(sender)){await sock.sendMessage(jid,{text:"❌ Owner only."});return}
    let n=args.toLowerCase();
    if(!customCommands[n]){await sock.sendMessage(jid,{text:"❌ Command not found."});return}
    delete customCommands[n];saveCmd(customCommands);
    await sock.sendMessage(jid,{text:`✅ Deleted .${n}`});return
   }

   if(cmd==="listcmd"){
    let c=Object.keys(customCommands);
    await sock.sendMessage(jid,{text:c.length?`📋 Custom Commands:\n${c.map(x=>"."+x).join("\n")}`:"📋 No custom commands."});return
   }

   if(cmd==="sticker"){
    let q=quoted(msg.message),target=q||msg.message,m=media(target);
    if(!m){await sock.sendMessage(jid,{text:"🖼️ Image/video ko reply karke `.sticker` bhejo."});return}
    let b=await dl(sock,{key:msg.key,message:target});
    if(m[0]==="video")await sock.sendMessage(jid,{sticker:await videoSticker(b)});
    else await sticker(sock,jid,b);
    return
   }

   if(cmd==="toimg"){
    let q=quoted(msg.message);
    if(!q?.stickerMessage){await sock.sendMessage(jid,{text:"Sticker ko reply karke `.toimg` bhejo."});return}
    let b=await dl(sock,{key:msg.key,message:q});
    await sock.sendMessage(jid,{image:await sharp(b).png().toBuffer(),caption:"🖼️ Converted"});return
   }

   if(cmd==="tovideo"){
    let q=quoted(msg.message);
    if(!q?.stickerMessage){await sock.sendMessage(jid,{text:"Sticker ko reply karke `.tovideo` bhejo."});return}
    let b=await dl(sock,{key:msg.key,message:q});
    await sock.sendMessage(jid,{video:await stickerVideo(b),mimetype:"video/mp4"});return
   }

   if(["crop","blur","mirror","rotate","caption"].includes(cmd)){
    let q=quoted(msg.message);
    if(!q?.imageMessage){await sock.sendMessage(jid,{text:`Image ko reply karke \`.${cmd}${cmd==="caption"?" Your Text":""}\` bhejo.`});return}
    if(cmd==="caption"&&!args){await sock.sendMessage(jid,{text:"Example: `.caption Hello 👋`"});return}
    let b=await dl(sock,{key:msg.key,message:q}),img=sharp(b);

    if(cmd==="crop"){
     let m=await img.metadata(),s=Math.min(m.width||512,m.height||512);
     b=await img.extract({left:Math.floor(((m.width||s)-s)/2),top:Math.floor(((m.height||s)-s)/2),width:s,height:s}).jpeg().toBuffer()
    }

    if(cmd==="blur")b=await img.blur(12).jpeg().toBuffer();
    if(cmd==="mirror")b=await img.flop().jpeg().toBuffer();
    if(cmd==="rotate")b=await img.rotate(90).jpeg().toBuffer();

    if(cmd==="caption"){
     let m=await img.metadata(),w=m.width||500,h=m.height||500;
     let safe=args.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
     let svg=Buffer.from(`<svg width="${w}" height="${h}"><style>.c{fill:white;font-size:42px;font-family:Arial;font-weight:bold;paint-order:stroke;stroke:black;stroke-width:4px}</style><text x="50%" y="${h-40}" text-anchor="middle" class="c">${safe}</text></svg>`);
     b=await img.composite([{input:svg,top:0,left:0}]).jpeg().toBuffer()
    }

    await sock.sendMessage(jid,{image:b,caption:`✅ ${cmd} done`});return
   }

   if(cmd==="gif"){
    let q=quoted(msg.message);
    if(!q?.videoMessage){await sock.sendMessage(jid,{text:"GIF/video ko reply karke `.gif` bhejo."});return}
    let b=await dl(sock,{key:msg.key,message:q});
    await sock.sendMessage(jid,{sticker:await videoSticker(b)});return
   }

   if(cmd==="joke"){await sock.sendMessage(jid,{text:"😂 Why did the computer go to the doctor?\nBecause it had a virus!"});return}
   if(cmd==="meme"){let m=["When WiFi works: 😎","When WiFi stops: 💀","Me opening WhatsApp at 3AM: 👀"];await sock.sendMessage(jid,{text:m[Math.floor(Math.random()*m.length)]});return}
   if(cmd==="fact"){let f=["Octopuses have three hearts 🐙","Honey can last for a very long time 🍯","A day on Venus is longer than its year 🪐"];await sock.sendMessage(jid,{text:"🧠 "+f[Math.floor(Math.random()*f.length)]});return}
   if(cmd==="shayari"){await sock.sendMessage(jid,{text:"✨ Dil se nikli baat dil tak jaati hai,\nDosti hamesha muskurahat laati hai ❤️"});return}
   if(cmd==="quote"){await sock.sendMessage(jid,{text:"💭 Keep going. Small steps still move you forward."});return}

   if(cmd==="dice"){await sock.sendMessage(jid,{text:`🎲 You rolled: ${Math.floor(Math.random()*6)+1}`});return}
   if(cmd==="coin"){await sock.sendMessage(jid,{text:`🪙 ${Math.random()<.5?"Heads":"Tails"}`});return}

   if(cmd==="8ball"){
    if(!args){await sock.sendMessage(jid,{text:"Example: `.8ball will I win?`"});return}
    let r=["Yes ✅","No ❌","Maybe 🤔","Definitely! 🔥","Ask again later 😄"];
    await sock.sendMessage(jid,{text:`🎱 ${r[Math.floor(Math.random()*r.length)]}`});return
   }

   if(cmd==="roast"){
    await sock.sendMessage(jid,{text:"🔥 Roast: Tum itne slow ho ki loading screen bhi tumse impatient ho jaye 😂"});return
   }

   if(cmd==="ship"){
    let q=msg.message?.extendedTextMessage?.contextInfo?.mentionedJid||[];
    if(!q.length){await sock.sendMessage(jid,{text:"❤️ Kisi ko mention karo: `.ship @user`"});return}
    await sock.sendMessage(jid,{text:`❤️ Compatibility: ${Math.floor(Math.random()*101)}%`});return
   }

   if(["dp","mydp"].includes(cmd)){
    let target=cmd==="mydp"?sender:(msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||msg.message?.extendedTextMessage?.contextInfo?.participant);
    if(!target){await sock.sendMessage(jid,{text:"User mention/reply karo."});return}
    try{
     let url=await sock.profilePictureUrl(target,"image");
     await sock.sendMessage(jid,{image:{url},caption:"🖼️ Profile Photo"})
    }catch{await sock.sendMessage(jid,{text:"❌ Profile photo available nahi hai."})}
    return
   }

   if(["tagall","admins","groupinfo","link"].includes(cmd)){
    if(!isGroup(jid)){await sock.sendMessage(jid,{text:"❌ Group only command."});return}
    let md=await sock.groupMetadata(jid);

    if(cmd==="tagall"){
     let mentions=md.participants.map(p=>p.id);
     await sock.sendMessage(jid,{text:`📢 *TAG ALL*\n\n${mentions.map(x=>"@"+jidNum(x)).join(" ")}`,mentions});return
    }

    if(cmd==="admins"){
     let ad=md.participants.filter(p=>p.admin);
     await sock.sendMessage(jid,{text:"👑 *ADMINS*\n\n"+ad.map(x=>"@"+jidNum(x)).join("\n"),mentions:ad.map(x=>x.id)});return
    }

    if(cmd==="groupinfo"){
     await sock.sendMessage(jid,{text:`👥 *GROUP INFO*\n\n📌 Name: ${md.subject}\n👤 Members: ${md.participants.length}\n🆔 ${jid}`});return
    }

    if(cmd==="link"){
     if(!await requireAdmin(sock,jid,sender)){await sock.sendMessage(jid,{text:"❌ Admin only."});return}
     let code=await sock.groupInviteCode(jid);
     await sock.sendMessage(jid,{text:`🔗 https://chat.whatsapp.com/${code}`});return
    }
   }

  }catch(e){
   console.error("Command Error:",e);
   await sock.sendMessage(jid,{text:`❌ Error: ${e.message||"Something went wrong"}`}).catch(()=>{});
  }
 });
}

async function requireAdmin(sock,jid,sender){
 try{
  let m=await sock.groupMetadata(jid),p=m.participants.find(x=>x.id===sender);
  return !!(p?.admin)
 }catch{return false}
}

startBot().catch(e=>console.error("❌ Bot Start Error:",e));
