const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  Browsers
} = require("@whiskeysockets/baileys");

const P = require("pino");
const sharp = require("sharp");
const ffmpegPath = require("ffmpeg-static");

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// ===============================
// CONFIG
// ===============================

const PREFIX = ".";
const START_TIME = Date.now();

const OWNER = String(
  process.env.OWNER_NUMBER || "919999999999"
).replace(/\D/g, "");

const AUTH_DIR = "./auth";
const DATA_DIR = "./data";
const TEMP_DIR = "./temp";

for (const dir of [DATA_DIR, TEMP_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const COMMANDS_FILE = path.join(DATA_DIR, "commands.json");

let botEnabled = true;
let pairingRequested = false;

// ===============================
// CUSTOM COMMANDS
// ===============================

function loadCustomCommands() {
  try {
    if (!fs.existsSync(COMMANDS_FILE)) {
      fs.writeFileSync(
        COMMANDS_FILE,
        JSON.stringify({}, null, 2)
      );
    }

    return JSON.parse(
      fs.readFileSync(COMMANDS_FILE, "utf8")
    );
  } catch {
    return {};
  }
}

function saveCustomCommands(commands) {
  fs.writeFileSync(
    COMMANDS_FILE,
    JSON.stringify(commands, null, 2)
  );
}

let customCommands = loadCustomCommands();

// ===============================
// HELP
// ===============================

const HELP = `
╭┈───〔 DOST-ULTRA 〕┈───⊷
├✦ Prefix: .
├✦ Mode: Public
├✦ Status: 🟢 ONLINE
╰───────────────────────⊷

『 🛠 MEDIA 』

.sticker
Reply to image/video

.toimg
Reply to sticker

.tovideo
Reply to sticker

.crop
Reply to image

.caption <text>
Reply to image

.blur
Reply to image

.mirror
Reply to image

.rotate
Reply to image

.gif
Reply to GIF/video

『 👥 WHATSAPP 』

.dp
Show mentioned user's DP

.mydp
Show your DP

.tagall
Mention all members

.admins
Show group admins

.groupinfo
Show group information

.link
Get group invite link

『 😂 FUN 』

.roast
Reply/mention someone

.joke
Random joke

.meme
Random meme text

.fact
Random fact

.shayari
Random shayari

.quote
Random quote

.ship @user
Fun ship result

.8ball <question>
Magic 8 Ball

.dice
Roll dice

.coin
Flip coin

『 🤖 BOT 』

.help
Show this menu

.ping
Check bot

.alive
Bot status

.uptime
Bot uptime

.owner
Owner contact

『 👑 OWNER 』

.bot on
Turn bot ON

.bot off
Turn bot OFF

.addcmd hello | Hello 👋
Add custom command

.delcmd hello
Delete custom command

.listcmd
List custom commands

╰───────────────────────⊷
`;


// ===============================
// UTILITIES
// ===============================

function jidNumber(jid) {
  return String(jid || "").split("@")[0];
}

function isOwner(sender) {
  return jidNumber(sender) === OWNER;
}

function isGroup(jid) {
  return jid && jid.endsWith("@g.us");
}

function formatUptime(ms) {
  const sec = Math.floor(ms / 1000);

  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  return `${days}d ${hours}h ${mins}m ${seconds}s`;
}

function getQuotedMessage(message) {
  return (
    message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    message?.imageMessage?.contextInfo?.quotedMessage ||
    message?.videoMessage?.contextInfo?.quotedMessage
  );
}

function getQuotedParticipant(message) {
  return (
    message?.extendedTextMessage?.contextInfo?.participant ||
    message?.imageMessage?.contextInfo?.participant ||
    message?.videoMessage?.contextInfo?.participant
  );
}

function getMentionedJid(message) {
  const context =
    message?.extendedTextMessage?.contextInfo;

  return context?.mentionedJid?.[0] || null;
}

function getMediaMessage(message) {
  if (!message) return null;

  if (message.imageMessage) {
    return {
      type: "image",
      message: message.imageMessage
    };
  }

  if (message.videoMessage) {
    return {
      type: "video",
      message: message.videoMessage
    };
  }

  if (message.stickerMessage) {
    return {
      type: "sticker",
      message: message.stickerMessage
    };
  }

  if (message.documentMessage) {
    return {
      type: "document",
      message: message.documentMessage
    };
  }

  return null;
}

function getMessageContent(msg) {
  return (
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    ""
  );
}

async function downloadMedia(sock, msg) {
  return await downloadMediaMessage(
    msg,
    "buffer",
    {},
    {
      logger: P({ level: "silent" }),
      reuploadRequest: sock.updateMediaMessage
    }
  );
}

async function sendSticker(sock, jid, buffer) {
  const webp = await sharp(buffer)
    .resize(512, 512, {
      fit: "contain",
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    })
    .webp({ quality: 85 })
    .toBuffer();

  await sock.sendMessage(jid, {
    sticker: webp
  });
}

async function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args);

    let stderr = "";

    process.stderr.on("data", data => {
      stderr += data.toString();
    });

    process.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            stderr || `FFmpeg exited with ${code}`
          )
        );
      }
    });
  });
}

