const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");

const PHONE = (process.env.PHONE_NUMBER || "").replace(/\D/g,"");
const PREFIX = ".";

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const logger = P({ level: "silent" });

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    browser: Browsers.macOS("Desktop"),
    markOnlineOnConnect: true
  });

  sock.ev.on("creds.update", saveCreds);

  if (!state.creds.registered && PHONE) {
    console.log("Waiting for connection...");
    await new Promise(r => setTimeout(r, 5000));
    try {
      const code = await sock.requestPairingCode(PHONE);
      console.log(`\nPAIRING CODE FOR ${PHONE}: ${code}\n`);
    } catch(e){ console.log("Pairing error: " + e.message); }
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") console.log("✅ DOST-ULTRA CONNECTED ON RAILWAY");
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
      if (!shouldReconnect) {
        console.log("Logged out, deleting auth");
        if(fs.existsSync("./auth")) fs.rmSync("./auth", {recursive:true, force:true});
      }
      if (shouldReconnect) setTimeout(startBot, 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({messages}) => {
    const msg = messages[0]; if(!msg?.message || msg.key.fromMe) return;
    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
    if(!text.startsWith(PREFIX)) return;
    const cmd = text.slice(1).split(" ")[0].toLowerCase();
    const jid = msg.key.remoteJid;
    const reply = (t) => sock.sendMessage(jid, {text:t}, {quoted:msg});
    if(cmd==="ping") reply("🏓 Pong! Railway pe online hu");
    if(cmd==="alive") reply("🤖 DOST-ULTRA Alive on Railway ✅");
    if(cmd==="coin") reply(`🪙 ${Math.random()<0.5?"Heads":"Tails"}`);
    if(cmd==="dice") reply(`🎲 ${Math.floor(Math.random()*6)+1}`);
    if(cmd==="help"||cmd==="menu") reply("╭── DOST-ULTRA ──\n├.coin\n├.ping\n├.alive\n├.dice\n╰──────────");
  });
}
startBot();
