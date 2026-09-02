const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs");

let PREFIX = ".";
try{ if(fs.existsSync("./prefix.txt")) PREFIX=fs.readFileSync("./prefix.txt","utf8").trim()||"."; }catch{}

const START_TIME = Date.now();
let BOT_ACTIVE = true;
let MODE = "public";
try{ if(fs.existsSync("./mode.txt")) MODE=fs.readFileSync("./mode.txt","utf8").trim()||"public"; }catch{}
let SUDO = []; let BANNED = [];
try{ if(fs.existsSync("./sudo.json")) SUDO=JSON.parse(fs.readFileSync("./sudo.json")); }catch{}
try{ if(fs.existsSync("./banned.json")) BANNED=JSON.parse(fs.readFileSync("./banned.json")); }catch{}

function saveSudo(){ try{fs.writeFileSync("./sudo.json", JSON.stringify(SUDO))}catch{} }
function saveBanned(){ try{fs.writeFileSync("./banned.json", JSON.stringify(BANNED))}catch{} }
function getCustomMenu(){ try{ if(fs.existsSync("./custom_menu.txt")) return fs.readFileSync("./custom_menu.txt","utf8"); }catch{} return null; }

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
    if(connection==="open") console.log("✅ DOST-ULTRA MEGA ONLINE | PREFIX: "+PREFIX);
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

    let usedPrefix=null;
    if(clean.startsWith(PREFIX)) usedPrefix=PREFIX;
    else if(clean.startsWith(".") && ["setmenu","getmenu","delmenu","setprefix","eval"].includes(clean.slice(1).split(" ")[0].toLowerCase())) usedPrefix=".";
    else{
      if((clean.toLowerCase()==="hi"||clean.toLowerCase()==="hello") && BOT_ACTIVE) await sock.sendMessage(jid,{text:"Hello jaan ❤️\n"+PREFIX+"help likho"});
      return;
    }

    const cmdBody=clean.slice(usedPrefix.length).trim();
    const parts=cmdBody.split(/\s+/);
    const command=parts.shift()?.toLowerCase();
    const args=parts;
    const query=args.join(" ");
    const fullAfterCmd=clean.slice(usedPrefix.length+command.length).trim();

    const isOwner = process.env.OWNER_NUMBER? sender.includes(process.env.OWNER_NUMBER.replace(/\D/g,"")) : true;
    const isSudo = SUDO.includes(sender) || isOwner;

    try{
      // ===== WSP EDIT SYSTEM - OWNER ONLY =====
      if(command==="setmenu"){ if(!isOwner) return sock.sendMessage(jid,{text:"❌ Owner only"}); if(!fullAfterCmd) return sock.sendMessage(jid,{text:"Use:.setmenu <menu text>"}); fs.writeFileSync("./custom_menu.txt", fullAfterCmd); return sock.sendMessage(jid,{text:"✅ Menu saved! "+PREFIX+"help likh ke dekho"}); }
      if(command==="getmenu"){ const m=getCustomMenu(); return sock.sendMessage(jid,{text: m?m.slice(0,4000):"Default menu laga hai"}); }
      if(command==="delmenu"){ if(!isOwner) return; if(fs.existsSync("./custom_menu.txt")) fs.unlinkSync("./custom_menu.txt"); return sock.sendMessage(jid,{text:"✅ Default menu restored"}); }
      if(command==="setprefix"){ if(!isOwner) return; if(!args[0]) return sock.sendMessage(jid,{text:"Example:.setprefix!"}); PREFIX=args[0]; fs.writeFileSync("./prefix.txt", PREFIX); return sock.sendMessage(jid,{text:"✅ Prefix: "+PREFIX+" | Ab se "+PREFIX+"help"}); }
      if(command==="eval"){ if(!isOwner) return; try{ let r=eval(query); return sock.sendMessage(jid,{text:"EVAL:\n"+String(r)});}catch(e){return sock.sendMessage(jid,{text:"Error: "+e.message})} }

      // BOT CONTROL
      if(command==="on"){ BOT_ACTIVE=true; return sock.sendMessage(jid,{text:"🟢 BOT ON"}); }
      if(command==="off"){ BOT_ACTIVE=false; return sock.sendMessage(jid,{text:"🔴 BOT OFF - "+PREFIX+"on se ON karo"}); }
      if(command==="bot"||command==="status"){ return sock.sendMessage(jid,{text:"╭───〔 STATUS 〕───\n├ Bot: "+(BOT_ACTIVE?"ON 🟢":"OFF 🔴")+"\n├ Prefix: "+PREFIX+"\n├ Mode: "+MODE+"\n├ Runtime: "+Math.floor((Date.now()-START_TIME)/60000)+"m\n╰────────────"}); }
      if(!BOT_ACTIVE && command!=="on") return;
      if(command==="mode"){ if(!isOwner) return; MODE=query==="private"?"private":"public"; fs.writeFileSync("./mode.txt", MODE); return sock.sendMessage(jid,{text:"Mode: "+MODE}); }
      if(MODE==="private" &&!isSudo) return;

      // HELP
      if(command==="help"||command==="menu"){
        const custom=getCustomMenu();
        if(custom){ return sock.sendMessage(jid,{text: custom.replace(/{runtime}/g, Math.floor((Date.now()-START_TIME)/60000)+"m").replace(/{prefix}/g, PREFIX)}); }
        const rt=Math.floor((Date.now()-START_TIME)/60000);
        const menu="╭┈───〔 DOST-ULTRA 〕┈───⊷\n├✦ Owner: nexxxr\n├✦ Commands: 100+\n├✦ Runtime: "+rt+"m\n├✦ Prefix: "+PREFIX+"\n├✦ Mode: "+MODE+"\n╰───────────────────⊷\n\n『 DOWNLOADER 』\n⬡ ytmp3, ytmp4, song, video, fb, insta, tiktok, media
