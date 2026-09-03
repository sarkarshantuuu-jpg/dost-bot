const fs=require("fs");
const path=require("path");
const P=require("pino");
const sharp=require("sharp");
const {execFile}=require("child_process");

const PREFIX=".";
const OWNER=(process.env.OWNER_NUMBER||"").replace(/\D/g,"");
const PHONE=(process.env.PHONE_NUMBER||"").replace(/\D/g,"");
const AUTH="./auth";
const CMDFILE="./customcmds.json";

if(!fs.existsSync(CMDFILE))fs.writeFileSync(CMDFILE,"{}");

const cmds=()=>{
 try{return JSON.parse(fs.readFileSync(CMDFILE,"utf8"))}
 catch{return {}}
};
const save=x=>fs.writeFileSync(CMDFILE,JSON.stringify(x,null,2));
const owner=jid=>OWNER&&jid.split("@")[0].split(":")[0].replace(/\D/g,"")===OWNER;

function ffmpeg(input,output){
 return new Promise((resolve,reject)=>{
  execFile(require("ffmpeg-static"),[
   "-y","-i",input,
   "-vf","scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0",
   "-c:v","libwebp","-q:v","65","-loop","0","-an","-t","8",output
  ],{timeout:60000},e=>e?reject(e):resolve());
 });
}

