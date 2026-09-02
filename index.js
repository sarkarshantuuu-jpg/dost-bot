const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs");

const PREFIX = ".";
const START_TIME = Date.now();
let BOT_ACTIVE = true;
let MODE = "public";
let SUDO = [];
let BANNED = [];

if(fs.existsSync("./sudo.json")){ try{SUDO=JSON.parse(fs.readFileSync("./sudo.json"))}catch{}}
if(fs.existsSync("./banned.json")){ try{BANNED=JSON.parse(fs.readFileSync("./banned.json"))}catch{}}

function saveSudo(){ fs.writeFileSync("./sudo.json", JSON.stringify(SUDO)); }
function saveBanned(){ fs.writeFileSync("./banned.json", JSON.stringify(BANNED)); }

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({ auth: state, logger: P({ level: "silent" }), printQRInTerminal: false, browser: ["DOST-ULTRA","Chrome","1.0"] });
  sock.ev.on("creds.update", saveCreds);

  if (!state.creds.registered) {
    const phone = process.env.PHONE_NUMBER;
    if (!phone) console.log("PHONE_NUMBER missing");
    else setTimeout(async()=>{ try{ const code=await sock.requestPairingCode(phone.replace(/\D/g,"")); console.log("=============================="); console.log("PAIRING CODE: "+code); console.log("==============================");}catch(e){ console.log("Pairing Error: "+e.message);} },3000);
  }

  sock.ev.on("connection.update", u=>{
    const {connection, lastDisconnect}=u;
    if(connection==="open") console.log("✅ DOST-ULTRA ONLINE");
    if(connection==="close"){ if(lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) setTimeout(startBot,3000); }
  });

  sock.ev.on("messages.upsert", async ({messages})=>{
    const msg=messages?.[0];
    if(!msg?.message || msg.key.fromMe) return;
    const jid=msg.key.remoteJid;
    const sender=msg.key.participant || jid;
    const text=msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
    if(!text) return;
    const clean=text.trim();
    const isGroup=jid.endsWith("@g.us");
    let metadata=null; if(isGroup) try{ metadata=await sock.groupMetadata(jid); }catch{}

    if(BANNED.includes(sender) || BANNED.includes(jid)) return;

    if(!clean.startsWith(PREFIX)){
      if((clean.toLowerCase()==="hi"||clean.toLowerCase()==="hello") && BOT_ACTIVE) await sock.sendMessage(jid,{text:"Hello jaan ❤️\n.help likho"});
      return;
    }

    const parts=clean.slice(1).trim().split(/\s+/);
    const command=parts.shift()?.toLowerCase();
    const args=parts;
    const query=args.join(" ");

    const isOwner = process.env.OWNER_NUMBER? sender.includes(process.env.OWNER_NUMBER.replace(/\D/g,"")) : true;
    const isSudo = SUDO.includes(sender) || isOwner;

    try{
      // BOT CONTROL
      if(command==="on"){ BOT_ACTIVE=true; return sock.sendMessage(jid,{text:"🟢 BOT ON"}); }
      if(command==="off"){ BOT_ACTIVE=false; return sock.sendMessage(jid,{text:"🔴 BOT OFF -.on se ON karo"}); }
      if(command==="bot"||command==="status"){ return sock.sendMessage(jid,{text:"╭───〔 STATUS 〕───\n├ Bot: "+(BOT_ACTIVE?"ON 🟢":"OFF 🔴")+"\n├ Mode: "+MODE+"\n├ Runtime: "+Math.floor((Date.now()-START_TIME)/60000)+"m\n╰────────────"}); }
      if(!BOT_ACTIVE && command!=="on") return;

      if(command==="mode"){ if(!isOwner) return; MODE=query==="private"?"private":"public"; return sock.sendMessage(jid,{text:"Mode: "+MODE}); }
      if(MODE==="private" &&!isSudo) return;

      // HELP - REAL MENU
      if(command==="help"||command==="menu"){
        const rt=Math.floor((Date.now()-START_TIME)/60000);
        const menu="╭┈───〔 DOST-ULTRA 〕┈───⊷\n├✦ Owner: nexxxr\n├✦ Commands: 100+\n├✦ Runtime: "+rt+"m\n├✦ Prefix:.\n├✦ Mode: "+MODE+"\n╰───────────────────⊷\n\n『 DOWNLOADER 』\n⬡ ytmp3, ytmp4, song, video, fb, insta, tiktok, mediafire\n\n『 MEDIA 』\n⬡ sticker, photo, toimg, tovideo, crop, caption, blur, mirror, rotate, gif\n\n『 WHATSAPP 』\n⬡ dp, mydp, tagall, admins, groupinfo, link, kick, add, promote, demote\n\n『 FUN 』\n⬡ roast, joke, meme, fact, shayari, quote, ship, 8ball, dice, coin\n\n『 AI / TOOLS 』\n⬡ gpt, ai, dalle, imagine, remini, upscale, translate\n\n『 OWNER 』\n⬡ ban, unban, sudo, delsudo, listsudo, mode, restart, update, broadcast\n\n『 BOT 』\n⬡ help, ping, alive, owner, uptime, on, off, bot";
        return sock.sendMessage(jid,{text:menu});
      }

      if(command==="ping") return sock.sendMessage(jid,{text:"🏓 Pong! "+Math.floor((Date.now()-START_TIME)/1000)+"s"});
      if(command==="alive") return sock.sendMessage(jid,{text:"✅ DOST-ULTRA ALIVE 🔥\n⏱️ "+Math.floor((Date.now()-START_TIME)/60000)+"m\n👑 nexxxr"});
      if(command==="owner") return sock.sendMessage(jid,{text:"👑 Owner: wa.me/"+(process.env.OWNER_NUMBER||"")});
      if(command==="uptime"){ const s=Math.floor((Date.now()-START_TIME)/1000); return sock.sendMessage(jid,{text:"⏱️ "+Math.floor(s/3600)+"h "+Math.floor((s%3600)/60)+"m "+(s%60)+"s"}); }

      // MEDIA HELPERS
      const context=msg.message.extendedTextMessage?.contextInfo;
      const quotedMessage=context?.quotedMessage;
      async function getQuotedBuffer(){ if(!quotedMessage) return null; const quoted={key:{remoteJid:jid,id:context.stanzaId,participant:context.participant},message:quotedMessage}; return downloadMediaMessage(quoted,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage}); }

      if(command==="sticker"||command==="s"){
        const isImg=msg.message.imageMessage||quotedMessage?.imageMessage;
        if(!isImg){ return sock.sendMessage(jid,{text:"❌ Photo ko reply karke.sticker likho"}); }
        let buf=isImg? await downloadMediaMessage(msg,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage}) : await getQuotedBuffer();
        const st=await sharp(buf).resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).webp().toBuffer();
        return sock.sendMessage(jid,{sticker:st});
      }
      if(command==="photo"||command==="toimg"){
        if(!quotedMessage?.stickerMessage) return sock.sendMessage(jid,{text:"Sticker reply karo"});
        const buf=await getQuotedBuffer(); const img=await sharp(buf).png().toBuffer(); return sock.sendMessage(jid,{image:img,caption:"Done"});
      }
      if(["crop","blur","mirror","rotate"].includes(command)){
        if(!quotedMessage?.imageMessage &&!msg.message.imageMessage) return sock.sendMessage(jid,{text:"Photo reply karo"});
        let buf=quotedMessage?await getQuotedBuffer():await downloadMediaMessage(msg,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage});
        let out=buf;
        if(command==="crop") out=await sharp(buf).resize(800,800,{fit:"cover"}).jpeg().toBuffer();
        if(command==="blur") out=await sharp(buf).blur(8).jpeg().toBuffer();
        if(command==="mirror") out=await sharp(buf).flop().jpeg().toBuffer();
        if(command==="rotate") out=await sharp(buf).rotate(90).jpeg().toBuffer();
        return sock.sendMessage(jid,{image:out});
      }
      if(command==="caption"){ if(!quotedMessage?.imageMessage) return sock.sendMessage(jid,{text:".caption <text>"}); const b=await getQuotedBuffer(); return sock.sendMessage(jid,{image:b,caption:query||" "}); }

      // WHATSAPP GROUP
      if(command==="dp"){ if(!args[0]) return sock.sendMessage(jid,{text:".dp 9198xxxx"}); try{ const url=await sock.profilePictureUrl(args[0].replace(/\D/g,"")+"@s.whatsapp.net","image"); return sock.sendMessage(jid,{image:{url},caption:"DP"});}catch{ return sock.sendMessage(jid,{text:"DP nahi mili"});} }
      if(command==="mydp"){ try{ const url=await sock.profilePictureUrl(sock.user.id,"image"); return sock.sendMessage(jid,{image:{url}});}catch{ return sock.sendMessage(jid,{text:"DP nahi"});} }
      if(command==="tagall"){ if(!isGroup) return; const mentions=metadata.participants.map(p=>p.id); const txt=mentions.map((id,i)=> (i+1)+". @"+id.split("@")[0]).join("\n"); return sock.sendMessage(jid,{text:"📢 TAG ALL\n\n"+txt,mentions}); }
      if(command==="admins"){ if(!isGroup) return; const admins=metadata.participants.filter(p=>p.admin).map(p=>p.id); return sock.sendMessage(jid,{text:"👑 ADMINS\n"+admins.map((a,i)=> (i+1)+". @"+a.split("@")[0]).join("\n"),mentions:admins}); }
      if(command==="groupinfo"||command==="gcinfo"){ if(!isGroup) return; return sock.sendMessage(jid,{text:"👥 "+metadata.subject+"\n👤 "+metadata.participants.length+" members\n📅 Created: "+new Date(metadata.creation*1000).toDateString()}); }
      if(command==="link"||command==="gclink"){ if(!isGroup) return; try{ const code=await sock.groupInviteCode(jid); return sock.sendMessage(jid,{text:"https://chat.whatsapp.com/"+code});}catch{ return sock.sendMessage(jid,{text:"Bot admin nahi hai"});} }
      if(command==="kick"){ if(!isGroup||!isSudo) return; if(!context?.participant) return sock.sendMessage(jid,{text:"Kisko kick karna hai reply karo"}); await sock.groupParticipantsUpdate(jid,[context.participant],"remove"); return sock.sendMessage(jid,{text:"Kicked"}); }
      if(command==="add"){ if(!isGroup||!isSudo) return; if(!args[0]) return; await sock.groupParticipantsUpdate(jid,[args[0].replace(/\D/g,"")+"@s.whatsapp.net"],"add"); return sock.sendMessage(jid,{text:"Added"}); }
      if(command==="promote"){ if(!isGroup||!isSudo) return; await sock.groupParticipantsUpdate(jid,[context.participant],"promote"); return sock.sendMessage(jid,{text:"Promoted"}); }
      if(command==="demote"){ if(!isGroup||!isSudo) return; await sock.groupParticipantsUpdate(jid,[context.participant],"demote"); return sock.sendMessage(jid,{text:"Demoted"}); }

      // FUN
      if(command==="joke"){ const j=["Teacher: Homework? Me: Kal pakka 😂","WiFi slow? Router ko ghooro 😆","Pappu: Light gayi? Dimag ki?"]; return sock.sendMessage(jid,{text:j[Math.floor(Math.random()*j.length)]}); }
      if(command==="fact"){ const f=["Octopus ke 3 hearts","Honey kabhi kharab nahi hota","Earth ka 71% paani"]; return sock.sendMessage(jid,{text:"🧠 "+f[Math.floor(Math.random()*f.length)]}); }
      if(command==="shayari") return sock.sendMessage(jid,{text:"✨ Dosti wo nahi jo har waqt saath ho,\nDosti wo hai jo door rehkar bhi yaad ho ❤️"});
      if(command==="quote"){ const q=["Believe in yourself","Small steps daily","Never give up"]; return sock.sendMessage(jid,{text:"💭 "+q[Math.floor(Math.random()*q.length)]}); }
      if(command==="roast"){ const r=["Bhai tera confidence alag level","Calculator bhi confuse ho jata tujhe dekh ke","Tu special hai category unknown"]; return sock.sendMessage(jid,{text:"🔥 "+r[Math.floor(Math.random()*r.length)]}); }
      if(command==="ship"){ return sock.sendMessage(jid,{text:"❤️ Compatibility: "+Math.floor(Math.random()*101)+"%"}); }
      if(command==="8ball"){ const a=["Haan!","Nahi!","Shayad","Definitely!","Puch mat 😅"]; return sock.sendMessage(jid,{text:"🎱 "+a[Math.floor(Math.random()*a.length)]}); }
      if(command==="dice") return sock.sendMessage(jid,{text:"🎲 "+(Math.floor(Math.random()*6)+1)});
      if(command==="coin") return sock.sendMessage(jid,{text:"🪙 "+(Math.random()<0.5?"Heads":"Tails")});
      if(command==="meme") return sock.sendMessage(jid,{text:"😂 Meme:\nTeacher: Homework kaha hai?\nMe: Sir network issue tha 😭"});

      // AI / TOOLS
      if(command==="gpt"||command==="ai"){
        if(!query) return sock.sendMessage(jid,{text:".gpt <sawal>"});
        try{
          if(!process.env.OPENAI_KEY) return sock.sendMessage(jid,{text:"🤖 GPT: "+query+"\n\n(Ye demo reply hai, OPENAI_KEY env add karo real AI ke liye)"});
          const res=await axios.post("https://api.openai.com/v1/chat/completions",{model:"gpt-3.5-turbo",messages:[{role:"user",content:query}]},{headers:{Authorization:"Bearer "+process.env.OPENAI_KEY}});
          return sock.sendMessage(jid,{text:res.data.choices[0].message.content});
        }catch(e){ return sock.sendMessage(jid,{text:"AI Error: "+e.message}); }
      }
      if(command==="translate"||command==="trt"){ if(!query) return sock.sendMessage(jid,{text:".translate hello"}); try{ const r=await axios.get("https://api.mymemory.translated.net/get?q="+encodeURIComponent(query)+"&langpair=en|hi"); return sock.sendMessage(jid,{text:"🔤 "+r.data.responseData.translatedText}); }catch{ return sock.sendMessage(jid,{text:"Translate fail"});} }
      if(command==="remini"||command==="upscale"||command==="hd"){
        if(!quotedMessage?.imageMessage &&!msg.message.imageMessage) return sock.sendMessage(jid,{text:"Photo reply karo"});
        let buf=quotedMessage?await getQuotedBuffer():await downloadMediaMessage(msg,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage});
        const up=await sharp(buf).resize({width:2048,height:2048,fit:"inside"}).sharpen().jpeg().toBuffer();
        return sock.sendMessage(jid,{image:up,caption:"✨ Upscaled HD"});
      }
      if(command==="dalle"||command==="imagine"){ return sock.sendMessage(jid,{text:"🎨 Imagine: "+query+"\n\n(OPENAI_KEY add karo to real image banega, abhi demo mode me hai)"}); }

      // DOWNLOADER (DEMO WORKING)
      if(["ytmp3","song"].includes(command)){ if(!query) return sock.sendMessage(jid,{text:".ytmp3 <youtube link>"}); return sock.sendMessage(jid,{text:"🎵 YTMP3 Downloader\nLink: "+query+"\n\nIske liye YT API key chahiye, abhi demo me link mil gaya, download ke liye api add karna padega. Bol to mai YT wala full code de du."}); }
      if(["ytmp4","video"].includes(command)){ if(!query) return sock.sendMessage(jid,{text:".ytmp4 <link>"}); return sock.sendMessage(jid,{text:"🎬 YTMP4 Downloader\nLink: "+query+"\n\nDemo mode - API add karne par real video ayega."}); }
      if(command==="fb"||command==="insta"||command==="tiktok"||command==="mediafire"){ return sock.sendMessage(jid,{text:"📥 "+command.toUpperCase()+" Downloader\nLink: "+query+"\n\nAPI key lagane par real download hoga. Abhi ke liye demo active hai."}); }

      // OWNER
      if(command==="ban"){ if(!isOwner) return; BANNED.push(context?.participant||args[0]); saveBanned(); return sock.sendMessage(jid,{text:"Banned"}); }
      if(command==="unban"){ if(!isOwner) return; BANNED=BANNED.filter(x=>x!== (context?.participant||args[0])); saveBanned(); return sock.sendMessage(jid,{text:"Unbanned"}); }
      if(command==="sudo"){ if(!isOwner) return; if(!args[0]) return; SUDO.push(args[0].replace(/\D/g,"")+"@s.whatsapp.net"); saveSudo(); return sock.sendMessage(jid,{text:"Sudo added"}); }
      if(command==="delsudo"){ if(!isOwner) return; SUDO=SUDO.filter(x=>!x.includes(args[0])); saveSudo(); return sock.sendMessage(jid,{text:"Sudo removed"}); }
      if(command==="listsudo"){ return sock.sendMessage(jid,{text:"SUDO LIST:\n"+SUDO.join("\n")}); }
      if(command==="broadcast"||command==="bc"){ if(!isOwner) return; return sock.sendMessage(jid,{text:"Broadcast ke liye.bc <msg> - abhi groups me bhejne ke liye alag code lagega"}); }
      if(command==="restart"){ if(!isOwner) return; await sock.sendMessage(jid,{text:"Restarting..."}); process.exit(0); }

      return sock.sendMessage(jid,{text:"❓ Unknown command..help likho"});

    }catch(err){ console.log(err); await sock.sendMessage(jid,{text:"Error: "+err.message}); }
  });
}
startBot();
