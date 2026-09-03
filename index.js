const fs=require("fs");
const path=require("path");
const P=require("pino");
const sharp=require("sharp");
const {execFile}=require("child_process");

const PREFIX=".";
const PHONE=(process.env.PHONE_NUMBER||"").replace(/\D/g,"");
const OWNER=(process.env.OWNER_NUMBER||"").replace(/\D/g,"");
const AUTH=path.join(__dirname,"auth");
const CMDFILE=path.join(__dirname,"customcmds.json");

if(!fs.existsSync(CMDFILE))fs.writeFileSync(CMDFILE,"{}");

function getCmds(){
 try{return JSON.parse(fs.readFileSync(CMDFILE,"utf8"))}
 catch{return {}}
}

function saveCmds(x){
 fs.writeFileSync(CMDFILE,JSON.stringify(x,null,2));
}

function isOwner(jid){
 const num=(jid||"").split("@")[0].split(":")[0].replace(/\D/g,"");
 return OWNER&&num===OWNER;
}

function convertVideo(input,output){
 return new Promise((resolve,reject)=>{
  execFile(require("ffmpeg-static"),[
   "-y","-i",input,
   "-vf","scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0",
   "-c:v","libwebp",
   "-q:v","65",
   "-loop","0",
   "-an",
   "-t","8",
   output
  ],{timeout:60000},err=>err?reject(err):resolve());
 });
}

async function startBot(){
 const {
  default:makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
 }=require("@whiskeysockets/baileys");

 if(!PHONE){
  console.log("❌ PHONE_NUMBER missing");
  return;
 }

 if(!OWNER){
  console.log("❌ OWNER_NUMBER missing");
  return;
 }

 const {state,saveCreds}=await useMultiFileAuthState(AUTH);

 const sock=makeWASocket({
  auth:state,
  logger:P({level:"silent"}),
  browser:["DOST-STICKER","Chrome","1.0"],
  printQRInTerminal:false
 });

 sock.ev.on("creds.update",saveCreds);

 sock.ev.on("connection.update",async update=>{
  const {connection,lastDisconnect}=update;

  if(connection==="open"){
   console.log("✅ DOST STICKER BOT ONLINE");
  }

  if(connection==="close"){
   const code=lastDisconnect?.error?.output?.statusCode;

   if(code!==DisconnectReason.loggedOut){
    console.log("🔄 Reconnecting...");
    setTimeout(()=>startBot(),3000);
   }else{
    console.log("❌ WhatsApp logged out.");
   }
  }
 });

 if(!state.creds.registered){
  try{
   await new Promise(r=>setTimeout(r,3000));
   const code=await sock.requestPairingCode(PHONE);
   console.log("\n🔑 PAIRING CODE:",code,"\n");
   console.log("WhatsApp > Linked Devices > Link a device > Link with phone number");
  }catch(e){
   console.log("❌ Pairing error:",e.message);
  }
 }

 sock.ev.on("messages.upsert",async({messages})=>{
  const m=messages[0];

  if(!m||m.key.fromMe||!m.message)return;

  const jid=m.key.remoteJid;

  if(!jid||jid==="status@broadcast")return;

  const text=
   m.message.conversation||
   m.message.extendedTextMessage?.text||
   m.message.imageMessage?.caption||
   m.message.videoMessage?.caption||
   "";

  if(!text.startsWith(PREFIX))return;

  const body=text.slice(PREFIX.length).trim();

  if(!body)return;

  const parts=body.split(/\s+/);
  const cmd=parts.shift().toLowerCase();
  const args=parts.join(" ");
  const custom=getCmds();

  try{

   if(cmd==="sticker"||cmd==="s"){
    let target=m;

    const quoted=m.message.extendedTextMessage?.contextInfo?.quotedMessage;

    if(quoted){
     const info=m.message.extendedTextMessage.contextInfo;

     target={
      key:{
       remoteJid:jid,
       id:info.stanzaId,
       participant:info.participant
      },
      message:quoted
     };
    }

    const message=target.message||{};
    const type=Object.keys(message)[0];

    if(type!=="imageMessage"&&type!
