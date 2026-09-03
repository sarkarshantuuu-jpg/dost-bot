const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const fs = require("fs");
const ytdl = require("@distube/ytdl-core");

const PREFIX = ".";
const START_TIME = Date.now();
let BOT_ACTIVE = true;
if (!fs.existsSync('./custom.json')) fs.writeFileSync('./custom.json', '{}');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })) },
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Dost-Bot", "Chrome", "1.0.0"]
  });
  sock.ev.on("creds.update", saveCreds);
  if (!state.creds.registered) {
    const phone = process.env.PHONE_NUMBER || "919229681078";
    setTimeout(async () => { try { const code = await sock.requestPairingCode(phone.replace(/\D/g,"")); console.log("\nPAIR CODE: "+code+"\n"); } catch(e){} }, 3000);
  }
  sock.ev.on("connection.update", u => { if(u.connection==="open") console.log("ONLINE ✅"); if(u.connection==="close" && u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) setTimeout(startBot,3000); });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0]; if (!msg?.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
    if (!text.trim()) return;

    let custom = JSON.parse(fs.readFileSync('./custom.json'));
    const clean = text.trim();
    if (!clean.startsWith(PREFIX)) return; // hi wala auto reply hata diya

    const parts = clean.slice(PREFIX.length).trim().split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    const args = parts; const query = args.join(" ");

    if (custom[command]) return sock.sendMessage(jid, { text: custom[command] });
    if (command==="off"){BOT_ACTIVE=false; return sock.sendMessage(jid,{text:"BOT OFF ❌"});}
    if (command==="on"){BOT_ACTIVE=true; return sock.sendMessage(jid,{text:"BOT ON ✅"});}
    if (!BOT_ACTIVE) return;

    if (command==="addcmd"){ if(!args[0]) return; custom[args[0].toLowerCase()]=args.slice(1).join(" "); fs.writeFileSync('./custom.json',JSON.stringify(custom)); return sock.sendMessage(jid,{text:`✅.${args[0]} add`}); }
    if (command==="delcmd"){ delete custom[args[0]]; fs.writeFileSync('./custom.json',JSON.stringify(custom)); return sock.sendMessage(jid,{text:"Deleted"}); }
    if (command==="listcmd"){ return sock.sendMessage(jid,{text:"Custom:\n"+(Object.keys(custom).map(v=>"."+v).join("\n")||"Empty")}); }

    if (command==="menu"||command==="help"){
        const buttons=[{buttonId:'.on',buttonText:{displayText:'✅ ON'},type:1},{buttonId:'.off',buttonText:{displayText:'❌ OFF'},type:1},{buttonId:'.ping',buttonText:{displayText:'📊
