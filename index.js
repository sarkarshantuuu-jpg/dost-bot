const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const fs = require("fs");

const PREFIX = ".";
const START_TIME = Date.now();
let BOT_ACTIVE = true;

// CUSTOM COMMANDS LOAD
let CUSTOM_CMDS = {};
if (fs.existsSync("./custom.json")) {
  try { CUSTOM_CMDS = JSON.parse(fs.readFileSync("./custom.json")); } catch {}
}
function saveCustom() { fs.writeFileSync("./custom.json", JSON.stringify(CUSTOM_CMDS, null, 2)); }

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({ auth: state, logger: P({ level: "silent" }), printQRInTerminal: false });
  sock.ev.on("creds.update", saveCreds);

  if (!state.creds.registered) {
    const phone = process.env.PHONE_NUMBER;
    if (!phone) {
      console.log("PHONE_NUMBER missing");
    } else {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phone.replace(/\D/g, ""));
          console.log("==============================");
          console.log("PAIRING CODE: " + code);
          console.log("==============================");
        } catch (e) {
          console.log("Pairing Error: " + e.message);
        }
      }, 3000);
    }
  }

  sock.ev.on("connection.update", update => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") console.log("DOST BOT ONLINE");
    if (connection === "close") {
      const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      if (!loggedOut) setTimeout(startBot, 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
    if (!text) return;
    const clean = text.trim();

    if (!clean.startsWith(PREFIX)) {
      if ((clean.toLowerCase() === "hi" || clean.toLowerCase() === "hello") && BOT_ACTIVE) {
        await sock.sendMessage(jid, { text: "Hello jaan! Dost bot online hai ❤️\n.help likho" });
      }
      return;
    }

    const parts = clean.slice(PREFIX.length).trim().split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    const query = parts.join(" ");

    try {
      // BOT CONTROL
      if (command === "off") { BOT_ACTIVE = false; return sock.sendMessage(jid, { text: "🔴 *BOT OFF* ho gaya\nON ke liye *.on* likho" }); }
      if (command === "on") { BOT_ACTIVE = true; return sock.sendMessage(jid, { text: "🟢 *BOT ON* ho gaya 🔥" }); }
      if (command === "bot") { return sock.sendMessage(jid, { text: "BOT STATUS: " + (BOT_ACTIVE? "ON 🟢" : "OFF 🔴") }); }
      if (!BOT_ACTIVE) return;

      // --- WSP SE COMMAND ADD SYSTEM ---
      if (command === "addcmd") {
        let name = parts[0]?.toLowerCase();
        let reply = parts.slice(1).join(" ");
        if (!name ||!reply) return sock.sendMessage(jid, { text: "Use:.addcmd <naam> <reply>\nEx:.addcmd insta Follow karo @nexxxr" });
        CUSTOM_CMDS[name] = reply;
        saveCustom();
        return sock.sendMessage(jid, { text: "✅ Command *." + name + "* add ho gaya!\nReply: " + reply });
      }
      if (command === "delcmd") {
        let name = parts[0]?.toLowerCase();
        if (!CUSTOM_CMDS[name]) return sock.sendMessage(jid, { text: "Ye command hai hi nahi" });
        delete CUSTOM_CMDS[name];
        saveCustom();
        return sock.sendMessage(jid, { text: "🗑️ *." + name + "* delete ho gaya" });
      }
      if (command === "listcmd") {
        let list = Object.keys(CUSTOM_CMDS);
        if (!list.length) return sock.sendMessage(jid, { text: "Koi custom command nahi hai" });
        return sock.sendMessage(jid, { text: "📜 Custom Commands:\n." + list.join("\n.") });
      }
      if (command === "editcmd") {
        let name = parts[0]?.toLowerCase
