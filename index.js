const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");

const PREFIX = ".";
const START_TIME = Date.now();
let BOT_ACTIVE = true;

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

    try {
      if (command === "off") { BOT_ACTIVE = false; return sock.sendMessage(jid, { text: "🔴 *BOT OFF* ho gaya\nON ke liye *.on* likho" }); }
      if (command === "on") { BOT_ACTIVE = true; return sock.sendMessage(jid, { text: "🟢 *BOT ON* ho gaya 🔥" }); }
      if (command === "bot") { return sock.sendMessage(jid, { text: "BOT STATUS: " + (BOT_ACTIVE? "ON 🟢" : "OFF 🔴") }); }
      if (!BOT_ACTIVE) return;

      if (command === "help" || command === "menu") {
        const runtime = Math.floor((Date.now() - START_TIME)/60000);
        const menuText = "╭┈───〔 DOST-ULTRA 〕┈───⊷\n├✦ Owner: nexxxr\n├✦ Commands: 100+\n├✦ Runtime: " + runtime + "m\n├✦ Prefix:.\n├✦ Mode: public\n╰───────────────────⊷\n\n『 DOWNLOADER 』\n⬡ ytmp3, ytmp4, song, video, fb, insta, tiktok, mediafire\n\n『 MEDIA 』\n⬡ sticker, photo, toimg, tovideo, crop, caption, blur, mirror, rotate, gif\n\n『 WHATSAPP 』\n⬡ dp, mydp, tagall, admins, groupinfo, link, kick, add, promote, demote\n\n『 FUN 』\n⬡ roast, joke, meme, fact, shayari, quote, ship, 8ball, dice, coin\n\n『 AI / TOOLS 』\n⬡ gpt, ai, dalle, imagine, remini, upscale, translate\n\n『 OWNER 』\n⬡ ban, unban, sudo, delsudo, listsudo, mode, restart, update, broadcast\n\n『 BOT 』\n⬡ help, ping, alive, owner, uptime, on, off, bot";
        return sock.sendMessage(jid, { text: menuText });
      }

      if (command === "ping") return sock.sendMessage(jid, { text: "🏓 Pong! " + Math.floor((Date.now() - START_TIME)/1000) + "s" });
      if (command === "alive") return sock.sendMessage(jid, { text: "✅ DOST-ULTRA ALIVE 🔥\nRuntime: " + Math.floor((Date.now() - START_TIME)/60000) + "m" });
      if (command === "uptime") return sock.sendMessage(jid, { text: "⏱️ Uptime: " + Math.floor((Date.now() - START_TIME)/60000) + " minutes" });

      const context = msg.message.extendedTextMessage?.contextInfo;
      const quotedMessage = context?.quotedMessage;
      async function getQuotedBuffer() {
        if (!quotedMessage) return null;
        const quoted = { key: { remoteJid: jid, id: context.stanzaId, participant: context.participant }, message: quotedMessage };
        return downloadMediaMessage(quoted, "buffer", {}, { logger: P({ level: "silent" }), reuploadRequest: sock.updateMediaMessage });
      }

      if (command === "sticker") {
        if (!quotedMessage?.imageMessage) return sock.sendMessage(jid, { text: "Photo ko reply karke.sticker likho" });
        const buffer = await getQuotedBuffer();
        const sticker = await sharp(buffer).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
        return sock.sendMessage(jid, { sticker });
      }

    } catch (e) { console.log("Error: " + e.message); }
  });
}
startBot();
