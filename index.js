const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const axios = require("axios");
const OpenAI = require("openai");

const config = require("./config.json");

const PREFIX = process.env.PREFIX || config.prefix || ".";
const OWNER = String(
  process.env.OWNER_NUMBER || config.ownerNumber || ""
).replace(/\D/g, "");

const COMMAND_FILE = path.join(
  __dirname,
  "custom_commands.json"
);

if (!fs.existsSync(COMMAND_FILE)) {
  fs.writeFileSync(COMMAND_FILE, "{}");
}

let customCommands = {};

try {
  customCommands = JSON.parse(
    fs.readFileSync(COMMAND_FILE, "utf8")
  );
} catch {
  customCommands = {};
}

let botStatus =
  config.botStatus !== false;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;


/* =========================
   BASIC FUNCTIONS
========================= */

function saveCommands() {
  fs.writeFileSync(
    COMMAND_FILE,
    JSON.stringify(customCommands, null, 2)
  );
}

function saveConfig() {
  fs.writeFileSync(
    "./config.json",
    JSON.stringify(config, null, 2)
  );
}

function getText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    ""
  ).trim();
}

function getSender(msg) {
  const jid =
    msg.key.participant ||
    msg.key.remoteJid ||
    "";

  return jid
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");
}

function isOwner(msg) {
  return (
    OWNER &&
    getSender(msg) === OWNER
  );
}

function isGroup(jid) {
  return jid &&
    jid.endsWith("@g.us");
}

function uptime() {
  let sec =
    Math.floor(process.uptime());

  const days =
    Math.floor(sec / 86400);

  sec %= 86400;

  const hours =
    Math.floor(sec / 3600);

  sec %= 3600;

  const minutes =
    Math.floor(sec / 60);

  sec %= 60;

  return `${days}d ${hours}h ${minutes}m ${sec}s`;
}

async function reply(
  sock,
  jid,
  text,
  msg
) {
  return sock.sendMessage(
    jid,
    { text },
    { quoted: msg }
  );
}


/* =========================
   MEDIA
========================= */

async function getMediaBuffer(
  message,
  type
) {
  const stream =
    await downloadContentFromMessage(
      message,
      type
    );

  const chunks = [];

  for await (
    const chunk of stream
  ) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function getImage(msg) {

  const image =
    msg.message?.imageMessage;

  if (image) {
    return getMediaBuffer(
      image,
      "image"
    );
  }

  const quoted =
    msg.message
      ?.extendedTextMessage
      ?.contextInfo
      ?.quotedMessage;

  if (quoted?.imageMessage) {
    return getMediaBuffer(
      quoted.imageMessage,
      "image"
    );
  }

  return null;
}


/* =========================
   GROUP
========================= */

function mentions(msg) {

  return (
    msg.message
      ?.extendedTextMessage
      ?.contextInfo
      ?.mentionedJid || []
  );
}


/* =========================
   HELP
========================= */

function helpMenu() {

return `╭┈───〔 DOST-ULTRA 〕┈───⊷
├✦ Owner: ${config.ownerName}
├✦ Prefix: ${PREFIX}
├✦ Mode: ${config.mode}
├✦ Status: ${botStatus ? "🟢 ON" : "🔴 OFF"}
╰───────────────────⊷

『 DOWNLOADER 』
⬡ ytmp3
⬡ ytmp4
⬡ song
⬡ video
⬡ fb
⬡ insta
⬡ tiktok
⬡ mediafire

『 MEDIA 』
⬡ sticker
⬡ photo
⬡ toimg
⬡ tovideo
⬡ crop
⬡ caption
⬡ blur
⬡ mirror
⬡ rotate
⬡ gif

『 WHATSAPP 』
⬡ dp
⬡ mydp
⬡ tagall
⬡ admins
⬡ groupinfo
⬡ link
⬡ kick
⬡ add
⬡ promote
⬡ demote

『 FUN 』
⬡ roast
⬡ joke
⬡ meme
⬡ fact
⬡ shayari
⬡ quote
⬡ ship
⬡ 8ball
⬡ dice
⬡ coin

『 AI / TOOLS 』
⬡ gpt
⬡ ai
⬡ dalle
⬡ imagine
⬡ remini
⬡ upscale
⬡ translate

『 BOT 』
⬡ help
⬡ ping
⬡ alive
⬡ owner
⬡ uptime

『 OWNER 』
⬡ on
⬡ off
⬡ addcmd
⬡ delcmd
⬡ listcmd
⬡ mode
⬡ broadcast`;
}


/* =========================
   AI
========================= */

async function askAI(prompt) {

  if (!openai) {
    return "⚠️ OPENAI_API_KEY Railway Variables me add karo.";
  }

  const result =
    await openai.responses.create({
      model: "gpt-5-mini",
      input: prompt
    });

  return (
    result.output_text ||
    "AI ne response nahi diya."
  );
}

async function generateImage(prompt) {

  if (!openai) {
    return null;
  }

  const result =
    await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024"
    });

  const b64 =
    result.data?.[0]?.b64_json;

  if (!b64) {
    return null;
  }

  return Buffer.from(
    b64,
    "base64"
  );
}


