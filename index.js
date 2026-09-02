const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  downloadContentFromMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const OpenAI = require("openai");

const config = require("./config.json");

const PREFIX = process.env.PREFIX || config.prefix || ".";
const OWNER = String(process.env.OWNER_NUMBER || config.ownerNumber || "").replace(/\D/g, "");
const COMMAND_FILE = path.join(__dirname, "custom_commands.json");

if (!fs.existsSync(COMMAND_FILE)) fs.writeFileSync(COMMAND_FILE, "{}");
let customCommands = {};
try { customCommands = JSON.parse(fs.readFileSync(COMMAND_FILE, "utf8")); } catch { customCommands = {}; }

let botStatus = config.botStatus!== false;

const openai = process.env.OPENAI_API_KEY? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function saveCommands() { fs.writeFileSync(COMMAND_FILE, JSON.stringify(customCommands, null, 2)); }
function saveConfig() { fs.writeFileSync("./config.json", JSON.stringify(config, null, 2)); }
function getText(msg) {
  return (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "").trim();
}
function getSender(msg) {
  const jid = msg.key.participant || msg.key.remoteJid || "";
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "");
}
function isOwner(msg) { return OWNER && getSender(msg) === OWNER; }
function isGroup(jid) { return jid && jid.endsWith("@g.us"); }
function uptime() {
  let sec = Math.floor(process.uptime());
  const days = Math.floor(sec / 86400); sec %= 86400;
  const hours = Math.floor(sec / 3600); sec %= 3600;
  const minutes = Math.floor(sec / 60); sec %= 60;
  return `${days}d ${hours}h ${minutes}m ${sec}s`;
}
async function reply(sock, jid, text, msg) { return sock.sendMessage(jid, { text }, { quoted: msg }); }

