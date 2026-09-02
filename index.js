const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs");

// === CONFIG ===
let PREFIX = ".";
if(fs.existsSync("./prefix.txt")) PREFIX = fs.readFileSync("./prefix.txt","utf8").trim() || ".";
const START_TIME = Date.now();
let BOT_ACTIVE = true;
let MODE = fs.existsSync("./mode.txt")? fs.readFileSync("./mode.txt","utf8") : "public";
let SUDO = fs.existsSync("./sudo.json")? JSON.parse(fs.readFileSync("./sudo.json")) : [];
let BANNED = fs.existsSync("./banned.json")? JSON.parse(fs.readFileSync("./banned.json")) : [];

function saveSudo(){ fs.writeFileSync("./sudo.json", JSON.stringify(SUDO)); }
function saveBanned(){ fs.writeFileSync("./banned.json", JSON.stringify(BANNED)); }
function getCustomMenu(){ if(fs.existsSync("./custom_menu.txt")) return fs.readFileSync("./custom_menu.txt","utf8"); return null; }

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({ auth: state, logger: P({ level: "silent" }), printQRInTerminal: false, browser: ["DOST-ULTRA","Chrome","1.0"] });
  sock.ev.on("creds.update", saveCreds);

  if (!state.creds.registered) {
    const phone = process.env.PHONE_NUMBER;
    if(phone) setTimeout(async()=>{ try{ const code=await sock.requestPairingCode(phone.replace(/\D/g,"")); console.log("PAIRING CODE: "+code);}catch(e){ console.log(e.message);} },3000);
  }

  sock.ev.on("connection.update", u=>{
    if(u.connection==="open") console.log("✅ DOST-ULTRA ONLINE | PREFIX: "+PREFIX);
    if(u.connection==="close" && u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) setTimeout(startBot,3000);
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
    let metadata=null; if(isGroup) try{ metadata=await sock.groupMetadata(jid);}catch{}
    const isOwner = process.env.OWNER_NUMBER? sender.includes(process.env.OWNER_NUMBER.replace(/\D/g,"")) : true;
    const isSudo = SUDO.includes(sender) || isOwner;

    // Prefix check - allow. for owner edit cmds even if prefix changed
    let usedPrefix = null;
    if(clean.startsWith(PREFIX)) usedPrefix = PREFIX;
    else if(clean.startsWith(".") && ["setmenu","getmenu","setprefix","eval","mode"].includes(clean.slice(1).split(" ")[0].toLowerCase())) usedPrefix = ".";
    else if(!clean.startsWith(PREFIX)) {
      if((clean.toLowerCase()==="hi"||clean.toLowerCase()==="hello") && BOT_ACTIVE) await sock.sendMessage(jid,{text:"Hello jaan ❤️\n"+PREFIX+"help likho"});
      return;
    }

    const withoutPrefix = clean.slice(usedPrefix.length).trim();
    const parts=withoutPrefix.split(/\s+/);
    const command=parts.shift()?.toLowerCase();
    const args=parts;
    const query=args.join(" ");
    const fullAfterCmd = clean.slice(usedPrefix.length + command.length).trim();

    try{
      // ===== WSP EDIT SYSTEM =====
      if(command==="setmenu"){
        if(!isOwner) return sock.sendMessage(jid,{text:"❌ Owner only"});
        if(!fullAfterCmd) return sock.sendMessage(jid,{text:"Likh:.setmenu tera menu yaha\n{runtime} = runtime\n{prefix} = prefix auto"});
        fs.writeFileSync("./custom_menu.txt", fullAfterCmd);
        return sock.sendMessage(jid,{text:"✅ Menu save ho gaya!\nAb "+PREFIX+"help likh"});
      }
      if(command==="getmenu"){
        const m=getCustomMenu() || "Default menu hai, custom nahi laga";
        return sock.sendMessage(jid,{text:m.slice(0,4000)});
      }
      if(command==="delmenu"){
        if(!isOwner) return;
        if(fs.existsSync("./custom_menu.txt")) fs.unlinkSync("./custom_menu.txt");
        return sock.sendMessage(jid,{text:"✅ Custom menu delete, default ayega"});
      }
      if(command==="setprefix"){
        if(!isOwner) return;
        if(!args[0]) return sock.sendMessage(jid,{text:"Example:.setprefix!"});
        PREFIX=args[0]; fs.writeFileSync("./prefix.txt", PREFIX);
        return sock.sendMessage(jid,{text:"✅ Prefix: "+PREFIX+" ho gaya\nAb "+PREFIX+"help likhna"});
      }
      if(command==="eval"){
        if(!isOwner) return;
        try{ let res=eval(query); return sock.sendMessage(jid,{text:"EVAL Result:\n"+String(res)}); }catch(e){ return sock.sendMessage(jid,{text:"Error: "+e.message}); }
      }

      // ===== BOT CONTROL =====
      if(command==="on"){ BOT_ACTIVE=true; return sock.sendMessage(jid,{text:"🟢 BOT ON"}); }
      if(command==="off"){ BOT_ACTIVE=false; return sock.sendMessage(jid,{text:"🔴 BOT OFF\n"+PREFIX+"on se ON"}); }
      if(command==="bot"||command==="status"){ return sock.sendMessage(jid,{text:"╭──〔 STATUS 〕──\n├ Bot: "+(BOT_ACTIVE?"ON 🟢":"OFF 🔴")+"\n├ Prefix: "+PREFIX+"\n├ Mode: "+MODE+"\n├ Runtime: "+Math.floor((Date.now()-START_TIME)/60000)+"m\n╰──────────"}); }
      if(!BOT_ACTIVE && command!=="on") return;
      if(command==="mode"){ if(!isOwner) return; MODE=query==="private"?"private":"public"; fs.writeFileSync("./mode.txt", MODE); return sock.sendMessage(jid,{text:"Mode: "+MODE}); }
      if(MODE==="private" &&!isSudo) return;
      if(BANNED.includes(sender)) return;

      // ===== HELP MENU =====
      if(command==="help"||command==="menu"){
        const custom=getCustomMenu();
        if(custom){
          let out=custom.replace(/{runtime}/g, Math.floor((Date.now()-START_TIME)/60000)+"m").replace(/{prefix}/g, PREFIX);
          return sock.sendMessage(jid,{text:out});
        }
        const rt=Math.floor((Date.now()-START_TIME)/60000);
        const menu="╭┈───〔 DOST-ULTRA 〕┈───⊷\n├✦ Owner: nexxxr\n├✦ Commands: 100+\n├✦ Runtime: "+rt+"m\n├✦ Prefix: "+PREFIX+"\n├✦ Mode: "+MODE+"\n╰───────────────────⊷\n\n『 DOWNLOADER 』\n⬡ ytmp3, ytmp4, song, video, fb, insta, tiktok, mediafire\n\n『 MEDIA 』\n⬡ sticker, photo, toimg, crop, caption, blur, mirror, rotate\n\n『 WHATSAPP 』\n⬡ dp, mydp, tagall, admins, groupinfo, link, kick, add, promote, demote\n\n『 FUN 』\n⬡ roast, joke, meme, fact, shayari, quote, ship, 8ball, dice, coin\n\n『 AI / TOOLS 』\n⬡ gpt, ai, remini, upscale, translate\n\n『 OWNER 』\n⬡ ban, unban, sudo, delsudo, listsudo, mode, restart, setmenu, getmenu, delmenu, setprefix, eval\n\n『 BOT 』\n⬡ help, ping, alive, owner, uptime, on, off, bot";
        return sock.sendMessage(jid,{text:menu});
      }

      if(command==="ping") return sock.sendMessage(jid,{text:"🏓 Pong! "+Math.floor((Date.now()-START_TIME)/1000)+"s"});
      if(command==="alive") return sock.sendMessage(jid,{text:"✅ DOST-ULTRA ALIVE 🔥\nRuntime: "+Math.floor((Date.now()-START_TIME)/60000)+"m\nOwner: nexxxr"});
      if(command==="owner") return sock.sendMessage(jid,{text:"👑 wa.me/"+(process.env.OWNER_NUMBER||"")});
      if(command==="uptime"){ const s=Math.floor((Date.now()-START_TIME)/1000); return sock.sendMessage(jid,{text:"⏱️ "+Math.floor(s/3600)+"h "+Math.floor((s%3600)/60)+"m "+(s%60)+"s"}); }

      // ===== MEDIA =====
      const context=msg.message.extendedTextMessage?.contextInfo;
      const quotedMessage=context?.quotedMessage;
      async function getQuotedBuffer(){ if(!quotedMessage) return null; const quoted={key:{remoteJid:jid,id:context.stanzaId,participant:context.participant},message:quotedMessage}; return downloadMediaMessage(quoted,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage}); }

      if(command==="sticker"||command==="s"){
        let buf=null;
        if(msg.message.imageMessage) buf=await downloadMediaMessage(msg,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage});
        else if(quotedMessage?.imageMessage) buf=await getQuotedBuffer();
        else return sock.sendMessage(jid,{text:"❌ Photo ko reply karke "+PREFIX+"sticker likho"});
        const st=await sharp(buf).resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).webp().toBuffer();
        return sock.sendMessage(jid,{sticker:st});
      }
      if(command==="photo"||command==="toimg"){
        if(!quotedMessage?.stickerMessage) return sock.sendMessage(jid,{text:"Sticker reply karo"});
        const buf