/* =========================
   RANDOM FUN
========================= */

const jokes = [
  "Teacher: Homework kaha hai? Student: Sir, Wi-Fi ke saath chala gaya 😂",
  "Friend: Tu late kyun hai? Me: Time par nikla tha, time hi late tha 😂",
  "Mummy: Phone rakh do. Me: Bas 5 minute. Also me after 2 hours: 😭"
];

const facts = [
  "Octopus ke teen hearts hote hain.",
  "Honey theoretically bahut lambe time tak preserved reh sakta hai.",
  "Lightning ka temperature Suraj ki surface se bhi zyada hota hai."
];

const shayari = [
  "Muskurate raho, waqt badalne mein der nahi lagti ✨",
  "Khamoshi bhi kabhi kabhi bahut kuch keh jaati hai ❤️",
  "Sapne bade rakho, kadam chhote sahi."
];

const quotes = [
  "Consistency beats intensity.",
  "Small steps every day create big results.",
  "Never stop learning."
];

const roasts = [
  "Bhai tera confidence full hai, bas logic loading mein hai 😂",
  "System scan complete: attitude detected, logic missing 🤖",
  "Bro OP hai... bas result thoda pending hai 😂"
];


/* =========================
   START BOT
========================= */

async function startBot() {

  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(
    "./auth"
  );

  const sock =
    makeWASocket({

      auth: state,

      logger:
        P({
          level: "silent"
        }),

      browser:
        Browsers.ubuntu(
          "DOST-ULTRA"
        ),

      markOnlineOnConnect:
        false
    });


  sock.ev.on(
    "creds.update",
    saveCreds
  );


  sock.ev.on(
    "connection.update",
    ({
      connection,
      lastDisconnect
    }) => {

      if (
        connection === "open"
      ) {

        console.log(
          "✅ DOST-ULTRA CONNECTED"
        );

      }

      if (
        connection === "close"
      ) {

        const code =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;

        if (
          code !==
          DisconnectReason.loggedOut
        ) {

          console.log(
            "🔄 Reconnecting..."
          );

          setTimeout(
            startBot,
            5000
          );

        } else {

          console.log(
            "❌ Logged out."
          );

        }
      }
    }
  );


  /* =========================
     MESSAGE HANDLER
  ========================= */

  sock.ev.on(
    "messages.upsert",
    async ({
      messages
    }) => {

      const msg =
        messages[0];

      if (
        !msg?.message ||
        msg.key.fromMe
      ) {
        return;
      }

      const text =
        getText(msg);

      if (
        !text.startsWith(PREFIX)
      ) {
        return;
      }

      const body =
        text
          .slice(PREFIX.length)
          .trim();

      if (!body) return;

      const parts =
        body.split(/\s+/);

      const command =
        parts
          .shift()
          .toLowerCase();

      const args =
        parts.join(" ");

      const jid =
        msg.key.remoteJid;


      /* =========================
         OWNER ON/OFF
      ========================= */

      if (
        command === "on"
      ) {

        if (!isOwner(msg)) {

          return reply(
            sock,
            jid,
            "❌ Owner only.",
            msg
          );
        }

        botStatus = true;

        config.botStatus = true;

        saveConfig();

        return reply(
          sock,
          jid,
          "🟢 DOST-ULTRA is now ON.",
          msg
        );
      }


      if (
        command === "off"
      ) {

        if (!isOwner(msg)) {

          return reply(
            sock,
            jid,
            "❌ Owner only.",
            msg
          );
        }

        botStatus = false;

        config.botStatus = false;

        saveConfig();

        return reply(
          sock,
          jid,
          "🔴 DOST-ULTRA is now OFF.\n\nOwner `.on` bhejkar wapas ON kar sakta hai.",
          msg
        );
      }


      /* =========================
         OFF MODE
      ========================= */

      if (!botStatus) {

        if (
          isOwner(msg) &&
          command === "on"
        ) {
          return;
        }

        return;
      }


      /* =========================
         CUSTOM COMMAND
      ========================= */

      if (
        customCommands[command]
      ) {

        return reply(
          sock,
          jid,
          customCommands[command],
          msg
        );
      }


      /* =========================
         OWNER COMMAND CHECK
      ========================= */

      const ownerCommands = [

        "addcmd",
        "delcmd",
        "listcmd",
        "mode",
        "broadcast",
        "ban",
        "unban",
        "sudo",
        "delsudo",
        "listsudo",
        "restart",
        "update"

      ];


      if (
        ownerCommands.includes(
          command
        ) &&
        !isOwner(msg)
      ) {

        return reply(
          sock,
          jid,
          "❌ Ye command sirf Owner use kar sakta hai.",
          msg
        );
      }


      /* =========================
         ADD COMMAND
      ========================= */

      if (
        command === "addcmd"
      ) {

        const match =
          args.match(
            /^([a-zA-Z0-9_]+)\s*\|\s*([\s\S]+)$/
          );

        if (!match) {

          return reply(
            sock,
            jid,
            `❌ Format:\n${PREFIX}addcmd hello | Hello 👋`,
            msg
          );
        }

        const name =
          match[1]
            .toLowerCase();

        const response =
          match[2];

        customCommands[name] =
          response;

        saveCommands();

        return reply(
          sock,
          jid,
          `✅ Command added!\n\n${PREFIX}${name}\n→ ${response}`,
          msg
        );
      }


      /* =========================
         DELETE COMMAND
      ========================= */

      if (
        command === "delcmd"
      ) {

        const name =
          args
            .toLowerCase()
            .trim();

        if (
          !customCommands[name]
        ) {

          return reply(
            sock,
            jid,
            "❌ Custom command nahi mila.",
            msg
          );
        }

        delete customCommands[name];

        saveCommands();

        return reply(
          sock,
          jid,
          `✅ ${PREFIX}${name} delete ho gaya.`,
          msg
        );
      }


      /* =========================
         LIST COMMAND
      ========================= */

      if (
        command === "listcmd"
      ) {

        const list =
          Object.keys(
            customCommands
          );

        if (!list.length) {

          return reply(
            sock,
            jid,
            "📭 Koi custom command nahi hai.",
            msg
          );
        }

        return reply(
          sock,
          jid,
          `╭─〔 CUSTOM COMMANDS 〕─╮\n\n${
            list
              .map(
                x => `${PREFIX}${x}`
              )
              .join("\n")
          }\n\n╰────────────────╯`,
          msg
        );
      }


      /* =========================
         MODE
      ========================= */

      if (
        command === "mode"
      ) {

        const mode =
          args
            .toLowerCase()
            .trim();

        if (
          ![
            "public",
            "private"
          ].includes(mode)
        ) {

          return reply(
            sock,
            jid,
            `Usage:\n${PREFIX}mode public\n${PREFIX}mode private`,
            msg
          );
        }

        config.mode =
          mode;

        saveConfig();

        return reply(
          sock,
          jid,
          `✅ Mode: ${mode}`,
          msg
        );
      }


      /* =========================
         BASIC BOT
      ========================= */

      if (
        command === "ping"
      ) {

        return reply(
          sock,
          jid,
          "🏓 Pong!",
          msg
        );
      }


      if (
        command === "alive"
      ) {

        return reply(
          sock,
          jid,
          `🤖 ${config.botName} is alive!\n\n🟢 Status: ON\n⏱️ Uptime: ${uptime()}`,
          msg
        );
      }


      if (
        command === "uptime"
      ) {

        return reply(
          sock,
          jid,
          `⏱️ Uptime: ${uptime()}`,
          msg
        );
      }


      if (
        command === "help"
      ) {

        return reply(
          sock,
          jid,
          helpMenu(),
          msg
        );
      }


      /* =========================
         OWNER PANEL
      ========================= */

      if (
        command === "owner"
      ) {

        if (
          !isOwner(msg)
        ) {

          return reply(
            sock,
            jid,
            `👑 Owner: ${config.ownerName}`,
            msg
          );
        }

        return reply(
          sock,
          jid,
`╭──〔 👑 OWNER PANEL 〕──╮

├ 🟢 Bot: ${botStatus ? "ON" : "OFF"}
│
├ ${PREFIX}on
├ ${PREFIX}off
│
├ ${PREFIX}addcmd name | reply
├ ${PREFIX}delcmd name
├ ${PREFIX}listcmd
│
├ ${PREFIX}mode public/private
├ ${PREFIX}broadcast message
│
├ ${PREFIX}ban @user
├ ${PREFIX}unban @user
├ ${PREFIX}sudo @user
├ ${PREFIX}delsudo @user
├ ${PREFIX}listsudo
│
├ ${PREFIX}restart
├ ${PREFIX}update

╰──────────────────────`,
          msg
        );
      }


      /* =========================
         TAG ALL
      ========================= */

      if (
        command === "tagall"
      ) {

        if (
          !isGroup(jid)
        ) {

          return reply(
            sock,
            jid,
            "❌ Group only.",
            msg
          );
        }

        const meta =
          await sock.groupMetadata(
            jid
          );

        const users =
          meta.participants
            .map(
              p => p.id
            );

        const text =
          users
            .map(
              u =>
                `@${u.split("@")[0]}`
            )
            .join(" ");

        return sock.sendMessage(
          jid,
          {
            text:
              `📢 TAG ALL\n\n${text}`,
            mentions: users
          },
          {
            quoted: msg
          }
        );
      }


      /* =========================
         ADMINS
      ========================= */

      if (
        command === "admins"
      ) {

        if (
          !isGroup(jid)
        ) {

          return reply(
            sock,
            jid,
            "❌ Group only.",
            msg
          );
        }

        const meta =
          await sock.groupMetadata(
            jid
          );

        const admins =
          meta.participants
            .filter(
              p => p.admin
            );

        const ids =
          admins.map(
            p => p.id
          );

        const text =
          ids
            .map(
              id =>
                `@${id.split("@")[0]}`
            )
            .join("\n");

        return sock.sendMessage(
          jid,
          {
            text:
              `👑 GROUP ADMINS\n\n${text}`,
            mentions: ids
          },
          {
            quoted: msg
          }
        );
      }


      /* =========================
         GROUP INFO
      ========================= */

      if (
        command === "groupinfo"
      ) {

        if (
          !isGroup(jid)
        ) {

          return reply(
            sock,
            jid,
            "❌ Group only.",
            msg
          );
        }

        const meta =
          await sock.groupMetadata(
            jid
          );

        return reply(
          sock,
          jid,
          `╭─〔 GROUP INFO 〕─╮

📌 Name: ${meta.subject}
👥 Members: ${meta.participants.length}
🆔 ID: ${jid}

╰────────────────`,
          msg
        );
      }


      /* =========================
         GROUP LINK
      ========================= */

      if (
        command === "link"
      ) {

        if (
          !isGroup(jid)
        ) {

          return reply(
            sock,
            jid,
            "❌ Group only.",
            msg
          );
        }

        try {

          const code =
            await sock.groupInviteCode(
              jid
            );

          return reply(
            sock,
            jid,
            `🔗 Group Link:\nhttps://chat.whatsapp.com/${code}`,
            msg
          );

        } catch {

          return reply(
            sock,
            jid,
            "❌ Bot ko group permissions chahiye.",
            msg
          );
        }
      }


      /* =========================
         GROUP ACTIONS
      ========================= */

      if (
        [
          "kick",
          "add",
          "promote",
          "demote"
        ].includes(command)
      ) {

        if (
          !isGroup(jid)
        ) {

          return reply(
            sock,
            jid,
            "❌ Group only.",
            msg
          );
        }

        const users =
          mentions(msg);

        if (
          !users.length
        ) {

          return reply(
            sock,
            jid,
            `Example:\n${PREFIX}${command} @user`,
            msg
          );
        }

        const meta =
          await sock.groupMetadata(
            jid
          );

        const me =
          meta.participants.find(
            p =>
              p.id ===
              sock.user.id
          );

        if (
          !me?.admin
        ) {

          return reply(
            sock,
            jid,
            "❌ Bot ko group admin banao.",
            msg
          );
        }

        const action = {

          kick: "remove",
          add: "add",
          promote: "promote",
          demote: "demote"

        }[command];

        await sock
          .groupParticipantsUpdate(
            jid,
            users,
            action
          );

        return reply(
          sock,
          jid,
          `✅ ${command} completed.`,
          msg
        );
      }


      /* =========================
         STICKER
      ========================= */

      if (
        command === "sticker"
      ) {

        const buffer =
          await getImage(msg);

        if (!buffer) {

          return reply(
            sock,
            jid,
            "📸 Image bhejo ya image ko reply karke .sticker likho.",
            msg
          );
        }

        const sticker =
          await sharp(buffer)
            .resize(
              512,
              512,
              {
                fit: "inside"
              }
            )
            .webp()
            .toBuffer();

        return sock.sendMessage(
          jid,
          {
            sticker
          },
          {
            quoted: msg
          }
        );
      }


      /* =========================
         TOIMG
      ========================= */

      if (
        command === "toimg"
      ) {

        const quoted =
          msg.message
            ?.extendedTextMess