async function start(){
 const {
  default:makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
 }=require("@whiskeysockets/baileys");

 if(!PHONE){
  console.log("PHONE_NUMBER Railway Variable me add karo");
  return;
 }
 if(!OWNER){
  console.log("OWNER_NUMBER Railway Variable me add karo");
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

 sock.ev.on("connection.update",async({connection,lastDisconnect})=>{
  if(connection==="open")console.log("BOT ONLINE ✅");

  if(connection==="close"){
   const code=lastDisconnect?.error?.output?.statusCode;
   if(code!==DisconnectReason.loggedOut){
    console.log("Reconnecting...");
    setTimeout(start,3000);
   }else{
    console.log("Logged out. Pair again.");
   }
  }
 });

 if(!state.creds.registered){
  setTimeout(async()=>{
   try{
    const code=await sock.requestPairingCode(PHONE);
    console.log("\nPAIRING CODE:",code,"\n");
   }catch(e){
    console.log("Pairing error:",e.message);
   }
  },3000);
 }

 sock.ev.on("messages.upsert",async({messages})=>{
  const m=messages[0];
  if(!m||m.key.fromMe)return;

  const jid=m.key.remoteJid;
  if(!jid||jid==="status@broadcast")return;

  const text=
   m.message?.conversation||
   m.message?.extendedTextMessage?.text||
   m.message?.imageMessage?.caption||
   m.message?.videoMessage?.caption||"";

  if(!text.startsWith(PREFIX))return;

  const body=text.slice(1).trim();
  const [command,...args]=body.split(/\s+/);
  const cmd=command.toLowerCase();
  const arg=args.join(" ");
  const custom=cmds();

  try{

   if(cmd==="sticker"||cmd==="s"){
    let msg=m;

    const quoted=m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if(quoted){
     const q=m.message.extendedTextMessage.contextInfo;
     msg={
      key:{
       remoteJid:jid,
       id:q.stanzaId,
       participant:q.participant
      },
      message:quoted
     };
    }

    const content=msg.message||{};
    const type=Object.keys(content)[0];

    if(!["imageMessage","videoMessage"].includes(type)){
     return sock.sendMessage(jid,{
      text:"📌 Photo/video ko reply karke .sticker bhejo."
     },{quoted:m});
    }

    const buffer=await downloadMediaMessage(
     msg,"buffer",{},{
      logger:P({level:"silent"})
     }
    );

    if(type==="imageMessage"){
     const webp=await sharp(buffer)
      .resize(512,512,{
       fit:"inside",
       withoutEnlargement:true
      })
      .webp({quality:80})
      .toBuffer();

     await sock.sendMessage(jid,{sticker:webp},{quoted:m});
    }else{
     const id=Date.now();
     const input=`./video_${id}.mp4`;
     const output=`./sticker_${id}.webp`;

     fs.writeFileSync(input,buffer);
     await ffmpeg(input,output);

     await sock.sendMessage(jid,{
      sticker:fs.readFileSync(output)
     },{quoted:m});

     try{
      fs.unlinkSync(input);
      fs.unlinkSync(output);
     }catch{}
    }
    return;
   }

   if(cmd==="addcmd"){
    if(!owner(m.key.participant||jid))
     return sock.sendMessage(jid,{text:"❌ Owner only."},{quoted:m});

    const match=arg.match(/^([a-zA-Z0-9_-]+)\s*\|\s*([\s\S]+)$/);

    if(!match)
     return sock.sendMessage(jid,{
      text:"Use:\n.addcmd hello | Hello 👋"
     },{quoted:m});

    const name=match[1].toLowerCase();
    custom[name]=match[2].trim();
    save(custom);

    return sock.sendMessage(jid,{
     text:`✅ .${name} add ho gaya.`
    },{quoted:m});
   }

   if(cmd==="delcmd"){
    if(!owner(m.key.participant||jid))
     return sock.sendMessage(jid,{text:"❌ Owner only."},{quoted:m});

    const name=(args[0]||"").toLowerCase();

    if(!custom[name])
     return sock.sendMessage(jid,{
      text:"Use: .delcmd hello"
     },{quoted:m});

    delete custom[name];
    save(custom);

    return sock.sendMessage(jid,{
     text:`🗑️ .${name} delete ho gaya.`
    },{quoted:m});
   }

   if(cmd==="listcmd"){
    const list=Object.keys(custom);

    return sock.sendMessage(jid,{
     text:list.length
      ?`📋 Custom Commands:\n${list.map(x=>`• .${x}`).join("\n")}`
      :"📋 Koi custom command nahi hai."
    },{quoted:m});
   }

   if(cmd==="help"||cmd==="menu"){
    return sock.sendMessage(jid,{
     text:
`🤖 *DOST STICKER BOT*

🖼️ *STICKER*
• .sticker
• .s

🛠️ *OWNER*
• .addcmd hello | Hello 👋
• .delcmd hello
• .listcmd

Prefix: .
Owner commands: 🔒`
    },{quoted:m});
   }

   if(custom[cmd]){
    return sock.sendMessage(jid,{
     text:custom[cmd]
    },{quoted:m});
   }

  }catch(e){
   console.log("ERROR:",e.message);
   await sock.sendMessage(jid,{
    text:"❌ Command process nahi ho paya."
   },{quoted:m}).catch(()=>{});
  }
 });
}

start().catch(console.error);    console.log("Reconnecting...");
    setTimeout(start,3000);
   }else{
    console.log("Logged out. Pair again.");
   }
  }
 });

 if(!state.creds.registered){
  setTimeout(async()=>{
   try{
    const code=await sock.requestPairingCode(PHONE);
    console.log("\nPAIRING CODE:",code,"\n");
   }catch(e){
    console.log("Pairing error:",e.message);
   }
  },3000);
 }

 sock.ev.on("messages.upsert",async({messages})=>{
  const m=messages[0];
  if(!m||m.key.fromMe)return;

  const jid=m.key.remoteJid;
  if(!jid||jid==="status@broadcast")return;

  const text=
   m.message?.conversation||
   m.message?.extendedTextMessage?.text||
   m.message?.imageMessage?.caption||
   m.message?.videoMessage?.caption||"";

  if(!text.startsWith(PREFIX))return;

  const body=text.slice(1).trim();
  const [command,...args]=body.split(/\s+/);
  const cmd=command.toLowerCase();
  const arg=args.join(" ");
  const custom=cmds();

  try{

   if(cmd==="sticker"||cmd==="s"){
    let msg=m;

    const quoted=m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if(quoted){
     const q=m.message.extendedTextMessage.contextInfo;
     msg={
      key:{
       remoteJid:jid,
       id:q.stanzaId,
       participant:q.participant
      },
      message:quoted
     };
    }

    const content=msg.message||{};
    const type=Object.keys(content)[0];

    if(!["imageMessage","videoMessage"].includes(type)){
     return sock.sendMessage(jid,{
      text:"📌 Photo/video ko reply karke .sticker bhejo."
     },{quoted:m});
    }

    const buffer=await downloadMediaMessage(
     msg,"buffer",{},{
      logger:P({level:"silent"})
     }
    );

    if(type==="imageMessage"){
     const webp=await sharp(buffer)
      .resize(512,512,{
       fit:"inside",
       withoutEnlargement:true
      })
      .webp({quality:80})
      .toBuffer();

     await sock.sendMessage(jid,{sticker:webp},{quoted:m});
    }else{
     const id=Date.now();
     const input=`./video_${id}.mp4`;
     const output=`./sticker_${id}.webp`;

     fs.writeFileSync(input,buffer);
     await ffmpeg(input,output);

     await sock.sendMessage(jid,{
      sticker:fs.readFileSync(output)
     },{quoted:m});

     try{
      fs.unlinkSync(input);
      fs.unlinkSync(output);
     }catch{}
    }
    return;
   }

   if(cmd==="addcmd"){
    if(!owner(m.key.participant||jid))
     return sock.sendMessage(jid,{text:"❌ Owner only."},{quoted:m});

    const match=arg.match(/^([a-zA-Z0-9_-]+)\s*\|\s*([\s\S]+)$/);

    if(!match)
     return sock.sendMessage(jid,{
      text:"Use:\n.addcmd hello | Hello 👋"
     },{quoted:m});

    const name=match[1].toLowerCase();
    custom[name]=match[2].trim();
    save(custom);

    return sock.sendMessage(jid,{
     text:`✅ .${name} add ho gaya.`
    },{quoted:m});
   }

   if(cmd==="delcmd"){
    if(!owner(m.key.participant||jid))
     return sock.sendMessage(jid,{text:"❌ Owner only."},{quoted:m});

    const name=(args[0]||"").toLowerCase();

    if(!custom[name])
     return sock.sendMessage(jid,{
      text:"Use: .delcmd hello"
     },{quoted:m});

    delete custom[name];
    save(custom);

    return sock.sendMessage(jid,{
     text:`🗑️ .${name} delete ho gaya.`
    },{quoted:m});
   }

   if(cmd==="listcmd"){
    const list=Object.keys(custom);

    return sock.sendMessage(jid,{
     text:list.length
      ?`📋 Custom Commands:\n${list.map(x=>`• .${x}`).join("\n")}`
      :"📋 Koi custom command nahi hai."
    },{quoted:m});
   }

   if(cmd==="help"||cmd==="menu"){
    return sock.sendMessage(jid,{
     text:
`🤖 *DOST STICKER BOT*

🖼️ *STICKER*
• .sticker
• .s

🛠️ *OWNER*
• .addcmd hello | Hello 👋
• .delcmd hello
• .listcmd

Prefix: .
Owner commands: 🔒`
    },{quoted:m});
   }

   if(custom[cmd]){
    return sock.sendMessage(jid,{
     text:custom[cmd]
    },{quoted:m});
   }

  }catch(e){
   console.log("ERROR:",e.message);
   await sock.sendMessage(jid,{
    text:"❌ Command process nahi ho paya."
   },{quoted:m}).catch(()=>{});
  }
 });
}

start().catch(console.error);