async function videoToSticker(buffer) {
  const input = path.join(
    TEMP_DIR,
    `input-${Date.now()}.mp4`
  );

  const output = path.join(
    TEMP_DIR,
    `output-${Date.now()}.webp`
  );

  fs.writeFileSync(input, buffer);

  await runFFmpeg([
    "-y",
    "-i",
    input,
    "-t",
    "8",
    "-vf",
    "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0",
    "-an",
    "-loop",
    "0",
    "-c:v",
    "libwebp",
    "-q:v",
    "70",
    output
  ]);

  const result = fs.readFileSync(output);

  try {
    fs.unlinkSync(input);
    fs.unlinkSync(output);
  } catch {}

  return result;
}

async function stickerToImage(buffer) {
  return await sharp(buffer)
    .png()
    .toBuffer();
}

async function stickerToVideo(buffer) {
  const input = path.join(
    TEMP_DIR,
    `sticker-${Date.now()}.webp`
  );

  const output = path.join(
    TEMP_DIR,
    `video-${Date.now()}.mp4`
  );

  fs.writeFileSync(input, buffer);

  await runFFmpeg([
    "-y",
    "-loop",
    "1",
    "-i",
    input,
    "-t",
    "3",
    "-vf",
    "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    output
  ]);

  const result = fs.readFileSync(output);

  try {
    fs.unlinkSync(input);
    fs.unlinkSync(output);
  } catch {}

  return result;
}

async function getGroupMetadata(sock, jid) {
  return await sock.groupMetadata(jid);
}

function isAdmin(metadata, sender) {
  const participant = metadata.participants.find(
    p => p.id === sender
  );

  return (
    participant &&
    (participant.admin === "admin" ||
      participant.admin === "superadmin")
  );
}

async function requireGroupAdmin(sock, jid, sender) {
  if (!isGroup(jid)) {
    return false;
  }

  try {
    const metadata = await getGroupMetadata(sock, jid);
    return isAdmin(metadata, sender);
  } catch {
    return false;
  }
}


