const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");

const PREFIX = ".";
const START_TIME = Date.now();
let BOT_ACTIVE = true;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false
  });

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
    if (connection === "open") {
      console.log("DOST BOT ONLINE");
    }
    if (connection === "close") {
      const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      if (!loggedOut) {
        console.log("Reconnecting...");
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
    if (!text) return;
    const clean = text.trim();
    if (clean.toLowerCase() === "hi" || clean.toLowerCase() === "hello") {
      if (!BOT_ACTIVE) return;
      await sock.sendMessage(jid, { text: "Hello jaan! Dost bot online hai\n.help likho" });
      return;
    }
    if (!clean.startsWith(PREFIX)) return;
    const parts = clean.slice(PREFIX.length).trim().split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    const args = parts;
    const query = args.join(" ");

    try {
      if (command === "off") {
        BOT_ACTIVE = false;
        return sock.sendMessage(jid, { text: "BOT OFF ho gaya hai.\nON karne ke liye.on likho." });
      }
      if (command === "on") {
        BOT_ACTIVE = true;
        return sock.sendMessage(jid, { text: "BOT ON ho gaya hai" });
      }
      if (command === "bot") {
        let st = BOT_ACTIVE? "ON" : "OFF";
        return sock.sendMessage(jid, { text: "BOT STATUS: " + st });
      }

      if (!BOT_ACTIVE) return;

      if (command === "help" || command === "menu") {
        return sock.sendMessage(jid, { text: "DOST BOT COMMANDS\n\nBOT CONTROL\n.on /.off /.bot\n\nMEDIA\n.sticker\n.photo\n.toimg\n.crop\n.blur\n.mirror\n.rotate\n.caption <text>\n\nWHATSAPP\n.dp <number>\n.mydp\n.tagall\n.admins\ngroupinfo\n.link\n\nFUN\n.joke\n.fact\n.shayari\n.quote\n.roast\n.ship\n.8ball\n.dice\n.coin\n.meme\n\nBOT\n.ping\n.alive\n.owner\n.uptime" });
      }

      if (command === "ping") return sock.sendMessage(jid, { text: "Pong!" });
      if (command === "alive") {
        const mins = Math.floor((Date.now() - START_TIME) / 60000);
        return sock.sendMessage(jid, { text: "BOT ALIVE - " + mins + " minutes" });
      }

      const context = msg.message.extendedTextMessage?.contextInfo;
      const quotedMessage = context?.quotedMessage;
      async function getQuotedBuffer() {
        if (!quotedMessage) return null;
        const quoted = { key: { remoteJid: jid, id: context.stanzaId, participant: context.participant }, message: quotedMessage };
        return downloadMediaMessage(quoted, "buffer", {}, { logger: P({ level: "silent" }), reuploadRequest: sock.updateMediaMessage });
      }

      if (command === "sticker") {
        if (!quotedMessage?.imageMessage) return sock.sendMessage(jid, { text: "Photo ko reply karke.sticker likho." });
        const buffer = await getQuotedBuffer();
        const sticker = await sharp(buffer).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
        return sock.sendMessage(jid, { sticker });
      }

      if (command === "photo" || command === "toimg") {
        if (!quotedMessage?.stickerMessage) return sock.sendMessage(jid, { text: "Sticker ko reply karke.photo likho." });
        const buffer = await getQuotedBuffer();
        const image = await sharp(buffer).png().toBuffer();
        return sock.sendMessage(jid, { image, caption: "Sticker to Photo" });
      }

    } catch (err) {
      console.log("Error: " + err.message);
    }
  });
}

startBot();
