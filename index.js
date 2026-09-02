const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const axios = require("axios");
const fs = require("fs");

let PREFIX = ".";
try{ if(fs.existsSync("./prefix.txt")){ PREFIX = fs.readFileSync("./prefix.txt","utf8").trim() || "."; } }catch(e){}

const START_TIME = Date.now();
let BOT_ACTIVE = true;
let MODE = "public";
try{ if(fs.existsSync("./mode.txt")){ MODE = fs.readFileSync("./mode.txt","utf8").trim() || "public"; } }catch(e){}

let SUDO = []; let BANNED = [];
try{ if(fs.existsSync("./sudo.json")){ SUDO = JSON.parse(fs.readFileSync("./sudo.json")); } }catch(e){}
try{ if(fs.existsSync("./banned.json")){ BANNED = JSON.parse(fs.readFileSync("./banned.json")); } }catch(e){}

function saveSudo(){ try{ fs.writeFileSync("./sudo.json", JSON.stringify(SUDO)); }catch(e){} }
function saveBanned(){ try{ fs.writeFileSync("./banned.json", JSON.stringify(BANNED)); }catch(e){} }
function getCustomMenu(){ try{ if(fs.existsSync("./custom_menu.txt")){ return fs.readFileSync("./custom_menu.txt","utf8"); } }catch(e){} return null; }

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({ auth: state, logger: P({level:"silent"}), browser: ["DOST-ULTRA","Chrome","1.0"] });
  sock.ev.on("creds.update", saveCreds);

  if(!state.creds.registered){
    const phone = process.env.PHONE_NUMBER;
    if(phone){ setTimeout(async()=>{ try{ const code = await sock.requestPairingCode(phone.replace(/\D/g,"")); console.log("PAIRING CODE: " + code); }catch(err){ console.log(err.message); } },3000); }
  }

  sock.ev.on("connection.update", (u)=>{
    if(u.connection==="open"){ console.log("DOST-ULTRA ONLINE - PREFIX " + PREFIX); }
    if(u.connection==="close" && u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut){ setTimeout(startBot,3000); }
  });

  sock.ev.on("messages.upsert", async (m)=>{
    const msg = m.messages?.[0];
    if(!msg ||!msg.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
    if(!text) return;
    const clean = text.trim();
    const isGroup = jid.endsWith("@g.us");
    let metadata = null;
    if(isGroup){ try{ metadata = await sock.groupMetadata(jid); }catch(e){} }

    const isOwner = process.env.OWNER_NUMBER? sender.includes(process.env.OWNER_NUMBER.replace(/\D/g,"")) : true;
    const isSudo = SUDO.includes(sender) || isOwner;

    let usedPrefix = null;
    if(clean.startsWith(PREFIX)){ usedPrefix = PREFIX; }
    else if(clean.startsWith(".") && ["setmenu","getmenu","delmenu","setprefix","eval","help