async function getMediaBuffer(message, type) {
  const stream = await downloadContentFromMessage(message, type);
  const chunks = []; for await (const chunk of stream) { chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function getImage(msg) {
  const image = msg.message?.imageMessage;
  if (image) return getMediaBuffer(image, "image");
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (quoted?.imageMessage) return getMediaBuffer(quoted.imageMessage, "image");
  return null;
}
function mentions(msg) { return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []; }

function helpMenu() {
return `╭┈───〔 DOST-ULTRA 〕┈───⊷
├✦ Owner: ${config.ownerName}
├✦ Prefix: ${PREFIX}
├✦ Mode: ${config.mode}
├✦ Status: ${botStatus? "🟢 ON" : "🔴 OFF"}
╰───────────────────⊷

『 DOWNLOADER 』
⬡ ytmp3, ytmp4, song, video, fb, insta, tiktok, mediafire
『 MEDIA 』
⬡ sticker, photo, toimg, tovideo, crop, caption, blur, mirror, rotate, gif
『 WHATSAPP 』
⬡ dp, mydp, tagall, admins, groupinfo, link, kick, add, promote, demote
『 FUN 』
⬡ roast, joke, meme, fact, shayari, quote, ship, 8ball, dice, coin
『 AI / TOOLS 』
⬡ gpt, ai, dalle, imagine, remini, upscale, translate
『 BOT 』
⬡ help, ping, alive, owner, uptime
『 OWNER 』
⬡ on, off, addcmd, delcmd, listcmd, mode, broadcast`;
}

async function askAI(prompt) {
  if (!openai) return "⚠️ OPENAI_API_KEY Railway Variables me add karo.";
  const result = await openai.responses.create({ model: "gpt-5-mini", input: prompt });
  return result.output_text || "AI ne response nahi diya.";
}

const jokes = ["Teacher: Homework kaha hai? Student: Sir, Wi-Fi ke saath chala gaya 😂"];
const facts = ["Octopus ke teen hearts hote hain."];
const shayari = ["Muskurate raho, waqt badalne mein der nahi lagti ✨"];
const quotes = ["Consistency beats intensity."];
const roasts = ["Bhai tera confidence full hai, bas logic loading mein hai 😂"];

let pairingDone = false;

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({level:"silent"})) },
    logger: P({ level: "silent" }),
    browser: Browsers.ubuntu("DOST-ULTRA"),
    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);

  // ===== 60 SEC PAIRING FIX (TERI CODE ME YEHI MISSING THA) =====
  if (!state.creds.registered &&!pairingDone) {
    const phoneNumber = process.env.PHONE_NUMBER || config.ownerNumber;
    const cleanNum = String(phoneNumber).replace(/\D/g, "");
    console.log("Requesting pairing for: " + cleanNum);
    setTimeout(async () => {
      try {
        if (sock.authState.creds.registered) return;
        const code = await sock.requestPairingCode(cleanNum);
        console.log("============================");
        console.log("PAIRING CODE: " + code);
        console.log("WhatsApp > Linked Devices > Link with phone number pe dalo");
        console.log("60 SEC TAK VALID HAI");
        console.log("============================");
        pairingDone = true;
      } catch (e) { console.log("Pair error: " + e.message); }
    }, 5000);
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") { console.log("✅ DOST-ULTRA CONNECTED"); pairingDone = true; }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code!== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting in 10 sec..."); setTimeout(startBot, 10000);
      } else { console.log("❌ Logged out."); }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;
    const text = getText(msg);
    if (!text.startsWith(PREFIX)) return;
    const body = text.slice(PREFIX.length).trim(); if (!body) return;
    const parts = body.split(/\s+/);
    const command = parts.shift().toLowerCase();
    const args = parts.join(" ");
    const jid = msg.key.remoteJid;

    if (command === "on") {
      if (!isOwner(msg)) return reply(sock, jid, "❌ Owner only.", msg);
      botStatus = true; config.botStatus = true; saveConfig();
      return reply(sock, jid, "🟢 DOST-ULTRA is now ON.", msg);
    }
    if (command === "off") {
      if (!isOwner(msg)) return reply(sock, jid, "❌ Owner only.", msg);
      botStatus = false; config.botStatus = false; saveConfig();
      return reply(sock, jid, "🔴 DOST-ULTRA is now OFF.\nOwner.on bhejkar wapas ON kar sakta hai.", msg);
    }
    if (!botStatus) return;
    if (customCommands[command]) return reply(sock, jid, customCommands[command], msg);

    const ownerCommands = ["addcmd","delcmd","listcmd","mode","broadcast"];
    if (ownerCommands.includes(command) &&!isOwner(msg)) return reply(sock, jid, "❌ Ye command sirf Owner use kar sakta hai.", msg);

    if (command === "addcmd") {
      const match = args.match(/^([a-zA-Z0-9_]+)\s*\|\s*([\s\S]+)$/);
      if (!match) return reply(sock, jid, `❌ Format:\n${PREFIX}addcmd hello | Hello 👋`, msg);
      customCommands[match[1].toLowerCase()] = match[2]; saveCommands();
      return reply(sock, jid, `✅ Command added!\n\n${PREFIX}${match[1].toLowerCase()}\n→ ${match[2]}`, msg);
    }
    if (command === "delcmd") {
      const name = args.toLowerCase().trim();
      if (!customCommands[name]) return reply(sock, jid, "❌ Custom command nahi mila.", msg);
      delete customCommands[name]; saveCommands();
      return reply(sock, jid, `✅ ${PREFIX}${name} delete ho gaya.`, msg);
    }
    if (command === "listcmd") {
      const list = Object.keys(customCommands);
      if (!list.length) return reply(sock, jid, "📭 Koi custom command nahi hai.", msg);
      return reply(sock, jid, `╭─〔 CUSTOM COMMANDS 〕─╮\n\n${list.map(x=>`${PREFIX}${x}`).join("\n")}\n\n╰────────────────╯`, msg);
    }
    if (command === "mode") {
      const mode = args.toLowerCase().trim();
      if (!["public","private"].includes(mode)) return reply(sock, jid, `Usage:\n${PREFIX}mode public\n${PREFIX}mode private`, msg);
      config.mode = mode; saveConfig(); return reply(sock, jid, `✅ Mode: ${mode}`, msg);
    }

    if (command === "ping") return reply(sock, jid, "🏓 Pong!", msg);
    if (command === "alive") return reply(sock, jid, `🤖 ${config.botName} is alive!\n\n🟢 Status: ON\n⏱️ Uptime: ${uptime()}`, msg);
    if (command === "uptime") return reply(sock, jid, `⏱️ Uptime: ${uptime()}`, msg);
    if (command === "help") return reply(sock, jid, helpMenu(), msg);

    if (command === "owner") {
      if (!isOwner(msg)) return reply(sock, jid, `👑 Owner: ${config.ownerName}`, msg);
      return reply(sock, jid, `╭──〔 👑 OWNER PANEL 〕──╮\n├ ${
