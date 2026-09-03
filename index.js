const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const path = require("path");
const PHONE = (process.env.PHONE_NUMBER || "").replace(/\D/g, "");
const AUTH = "./auth";
if (fs.existsSync(AUTH)) {
  if (!fs.existsSync(path.join(AUTH, "creds.json"))) {
    fs.rmSync(AUTH, { recursive: true, force: true });
  }
}
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH);
  const sock = makeWASocket({ auth: state, logger: P({ level: "silent" }), browser: ["DOST-MD", "Chrome", "1.0.0"] });
  sock.ev.on("creds.update", saveCreds);
  console.log("PHONE:", PHONE);
  if (!state.creds.registered && PHONE) {
    setTimeout(async () => {
      const code = await sock.requestPairingCode(PHONE);
      console.log("PAIRING CODE: " + code);
    }, 3000);
  }
  sock.ev.on("connection.update", (s) => {
    if (s.connection === "open") console.log("CONNECTED");
    if (s.connection === "close") {
      if (s.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) setTimeout(start, 5000);
    }
  });
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg?.message) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    if (text === ".ping") sock.sendMessage(msg.key.remoteJid, { text: "Pong" }, { quoted: msg });
  });
}
start();
