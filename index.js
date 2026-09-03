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

const PREFIX=".";
const PHONE=(process.env.PHONE_NUMBER||"").replace(/\D/g,"");
const OWNER=(process.env.OWNER_NUMBER||"").replace(/\D/g,"");
const BOT="DOST-MD";
const START=Date.now();
const DB="./database.json";

if(!fs.existsSync(DB))fs.writeFileSync(DB,JSON.stringify({enabled:true,custom:{}},null,2));

function loadDB(){try{return JSON.parse(fs.readFileSync(DB,"utf8"))}catch{return{enabled:true,custom:{}}}}
function saveDB(db){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
function isOwner(jid){return !!OWNER&&jid.split("@")[0].replace(/\D/g,"")===OWNER}
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
 if(!image&&!video)return sock.sendMessage(from,{text:"📸 Image/video bhejo ya reply karke .sticker use karo."},{quoted:msg});

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
  await exec(ffmpeg,[
   "-y","-i",input,"-t","6",
   "-vf","scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,fps=15",
   "-an","-c:v","libwebp","-loop","0","-q:v","50",output
  ]);
  return sock.sendMessage(from,{sticker:fs.readFileSync(output)},{quoted:msg});
 }finally{
  try{fs.unlinkSync(input)}catch{}
  try{fs.unlinkSync(output)}catch{}
 }
}

const FUN={
 joke:["WiFi slow ho to router ko ghoorna zaroori hai 😂","Battery 1% aur charger na mile = asli horror 😭","Dost: Online hai? Main: Haan, reply offline hai 😂"],
 fact:["Octopus ke teen hearts hote hain 🐙","Honey bahut lambe samay tak preserve reh sakta hai 🍯","Banana botanical classification me berry hai 🍌"],
 quote:["Consistency beats motivation. 🔥","Small steps every day lead to big results.","Keep learning. Keep growing. 🚀"],
 shayari:["Muskurate raho, zindagi khoobsurat hai ❤️","Dosti wahi jo mushkil waqt me saath khadi rahe 🤝","Kuch baatein khamoshi bhi keh deti hain."]
};

const BASIC={
 hi:"Hello 👋",hello:"Hello dost ❤️",goodmorning:"🌅 Good Morning!",goodnight:"🌙 Good Night!",
 welcome:"👋 Welcome!",thanks:"❤️ You're welcome!",love:"❤️ Spread kindness!",cool:"😎 Cool!",
 wow:"🔥 WOW!",yes:"✅ Yes!",no:"❌ No!",ok:"👌 OK!",bot:"🤖 DOST-MD",
 status:"🟢 Online",version:"DOST-MD v1.0",creator:"👑 Owner",support:"🛠️ Use .help",
 rules:"📜 Group rules admin se check karo.",info:"ℹ️ DOST-MD WhatsApp Bot",
 test:"✅ Test successful!",bye:"👋 Bye!",good:"👍 Good!",nice:"✨ Nice!",
 great:"🔥 Great!",awesome:"🚀 Awesome!",danger:"⚠️ Be careful.",warning:"⚠️ Warning.",
 online:"🟢 Bot online hai.",offline:"🔴 Bot offline mode me hai."
};

const MENU=`╭┈───〔 ${BOT} 〕┈───⊷
├✦ Prefix: .
├✦ Mode: public
├✦ Status: 🟢 ON
╰───────────────────⊷

『 BOT 』
.help
.menu
.ping
.alive
.uptime
.owner
.about
.id
.jid

『 MEDIA 』
.sticker
.s
.toimg
.crop
.blur
.mirror
.rotate
.flip
.resize
.compress

『 GROUP 』
.tagall
.admins
.groupinfo
.link
.members
.count
.gname
.gdesc

『 FUN 』
.joke
.fact
.quote
.shayari
.dice
.coin
.8ball
.roll
.choose
.pick
.rate
.hug
.highfive
.clap

『 OWNER 』
.on
.off
.addcmd
.delcmd
.listcmd`;