// ===============================
// BOT START
// ===============================

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,

    logger: P({
      level: "silent"
    }),

    printQRInTerminal: false,

    // IMPORTANT FOR PAIRING
    browser: Browsers.macOS("Desktop")
  });

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  // =============================
  // CONNECTION
  // =============================

  sock.ev.on(
    "connection.update",
    async update => {
      const {
        connection,
        lastDisconnect
      } = update;

      // -------------------------
      // PAIRING
      // -------------------------

      if (
        connection === "connecting" &&
        !state.creds.registered &&
        !pairingRequested
      ) {
        pairingRequested = true;

        const phone = String(
          process.env.PHONE_NUMBER || ""
        ).replace(/\D/g, "");

        if (!phone) {
          console.log(
            "❌ PHONE_NUMBER Railway Variables me missing hai."
          );

          pairingRequested = false;
          return;
        }

        try {
          // Small delay to avoid duplicate pairing request
          await new Promise(resolve =>
            setTimeout(resolve, 1500)
          );

          const code =
            await sock.requestPairingCode(phone);

          console.log("");
          console.log(
            "╔════════════════════════════════╗"
          );
          console.log(
            "║     DOST-ULTRA PAIRING CODE    ║"
          );
          console.log(
            "╠════════════════════════════════╣"
          );
          console.log(
            `║  ${code}`
          );
          console.log(
            "╚════════════════════════════════╝"
          );
          console.log("");

          console.log(
            "WhatsApp → Linked Devices → Link a Device → Link with phone number"
          );

          console.log("");
        } catch (error) {
          pairingRequested = false;

          console.log(
            "❌ Pairing Error:",
            error?.message || error
          );
        }
      }

      // -------------------------
      // CONNECTED
      // -------------------------

      if (connection === "open") {
        pairingRequested = false;

        console.log("");
        console.log(
          "╔════════════════════════════════╗"
        );
        console.log(
          "║    ✅ DOST-ULTRA CONNECTED     ║"
        );
        console.log(
          "╠════════════════════════════════╣"
        );
        console.log(
          "║       BOT IS ONLINE 🟢         ║"
        );
        console.log(
          "╚════════════════════════════════╝"
        );
        console.log("");
      }

      // -------------------------
      // CLOSED
      // -------------------------

      if (connection === "close") {
        const statusCode =
          lastDisconnect?.error?.output
            ?.statusCode;

        console.log(
          "❌ Connection closed:",
          statusCode
        );

        if (
          statusCode !==
          DisconnectReason.loggedOut
        ) {
          pairingRequested = false;

          console.log(
            "🔄 Restarting in 3 seconds..."
          );

          setTimeout(() => {
            startBot().catch(console.error);
          }, 3000);
        } else {
          console.log(
            "⚠️ WhatsApp logout detected."
          );
          console.log(
            "Fresh auth/session se pair again karo."
          );
        }
      }
    }
  );

  // =============================
  // MESSAGE HANDLER
  // =============================

  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {
      const msg = messages[0];

      if (!msg || !msg.message) {
        return;
      }

      if (msg.key.fromMe) {
        return;
      }

      const jid = msg.key.remoteJid;

      if (!jid) {
        return;
      }

      const sender =
        msg.key.participant ||
        jid;

      const text =
        getMessageContent(msg).trim();

      if (!text.startsWith(PREFIX)) {
        return;
      }

      const withoutPrefix =
        text.slice(PREFIX.length).trim();

      if (!withoutPrefix) {
        return;
      }

      const parts =
        withoutPrefix.split(/\s+/);

      const command =
        parts.shift().toLowerCase();

      const args =
        parts.join(" ").trim();

      // =========================
      // BOT OFF
      // =========================

      if (
        !botEnabled &&
        !isOwner(sender)
      ) {
        return;
      }

      // =========================
      // CUSTOM COMMANDS
      // =========================

      if (
        customCommands[command] &&
        ![
          "addcmd",
          "delcmd",
          "listcmd"
        ].includes(command)
      ) {
        await sock.sendMessage(jid, {
          text: customCommands[command]
        });
        return;
      }

      try {

        // =======================
        // HELP
        // =======================

        if (
          command === "help" ||
          command === "menu"
        ) {
          await sock.sendMessage(jid, {
            text: HELP
          });
          return;
        }

        // =======================
        // PING
        // =======================

        if (command === "ping") {
          const start = Date.now();

          await sock.sendMessage(jid, {
            text: "🏓 Checking..."
          });

          const ping =
            Date.now() - start;

          await sock.sendMessage(jid, {
            text:
              `🏓 *PONG!*\n\n⚡ Speed: ${ping}ms`
          });

          return;
        }

        // =======================
        // ALIVE
        // =======================

        if (command === "alive") {
          await sock.sendMessage(jid, {
            text:
              `🤖 *DOST-ULTRA*\n\n` +
              `🟢 Status: ONLINE\n` +
              `⚙️ Mode: PUBLIC\n` +
              `🔧 Prefix: ${PREFIX}\n` +
              `⏱️ Uptime: ${formatUptime(
                Date.now() - START_TIME
              )}`
          });

          return;
        }

        // =======================
        // UPTIME
        // =======================

        if (command === "uptime") {
          await sock.sendMessage(jid, {
            text:
              `⏱️ *BOT UPTIME*\n\n${formatUptime(
                Date.now() - START_TIME
              )}`
          });

          return;
        }

        // =======================
        // OWNER
        // =======================

        if (command === "owner") {
          await sock.sendMessage(jid, {
            contacts: {
              displayName: "DOST-ULTRA OWNER",
              contacts: [
                {
                  vcard:
                    `BEGIN:VCARD\n` +
                    `VERSION:3.0\n` +
                    `FN:DOST-ULTRA OWNER\n` +
                    `TEL;type=CELL;type=VOICE:+${OWNER}\n` +
                    `END:VCARD`
                }
              ]
            }
          });

          return;
        }

        // =======================
        // STICKER
        // =======================

        if (command === "sticker") {

          let targetMsg = msg.message;

          const quoted =
            getQuotedMessage(msg.message);

          if (quoted) {
            targetMsg = quoted;
          }

          const media =
            getMediaMessage(targetMsg);

          if (!media) {
            await sock.sendMessage(jid, {
              text:
                "🖼️ Image/video ko reply karke `.sticker` bhejo."
            });
            return;
          }

          const fakeMsg = {
            key: msg.key,
            message: targetMsg
          };

          const buffer =
            await downloadMedia(
              sock,
              fakeMsg
            );

          if (media.type === "image") {
            await sendSticker(
              sock,
              jid,
              buffer
            );
          }

          else if (media.type === "video") {
            const webp =
              await videoToSticker(buffer);

            await sock.sendMessage(jid, {
              sticker: webp
            });
          }

          else {
            await sendSticker(
              sock,
              jid,
              buffer
            );
          }

          return;
        }

        // =======================
        // TOIMG
        // =======================

        if (command === "toimg") {

          const quoted =
            getQuotedMessage(msg.message);

          if (!quoted?.stickerMessage) {
            await sock.sendMessage(jid, {
              text:
                "Sticker ko reply karke `.toimg` bhejo."
            });
            return;
          }

          const fakeMsg = {
            key: msg.key,
            message: quoted
          };

          const buffer =
            await downloadMedia(
              sock,
              fakeMsg
            );

          const image =
            await stickerToImage(buffer);

          await sock.sendMessage(jid, {
            image,
            caption: "🖼️ Converted"
          });

          return;
        }

        // =======================
        // TOVIDEO
        // =======================

        if (command === "tovideo") {

          const quoted =
            getQuotedMessage(msg.message);

          if (!quoted?.stickerMessage) {
            await sock.sendMessage(jid, {
              text:
                "Sticker ko reply karke `.tovideo` bhejo."
            });
            return;
          }

          const fakeMsg = {
            key: msg.key,
            message: quoted
          };

          const buffer =
            await downloadMedia(
              sock,
              fakeMsg
            );

          const video =
            await stickerToVideo(buffer);

          await sock.sendMessage(jid, {
            video,
            mimetype: "video/mp4"
          });

          return;
        }

        // =======================
        // CROP
        // =======================

        if (command === "crop") {

          const quoted =
            getQuotedMessage(msg.message);

          if (!quoted?.imageMessage) {
            await sock.sendMessage(jid, {
              text:
                "Image ko reply karke `.crop` bhejo."
            });
            return;
          }

          const fakeMsg = {
            key: msg.key,
            message: quoted
          };

          const buffer =
            await downloadMedia(
              sock,
              fakeMsg
            );

          const meta =
            await sharp(buffer)
              .metadata();

          const size =
            Math.min(
              meta.width || 512,
              meta.height || 512
            );

          const left =
            Math.floor(
              ((meta.width || size) - size) / 2
            );

          const top =
            Math.floor(
              ((meta.height || size) - size) / 2
            );

          const cropped =
            await sharp(buffer)
              .extract({
                left,
                top,
                width: size,
                height: size
              })
              .jpeg()
              .toBuffer();

          await sock.sendMessage(jid, {
            image: cropped,
            caption: "✂️ Cropped"
          });

          return;
        }

        // =======================
        // CAPTION
        // =======================

        if (command === "caption") {

          const quoted =
            getQuotedMessage(msg.message);

          if (!quoted?.imageMessage) {
            await sock.sendMessage(jid, {
              text:
                "Image ko reply karke `.caption Your Text` bhejo."
            });
            return;
          }

          if (!args) {
            await sock.sendMessage(jid, {
              text:
                "Example: `.caption Hello 👋`"
            });
            return;
          }

          const fakeMsg = {
            key: msg.key,
            message: quoted
          };

          const buffer =
            await downloadMedia(
              sock,
              fakeMsg
            );

          const meta =
            await sharp(buffer)
              .metadata
              const width = meta.width || 500;
const height = meta.height || 500;

const text = args.join(" ")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const output = await sharp(buffer)
  .resize({
    width: Math.min(width, 1000),
    height: Math.min(height, 1000),
    fit: "inside"
  })
  .composite([
    {
      input: Buffer.from(`
        <svg width="${Math.min(width, 1000)}" height="${Math.min(height, 1000)}">
          <style>
            .text {
              fill: white;
              font-size: 42px;
              font-family: Arial;
              font-weight: bold;
            }
          </style>
          <text
            x="50%"
            y="90%"
            text-anchor="middle"
            class="text"
          >${text}</text>
        </svg>
      `),
      gravity: "south"
    }
  ])
  .jpeg()
  .toBuffer();

await sock.sendMessage(jid, {
  image: output,
  caption: "✅ Caption added!"
});

return;
