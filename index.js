const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const path = require("path");

const PREFIX = process.env.PREFIX || ".";
const PHONE = (process.env.PHONE_NUMBER || "").replace(/\D/g, "");
const OWNER = (process.env.OWNER_NUMBER || "").replace(/\D/g, "");
const BOT = "DOST-MD";
const AUTH = "./auth";
const DB = "./database.json";

if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify({ enabled: true, custom: {} }));
function loadDB() { try { return JSON.parse(fs.readFileSync(DB, "utf8")); } catch { return { enabled: true, custom: {} }; } }
function saveDB(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); }
function isOwner(jid) { return OWNER && jid.split("@")[0].replace(/\D/g, "") === OWNER; }
function textOf(m) { return m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || ""; }

async function start() {
  if (fs.existsSync(AUTH)) {
    const credsFile = path.join(AUTH, "creds.json");
    if (!fs.existsSync(credsFile) && PHONE) {
      console.log("Cleaning old auth...");
      fs.rmSync(AUTH, { recursive: true, force: true });
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH);
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    browser: [BOT, "Chrome", "1.0.0"],
    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);
  console.log("PHONE env:", PHONE || "NOT SET");

  if (!state.creds.registered) {
    if (!PHONE) {
      console.log("PHONE_NUMBER set karo Railway variables me");
    } else {
      setTimeout(async () => {
        try {
          console.log("Requesting code for " + PHONE);
          const code = await sock.requestPairingCode(PHONE);
          console.log("================================");
          console.log("PAIRING CODE: " + code);
          console.log("================================");
        } catch (e) { console.log("PAIRING ERROR: " + e.message); }
      }, 4000);
    }
  }

  sock.ev.on("connection.update", (u) => {
    const conn = u.connection;
    if (conn === "open") console.log(BOT + " CONNECTED ✅");
    if (conn === "close") {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code!== DisconnectReason.loggedOut) {
        console.log("Reconnecting...");
        setTimeout(start, 5000);
      } else {
        console.log("Logged out. Delete auth and start again.");
        if (fs.existsSync(AUTH)) fs.rmSync(AUTH, { recursive: true, force: true });
        setTimeout(start, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg?.message || msg.key.fromMe) return;
      const from = msg.key.remoteJid;
      const sender = msg.key.participant || from;
      const text = textOf(msg).trim();
      if (!text.startsWith(PREFIX)) return;
      const cmd = text.slice(PREFIX.length).trim().split(/\s+/)[0].toLowerCase();
      const db = loadDB();
      const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });
      if (cmd === "help" || cmd === "menu") return reply("BOT: " + BOT + "\nPrefix: " + PREFIX + "\nCommands:.ping.alive.sticker.tagall.owner");
      if (cmd === "ping") return reply("Pong 🏓");
      if (cmd === "alive") return reply("DOST-MD is alive ✅");
      if (db.custom[cmd]) return reply(db.custom[cmd]);
      if (cmd === "addcmd" && isOwner(sender)) {
        const raw = text.slice(PREFIX.length + 6).trim().split("|");
        if (raw.length < 2) return reply("Use:.addcmd name | reply");
        const name = raw[0].trim().toLowerCase();
        const resp = raw.slice(1).join("|").trim();
        db.custom[name] = resp; saveDB(db);
        return reply("Added:." + name);
      }
    } catch (e) { console.error(e); }
  });
}
start();