async function start(){
 const {state,saveCreds}=await useMultiFileAuthState("./auth");
 const sock=makeWASocket({
  auth:state,
  logger:P({level:"silent"}),
  browser:["DOST-MD","Chrome","1.0.0"],
  markOnlineOnConnect:false
 });

 sock.ev.on("creds.update",saveCreds);

 if(!state.creds.registered&&PHONE){
  setTimeout(async()=>{
   try{
    const code=await sock.requestPairingCode(PHONE);
    console.log("================================");
    console.log("PAIRING CODE:",code);
    console.log("================================");
   }catch(e){console.log("PAIRING ERROR:",e.message)}
  },3000);
 }

 sock.ev.on("connection.update",({connection,lastDisconnect})=>{
  if(connection==="open")console.log(`${BOT} CONNECTED ✅`);
  if(connection==="close"){
   const code=lastDisconnect?.error?.output?.statusCode;
   if(code!==DisconnectReason.loggedOut){
    console.log("Connection closed. Reconnecting...");
    setTimeout(start,5000);
   }else console.log("Logged out. Delete auth and pair again.");
  }
 });

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
   const args=parts;
   const db=loadDB();

   const reply=t=>sock.sendMessage(from,{text:t},{quoted:msg});

   if(!db.enabled&&!isOwner(sender))return;

   if(cmd==="on"){
    if(!isOwner(sender))return reply("❌ Owner only.");
    db.enabled=true;saveDB(db);return reply("🟢 Bot ON.");
   }

   if(cmd==="off"){
    if(!isOwner(sender))return reply("❌ Owner only.");
    db.enabled=false;saveDB(db);return reply("🔴 Bot OFF.");
   }

   if(cmd==="addcmd"){
    if(!isOwner(sender))return reply("❌ Owner only.");
    const raw=text.slice(PREFIX.length+6).trim();
    const split=raw.split("|");
    if(split.length<2)return reply("Example:\n.addcmd hello | Hello 👋");
    const name=split.shift().trim().toLowerCase();
    const response=split.join("|").trim();
    if(!name||!response)return reply("❌ Invalid command.");
    db.custom[name]=response;saveDB(db);
    return reply(`✅ Custom command added: .${name}`);
   }

   if(cmd==="delcmd"){
    if(!isOwner(sender))return reply("❌ Owner only.");
    const name=args[0]?.toLowerCase();
    if(!name||!db.custom[name])return reply("❌ Command not found.");
    delete db.custom[name];saveDB(db);
    return reply(`🗑️ Deleted: .${name}`);
   }

   if(cmd==="listcmd"){
    if(!isOwner(sender))return reply("❌ Owner only.");
    const list=Object.keys(db.custom);
    return reply(list.length?"📋 CUSTOM COMMANDS\n\n"+list.map(x=>`.`+x).join("\n"):"📋 No custom commands.");
   }

   if(cmd==="help"||cmd==="menu")return reply(MENU);
   if(cmd==="ping")return reply("🏓 Pong!");
   if(cmd==="alive")return reply("🟢 DOST-MD is alive!");
   if(cmd==="uptime"||cmd==="runtime")return reply(`⏱️ Uptime: ${uptime()}`);
   if(cmd==="owner")return reply(OWNER?`👑 Owner: +${OWNER}`:"❌ OWNER_NUMBER not configured.");
   if(cmd==="about")return reply(`🤖 ${BOT}\nVersion: 1.0.0\nPrefix: .\nMode: public`);
   if(cmd==="id"||cmd==="jid")return reply(`🆔 ${from}`);
   if(BASIC[cmd])return reply(BASIC[cmd]);

   if(cmd==="sticker"||cmd==="s")return makeSticker(sock,from,msg);

   if(cmd==="toimg"){
    const q=quoted(msg);
    const st=msg.message?.stickerMessage||q?.stickerMessage;
    if(!st)return reply("❌ Sticker ko reply karke .toimg use karo.");
    const b=await media(st,"sticker");
    const out=await sharp(b).png().toBuffer();
    return sock.sendMessage(from,{image:out,caption:"✅ Converted"},{quoted:msg});
   }

   if(FUN[cmd]){
    const arr=FUN[cmd];
    return reply(arr[Math.floor(Math.random()*arr.length)]);
   }

   if(cmd==="dice"||cmd==="roll")return reply(`🎲 ${Math.floor(Math.random()*6)+1}`);
   if(cmd==="coin")return reply(Math.random()<.5?"🪙 Heads":"🪙 Tails");

   if(cmd==="8ball"){
    const a=["Yes ✅","No ❌","Maybe 🤔","Definitely 🔥","Ask again later 😅"];
    return reply(`🎱 ${a[Math.floor(Math.random()*a.length)]}`);
   }

   if(cmd==="choose"||cmd==="pick"){
    if(!args.length)return reply("Example: .choose pizza burger");
    return reply("🎯 "+args[Math.floor(Math.random()*args.length)]);
   }

   if(cmd==="rate"){
    return reply(`⭐ Rating: ${Math.floor(Math.random()*101)}%`);
   }

   if(cmd==="hug")return reply("🤗 Hug sent!");
   if(cmd==="highfive")return reply("🙌 High five!");
   if(cmd==="clap")return reply("👏👏👏");

   if(cmd==="tagall"){
    if(!from.endsWith("@g.us"))return reply("❌ Group only.");
    const meta=await sock.groupMetadata(from);
    const mentions=meta.participants.map(p=>p.id);
    const body=mentions.map(x=>`@${x.split("@")[0]}`).join(" ");
    return sock.sendMessage(from,{text:`📢 TAG ALL\n\n${body}`,mentions},{quoted:msg});
   }

   if(cmd==="members"||cmd==="count"){
    if(!from.endsWith("@g.us"))return reply("❌ Group only.");
    const meta=await sock.groupMetadata(from);
    return reply(`👥 Members: ${meta.participants.length}`);
   }

   if(cmd==="gname"){
    if(!from.endsWith("@g.us"))return reply("❌ Group only.");
    const meta=await sock.groupMetadata(from);
    return reply(`👥 Group: ${meta.subject}`);
   }

   if(cmd==="gdesc"){
    if(!from.endsWith("@g.us"))return reply("❌ Group only.");
    const meta=await sock.groupMetadata(from);
    return reply(`📝 Description:\n${meta.desc||"No description."}`);
   }

   if(cmd==="admins"){
    if(!from.endsWith("@g.us"))return reply("❌ Group only.");
    const meta=await sock.groupMetadata(from);
    const admins=meta.participants.filter(p=>p.admin);
    if(!admins.length)return reply("❌ No admins found.");
    const mentions=admins.map(p=>p.id);
    return sock.sendMessage(from,{text:"👑 ADMINS\n\n"+mentions.map(x=>`@${x.split("@")[0]}`).join("\n"),mentions},{quoted:msg});
   }

   if(cmd==="groupinfo"){
    if(!from.endsWith("@g.us"))return reply("❌ Group only.");
    const meta=await sock.groupMetadata(from);
    const admins=meta.participants.filter(p=>p.admin).length;
    return reply(`╭──〔 GROUP INFO 〕
├ Name: ${meta.subject}
├ Members: ${meta.participants.length}
├ Admins: ${admins}
├ ID: ${from}
╰────────────`);
   }

   if(cmd==="link"){
    if(!from.endsWith("@g.us"))return reply("❌ Group only.");
    try{
     const code=await sock.groupInviteCode(from);
     return reply(`🔗 Group Link:\nhttps://chat.whatsapp.com/${code}`);
    }catch{
     return reply("❌ Bot ko group invite permission nahi hai.");
    }
   }

   if(cmd==="mirror"||cmd==="flip"||cmd==="rotate"||cmd==="resize"||cmd==="crop"||cmd==="blur"||cmd==="compress"){
    const q=quoted(msg);
    const im=msg.message?.imageMessage||q?.imageMessage;
    if(!im)return reply("📸 Image bhejo/reply karo aur command use karo.");
    const b=await media(im,"image");
    let img=sharp(b);

    if(cmd==="mirror"||cmd==="flip")img=img.flop();
    if(cmd==="rotate")img=img.rotate(90);
    if(cmd==="resize")img=img.resize(512,512,{fit:"inside"});
    if(cmd==="crop")img=img.resize(512,512,{fit:"cover"});
    if(cmd==="blur")img=img.blur(8);
    if(cmd==="compress")img=img.jpeg({quality:60});

    const out=await img.png().toBuffer();
    return sock.sendMessage(from,{image:out,caption:`✅ ${cmd} done`},{quoted:msg});
   }

   if(db.custom[cmd])return reply(db.custom[cmd]);

  }catch(e){
   console.error("COMMAND ERROR:",e);
  }
 });
}

