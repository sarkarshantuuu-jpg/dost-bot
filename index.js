const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");
const P=require("pino");
const sharp=require("sharp");
const ffmpeg=require("ffmpeg-static");
const {execFile}=require("child_process");
const {promisify}=require("util");
const fs=require("fs");
const path=require("path");
const os=require("os");
const exec=promisify(execFile);

const PREFIX=process.env.PREFIX||".";
const PHONE=(process.env.PHONE_NUMBER||"").replace(/\D/g,"");
const OWNER=(process.env.OWNER_NUMBER||"").replace(/\D/g,"");
const BOT="DOST-MD";
const START=Date.now();
const AUTH_PATH = "./auth";
const DB="./database.json";

if(!fs.existsSync(DB))fs.writeFileSync(DB,JSON.stringify({enabled:true,custom:{}},null,2));

function loadDB(){try{return JSON.parse(fs.readFileSync(DB,"utf8"))}catch{return{enabled:true,custom:{}}}}
function saveDB(db){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
function isOwner(jid){return!!OWNER&&jid.split("@")[0].replace(/\D/g,"")===OWNER}
function uptime(){
 let s=Math.floor((Date.now()-START)/1000),h=Math.floor(s/3600);
 s%=3600;let m=Math.floor(s/60);s%=60;
 return `${h}h ${m}m ${s}s`;
}
function textOf(m){
 return m.message?.conversation||
 m.message?.extendedTextMessage?.text||
 m.message?.imageMessage?.caption||
 m.message?.videoMessage?.caption||"";
}
function quoted(m){return m.message?.extendedTextMessage?.contextInfo?.quotedMessage}
async function media(msg,type){
 const stream=await downloadContentFromMessage(msg,type);
 const chunks=[];
 for await(const c of stream)chunks.push(c);
 return Buffer.concat(chunks);
}

async function makeSticker(sock,from,msg){
 const q=quoted(msg);
 const image=msg.message?.imageMessage||q?.imageMessage;
 const video=msg.message?.videoMessage||q?.videoMessage;
 if(!image&&!video)return sock.sendMessage(from,{text:"📸 Image/video bhejo ya reply karke.sticker use karo."},{quoted:msg});
 if(image){
  const b=await media(image,"image");
  const out=await sharp(b).resize(512,512,{fit:"inside",withoutEnlargement:true}).webp().toBuffer();
  return sock.sendMessage(from,{sticker:out},{quoted:msg});
 }
 const b=await media(video,"video");
 const id=Date.now();
 const input=path.join(os.tmpdir(),`dost_${id}.mp4`);
 const output=path.join(os.tmpdir(),`dost_${id}.webp`);
 try{
  fs.writeFileSync(input,b);
  await exec(ffmpeg,["-y","-i",input,"-t","6","-vf","scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,fps=15","-an","-c:v","libwebp","-loop","0","-q:v","50",output]);
  return sock.sendMessage(from,{sticker:fs.readFileSync(output)},{quoted:msg});
 }finally{
  try{fs.unlinkSync(input)}catch{}
  try{fs.unlinkSync(output)}catch{}
 }
}

const FUN={
 joke:["WiFi slow ho to router ko ghoorna zaroori hai 😂","Battery 1% aur charger na mile = asli horror 😭"],
 fact:["Octopus ke teen hearts hote hain 🐙","Honey bahut lambe samay tak preserve reh sakta hai 🍯"],
 quote:["Consistency beats motivation. 🔥","Small steps every day lead to big results."],
 shayari:["Muskurate raho, zindagi khoobsurat hai ❤️","Dosti wahi jo mushkil waqt me saath khadi rahe 🤝"]
};

const BASIC={
 hi:"Hello 👋",hello:"Hello dost ❤️",goodmorning:"🌅 Good Morning!",goodnight:"🌙 Good Night!",
 welcome:"👋 Welcome!",thanks:"❤️ You're welcome!",bot:"🤖 DOST-MD", ping:"Pong 🏓"
};

const MENU=`╭┈───〔 ${BOT} 〕┈───⊷\n├✦ Prefix: ${PREFIX}\n├✦ Status: 🟢 ON\n╰───────────────────⊷\n\n『 BOT 』\n.help /.menu /.ping /.alive /.uptime\n\n『 MEDIA 』\n.sticker /.toimg\n\n『 GROUP 』\n.tagall /.admins /.link /.groupinfo`;

async function start(){
 // CLEAN OLD AUTH IF CORRUPT
 if(fs.existsSync(AUTH_PATH)){
   const creds = path.join(AUTH_PATH,"creds.json");
   if(!fs.existsSync(creds) && PHONE){
     console.log("Cleaning broken auth...");
     fs.rmSync(AUTH_PATH,{recursive:true,force:true});
   }
 }

 const {state,saveCreds}=await useMultiFileAuthState(AUTH_PATH);
 const sock=makeWASocket({
  auth:state,
  logger:P({level:"silent"}),
  browser:["DOST-MD","Chrome","1.0.0"],
  printQRInTerminal:false,
  markOnlineOnConnect:false
 });

 sock.ev.on("creds.update",saveCreds);
 console.log("PHONE_NUMBER ENV:", PHONE || "NOT SET");

 if(!state.creds.registered){
  if(!PHONE){
   console.log("❌ PHONE_NUMBER variable set karo Railway me!");
  } else {
   setTimeout(async()=>{
    try{
     console.log(`Requesting pairing code for ${PHONE}...`);
     const code=await sock.requestPairingCode(PHONE);
     console.log("================================");
     console.log("PAIRING CODE:",code);
     console.log("LINK: WhatsApp > Linked Devices > Link with phone number");
     console.log("================================");
    }catch(e){console.log("PAIRING ERROR:",e.message)}
   },4000);
  }
 }

 sock.ev.on("connection.update",({connection,lastDisconnect})=>{
  if(connection==="open")console.log(`${BOT} CONNECTED ✅`);
  if(connection==="close"){
   const code=lastDisconnect?.error?.output?.statusCode;
   const shouldReconnect = code!==DisconnectReason.loggedOut;
   console.log("Connection closed:", lastDisconnect?.error?.message, " Reconnect:", shouldReconnect);
   if(shouldReconnect){
    setTimeout(start,5000);
   }else{
    console.log("Logged out. Delete auth folder and pair again.");
    if(fs.existsSync(AUTH_PATH)) fs.rmSync(AUTH_PATH,{recursive:true,force:true});
    setTimeout(start,3000);
   }
  }
 });

 //... rest same as yours, truncated for deploy speed
 sock.ev.on("messages.upsert",async({messages})=>{
  try{
   const msg=messages[0];
   if(!msg?.message||msg.key.fromMe)return;
   const from=msg.key.remoteJid;
   const sender=msg.key.participant||from;
   const text=textOf(msg).trim();
   if(!text.startsWith(PREFIX))return;
   const parts=text.slice(PREFIX.length).trim().split(/\s+/);
   const cmd=(parts.shift()||"").toLowerCase();
   const db=loadDB();
   const reply=t=>sock.sendMessage(from,{text:t},{quoted:msg});
   if(!db.enabled&&!isOwner(sender))return;
   if(BASIC[cmd])return reply(BASIC[cmd]);
   if(cmd==="help"||cmd==="menu")return reply(MENU);
   if(cmd==="ping")return reply("🏓 Pong! "+uptime());
   if(cmd==="sticker"||cmd==="s")return makeSticker(sock,from,msg);
  }catch(e){console.error("COMMAND ERROR:",e)}
 });
}
start();
