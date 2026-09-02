const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, downloadContentFromMessage, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const path = require("path");

let config = {};
try { config = require("./config.json"); } catch { config = { botName: "DOST-ULTRA", ownerName: "OWNER", ownerNumber: "910000000000", prefix: ".", mode: "public", botStatus: true }; }

const PREFIX = process.env.PREFIX || config.prefix || ".";
const OWNER = String(process.env.OWNER_NUMBER || config.ownerNumber || "").replace(/\D/g, "");
const COMMAND_FILE = path.join(__dirname, "custom_commands.json");
if (!fs.existsSync(COMMAND_FILE)) fs.writeFileSync(COMMAND_FILE, "{}");
let customCommands = {};
try { customCommands = JSON.parse(fs.readFileSync(COMMAND_FILE, "utf8")); } catch { customCommands = {}; }
let botStatus = true;

function saveCommands() { fs.writeFileSync(COMMAND_FILE, JSON.stringify(customCommands, null, 2)); }
function getText(msg) { return (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "").trim(); }
function getSender(msg) { const jid = msg.key.participant || msg.key.remoteJid || ""; return jid.split("@")[0].split(":")[0].replace(/\D/g, ""); }
function isOwner(msg) { return OWNER && getSender(msg) === OWNER; }
function isGroup(jid) { return jid && jid.endsWith("@g.us"); }
function uptime() { let sec = Math.floor(process.uptime()); const d = Math.floor(sec/86400); sec%=86400; const h = Math.floor(sec/3600); sec%=3600; const m = Math.floor(sec/60); sec%=60; return `${d}d ${h}h ${m}m ${sec}s`; }
async function reply(sock,jid,text,msg){ return sock.sendMessage(jid,{text},{quoted:msg}); }

function helpMenu(){ return `╭┈───〔 DOST-ULTRA 〕┈───⊷\n├✦ Owner: ${config.ownerName}\n├✦ Prefix: ${PREFIX}\n├✦ Mode: ${config.mode}\n├✦ Status: ${botStatus? "🟢 ON" : "🔴 OFF"}\n╰───────────────────⊷\n\n『 DOWNLOADER 』\n⬡ ytmp3, ytmp4, song, video, fb, insta, tiktok, mediafire\n\n『 MEDIA 』\n⬡ sticker, photo, toimg, tovideo, crop, caption, blur, mirror, rotate, gif\n\n『 WHATSAPP 』\n⬡ dp, mydp, tagall, admins, groupinfo, link, kick, add, promote, demote\n\n『 FUN 』\n⬡ roast, joke, meme, fact, shayari, quote, ship, 8ball, dice, coin\n\n『 AI / TOOLS 』\n⬡ gpt, ai, dalle, imagine, remini, upscale, translate\n\n『 BOT 』\n⬡ help, ping, alive, owner, uptime\n\n『 OWNER 』\n⬡ on, off, addcmd, delcmd, listcmd, mode, broadcast`; }

let pairingDone = false;
async function startBot(){
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const sock = makeWASocket({ version, auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({level:"silent"})) }, logger: P({level:"silent"}), browser: Browsers.ubuntu("DOST-ULTRA"), markOnlineOnConnect:false });
  sock.ev.on("creds.update", saveCreds);
  if (!state.creds.registered &&!pairingDone){
    const phoneNumber = process.env.PHONE_NUMBER || config.ownerNumber;
    const cleanNum = String(phoneNumber).replace(/\D/g,"");
    console.log("Requesting pairing for: " + cleanNum);
    setTimeout(async()=>{
      try{
        if (sock.authState.creds.registered) return;
        const code = await sock.requestPairingCode(cleanNum);
        console.log("============================\nPAIRING CODE: " + code + "\n60 SEC VALID\n============================");
        pairingDone=true;
      }catch(e){ console.log("Pair error: "+e.message); }
    },5000);
  }
  sock.ev.on("connection.update", ({connection,lastDisconnect})=>{
    if (connection==="open"){ console.log("✅ DOST-ULTRA CONNECTED"); pairingDone=true; }
    if (connection==="close"){
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code!==DisconnectReason.loggedOut){ console.log("🔄 Reconnecting..."); setTimeout(startBot,5000); }
      else { console.log("❌ Logged out."); }
    }
  });
  sock.ev.on("messages.upsert", async({messages})=>{
    const msg=messages[0]; if(!msg?.message || msg.key.fromMe) return;
    const text=getText(msg); if(!text.startsWith(PREFIX)) return;
    const body=text.slice(PREFIX.length).trim(); if(!body) return;
    const parts=body.split(/\s+/); const command=parts.shift().toLowerCase(); const args=parts.join(" "); const jid=msg.key.remoteJid;
    if(customCommands[command]) return reply(sock,jid,customCommands[command],msg);
    if(command==="ping") return reply(sock,jid,"🏓 Pong!",msg);
    if(command==="alive") return reply(sock,jid,`🤖 ${config.botName} is alive!\n🟢 Status: ON\n⏱️ Uptime: ${uptime()}`,msg);
    if(command==="uptime") return reply(sock,jid,`⏱️ Uptime: ${uptime()}`,msg);
    if(command==="help") return reply(sock,jid,helpMenu(),msg);
  });
}
startBot();