process.on("uncaughtException",e=>console.error("FATAL:",e));
process.on("unhandledRejection",e=>console.error("REJECT:",e));
start().catch(e=>console.error("START ERROR:",e));(cmd === "toimg") {
        const q = quoted(msg);
        const st =
          msg.message?.stickerMessage ||
          q?.stickerMessage;

        if (!st)
          return reply(
            "❌ Sticker ko reply karke .toimg use karo."
          );

        const b = await media(st, "sticker");

        const out = await sharp(b)
          .png()
          .toBuffer();

        return sock.sendMessage(
          from,
          {
            image: out,
            caption: "✅ Converted"
          },
          { quoted: msg }
        );
      }

      /* FUN */

      if (FUN[cmd]) {
        const arr = FUN[cmd];
        return reply(
          arr[Math.floor(Math.random() * arr.length)]
        );
      }

      if (cmd === "dice" || cmd === "roll") {
        return reply(
          `🎲 ${Math.floor(Math.random() * 6) + 1}`
        );
      }

      if (cmd === "coin") {
        return reply(
          Math.random() < 0.5
            ? "🪙 Heads"
            : "🪙 Tails"
        );
      }

      if (cmd === "8ball") {
        const a = [
          "Yes ✅",
          "No ❌",
          "Maybe 🤔",
          "Definitely 🔥",
          "Ask again later 😅"
        ];
        return reply(
          `🎱 ${a[Math.floor(Math.random() * a.length)]}`
        );
      }

      if (cmd === "choose" || cmd === "pick") {
        if (!args.length)
          return reply(
            "Example: .choose pizza burger"
          );

        return reply(
          "🎯 " +
          args[Math.floor(Math.random() * args.length)]
        );
      }

      if (cmd === "rate") {
        return reply(
          `⭐ Rating: ${Math.floor(Math.random() * 101)}%`
        );
      }

      if (cmd === "hug")
        return reply("🤗 *Hug sent!*");

      if (cmd === "highfive")
        return reply("🙌 High five!");

      if (cmd === "clap")
        return reply("👏👏👏");

      /* MUSIC SEARCH */

      if (
        cmd === "play" ||
        cmd === "song" ||
        cmd === "music" ||
        cmd === "ytsearch"
      ) {
        const query = args.join(" ");

        if (!query)
          return reply(
            `🎵 Example: .${cmd} Faded`
          );

        const result =
          await ytSearch(query);

        if (!result.videos?.length)
          return reply("❌ Song nahi mili.");

        const v = result.videos[0];

        return reply(
          `🎵 *${v.title}*\n\n` +
          `👤 ${v.author.name}\n` +
          `⏱️ ${v.timestamp}\n` +
          `👁️ ${v.views}\n\n` +
          `🔗 ${v.url}`
        );
      }

      if (cmd === "lyrics") {
        return reply(
          "🎵 Lyrics feature ke liye lyrics API configure karni hogi."
        );
      }

      /* CUSTOM */

      if (db.custom[cmd])
        return reply(db.custom[cmd]);

    } catch (e) {
      console.error("ERROR:", e);
    }
  });
}

process.on("uncaughtException", e =>
  console.error("FATAL:", e)
);

process.on("unhandledRejection", e =>
  console.error("REJECT:", e)
);

start();
