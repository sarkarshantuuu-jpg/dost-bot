const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require("@whiskeysockets/baileys");

const P = require("pino");
const sharp = require("sharp");

const PREFIX = ".";
const OWNER = process.env.OWNER_NUMBER || "919999999999";

let botEnabled = true;
let customCommands = {};

const startTime = Date.now();

function isOwner(sender) {
  return sender.split("@")[0] === OWNER.replace(/\D/g, "");
}

function uptime() {
  const sec = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["DOST-ULTRA", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // Pairing code
  if (!sock.authState.creds.registered) {
    const phone = process.env.PHONE_NUMBER;

    if (!phone) {
      console.log("PHONE_NUMBER Railway Variables me set karo.");
    } else {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(
            phone.replace(/\D/g, "")
          );

          console.log("================================");
          console.log("DOST-ULTRA PAIRING CODE:", code);
          console.log("================================");
        } catch (e) {
          console.log("Pairing error:", e.message);
        }
      }, 3000);
    }
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("DOST-ULTRA CONNECTED ✅");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("Reconnecting...");
        startBot();
      } else {
        console.log("Logged out.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];

      if (!msg.message || msg.key.fromMe) return;

      const jid = msg.key.remoteJid;
      const sender = msg.key.participant || jid;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

      if (!text.startsWith(PREFIX)) return;

      const body = text.slice(PREFIX.length).trim();
      const args = body.split(/\s+/);
      const command = args.shift().toLowerCase();

      if (!botEnabled && !isOwner(sender)) return;

      // =========================
      // BASIC
      // =========================

      if (command === "ping") {
        return sock.sendMessage(jid, {
          text: "🏓 Pong!\n⚡ DOST-ULTRA is alive."
        });
      }

      if (command === "alive") {
        return sock.sendMessage(jid, {
          text:
            "╭┈───〔 DOST-ULTRA 〕┈───⊷\n" +
            "├✦ Status: 🟢 ONLINE\n" +
            "├✦ Prefix: .\n" +
            "├✦ Mode: PUBLIC\n" +
            `├✦ Uptime: ${uptime()}\n` +
            "╰───────────────────⊷"
        });
      }

      if (command === "uptime") {
        return sock.sendMessage(jid, {
          text: `⏱️ Uptime: ${uptime()}`
        });
      }

      if (command === "owner") {
        return sock.sendMessage(jid, {
          text: `👑 Owner: @${OWNER.replace(/\D/g, "")}`,
          mentions: [`${OWNER.replace(/\D/g, "")}@s.whatsapp.net`]
        });
      }

      // =========================
      // HELP
      // =========================

      if (command === "help" || command === "menu") {
        return sock.sendMessage(jid, {
          text:
            `╭┈───〔 DOST-ULTRA 〕┈───⊷
├✦ Prefix: .
├✦ Status: ${botEnabled ? "🟢 ON" : "🔴 OFF"}
╰───────────────────⊷

🛠️ MEDIA
├ .sticker
├ .toimg
├ .tovideo
├ .caption <text>
├ .blur
├ .mirror
├ .rotate
└ .gif

👥 WHATSAPP
├ .dp
├ .mydp
├ .tagall
├ .admins
├ .groupinfo
└ .link

😂 FUN
├ .joke
├ .fact
├ .shayari
├ .quote
├ .8ball <question>
├ .dice
└ .coin

🤖 BOT
├ .ping
├ .alive
├ .uptime
├ .owner
├ .help
├ .addcmd
├ .delcmd
├ .listcmd
└ .bot on/off

╰───────────────────⊷`
        });
      }

      // =========================
      // OWNER
      // =========================

      if (command === "bot") {
        if (!isOwner(sender)) {
          return sock.sendMessage(jid, {
            text: "❌ Owner only."
          });
        }

        const mode = args[0]?.toLowerCase();

        if (mode === "on") {
          botEnabled = true;
          return sock.sendMessage(jid, {
            text: "🟢 Bot ON ho gaya."
          });
        }

        if (mode === "off") {
          botEnabled = false;
          return sock.sendMessage(jid, {
            text: "🔴 Bot OFF ho gaya."
          });
        }

        return sock.sendMessage(jid, {
          text: "Use: .bot on\n.bot off"
        });
      }

      if (command === "addcmd") {
        if (!isOwner(sender)) {
          return sock.sendMessage(jid, {
            text: "❌ Owner only."
          });
        }

        const input = body.slice(7).trim();
        const parts = input.split("|");

        if (parts.length < 2) {
          return sock.sendMessage(jid, {
            text: "Use:\n.addcmd hello | Hello 👋"
          });
        }

        const name = parts[0].trim().toLowerCase();
        const reply = parts.slice(1).join("|").trim();

        customCommands[name] = reply;

        return sock.sendMessage(jid, {
          text: `✅ Custom command added: .${name}`
        });
      }

      if (command === "delcmd") {
        if (!isOwner(sender)) {
          return sock.sendMessage(jid, {
            text: "❌ Owner only."
          });
        }

        const name = args[0]?.toLowerCase();

        if (!name || !customCommands[name]) {
          return sock.sendMessage(jid, {
            text: "❌ Command nahi mila."
          });
        }

        delete customCommands[name];

        return sock.sendMessage(jid, {
          text: `✅ .${name} deleted.`
        });
      }

      if (command === "listcmd") {
        const list = Object.keys(customCommands);

        return sock.sendMessage(jid, {
          text:
            list.length
              ? "📋 Custom Commands:\n\n" +
                list.map(x => `• .${x}`).join("\n")
              : "❌ Koi custom command nahi hai."
        });
      }

      // Custom commands
      if (customCommands[command]) {
        return sock.sendMessage(jid, {
          text: customCommands[command]
        });
      }

      // =========================
      // STICKER
      // =========================

      if (command === "sticker" || command === "s") {
        const quoted =
          msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        const image =
          msg.message.imageMessage ||
          quoted?.imageMessage;

        if (!image) {
          return sock.sendMessage(jid, {
            text: "📸 Image bhejo/reply karo aur .sticker likho."
          });
        }

        const mediaMsg = quoted
          ? {
              message: quoted
            }
          : msg;

        const buffer = await downloadMediaMessage(
          mediaMsg,
          "buffer",
          {},
          {
            logger: P({ level: "silent" }),
            reuploadRequest: sock.updateMediaMessage
          }
        );

        const sticker = await sharp(buffer)
          .resize(512, 512, {
            fit: "contain"
          })
          .webp()
          .toBuffer();

        return sock.sendMessage(jid, {
          sticker
        });
      }

      // =========================
      // DP
      // =========================

      if (command === "dp") {
        const target =
          msg.message.extendedTextMessage?.contextInfo
            ?.mentionedJid?.[0] || sender;

        try {
          const url = await sock.profilePictureUrl(
            target,
            "image"
          );

          return sock.sendMessage(jid, {
            image: { url },
            caption: "🖼️ Profile Picture"
          });
        } catch {
          return sock.sendMessage(jid, {
            text: "❌ DP nahi mili."
          });
        }
      }

      if (command === "mydp") {
        try {
          const url = await sock.profilePictureUrl(
            sock.user.id,
            "image"
          );

          return sock.sendMessage(jid, {
            image: { url },
            caption: "🖼️ My DP"
          });
        } catch {
          return sock.sendMessage(jid, {
            text: "❌ DP nahi mili."
          });
        }
      }

      // =========================
      // GROUP
      // =========================

      if (command === "tagall") {
        if (!jid.endsWith("@g.us")) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        const metadata = await sock.groupMetadata(jid);

        let text = "📢 TAG ALL\n\n";
        const mentions = [];

        for (const member of metadata.participants) {
          text += `@${member.id.split("@")[0]} `;
          mentions.push(member.id);
        }

        return sock.sendMessage(jid, {
          text,
          mentions
        });
      }

      if (command === "admins") {
        if (!jid.endsWith("@g.us")) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        const metadata = await sock.groupMetadata(jid);

        const admins = metadata.participants.filter(
          x => x.admin
        );

        let text = "👑 GROUP ADMINS\n\n";

        for (const admin of admins) {
          text += `• @${admin.id.split("@")[0]}\n`;
        }

        return sock.sendMessage(jid, {
          text,
          mentions: admins.map(x => x.id)
        });
      }

      if (command === "groupinfo") {
        if (!jid.endsWith("@g.us")) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        const metadata = await sock.groupMetadata(jid);

        return sock.sendMessage(jid, {
          text:
            `👥 GROUP INFO

📛 Name: ${metadata.subject}
👤 Members: ${metadata.participants.length}
🆔 ID: ${jid}`
        });
      }

      if (command === "link") {
        if (!jid.endsWith("@g.us")) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        try {
          const code = await sock.groupInviteCode(jid);

          return sock.sendMessage(jid, {
            text: `🔗 Group Link:\nhttps://chat.whatsapp.com/${code}`
          });
        } catch {
          return sock.sendMessage(jid, {
            text: "❌ Group link nahi mil saka."
          });
        }
      }

      // =========================
      // FUN
      // =========================

      if (command === "joke") {
        return sock.sendMessage(jid, {
          text:
            "😂 Teacher: Homework kaha hai?\nStudent: Sir, WiFi ke saath chala gaya."
        });
      }

      if (command === "fact") {
        return sock.sendMessage(jid, {
          text:
            "🧠 Fact: Octopus ke teen hearts hote hain."
        });
      }

      if (command === "shayari") {
        return sock.sendMessage(jid, {
          text:
            "❤️ Dil se nikli baat dil tak jaati hai,\nDosti ho sacchi to zindagi muskurati hai."
        });
      }

      if (command === "quote") {
        return sock.sendMessage(jid, {
          text:
            "✨ Har din ek nayi beginning ka chance hai."
        });
      }

      if (command === "dice") {
        const n = Math.floor(Math.random() * 6) + 1;

        return sock.sendMessage(jid, {
          text: `🎲 Dice: ${n}`
        });
      }

      if (command === "coin") {
        const result =
          Math.random() < 0.5 ? "HEADS 🪙" : "TAILS 🪙";

        return sock.sendMessage(jid, {
          text: `🪙 ${result}`
        });
      }

      if (command === "8ball") {
        const answers = [
          "🎱 Haan, bilkul!",
          "🎱 Shayad.",
          "🎱 Abhi kehna mushkil hai.",
          "🎱 Nahi.",
          "🎱 Definitely!",
          "🎱 Try again later."
        ];

        return sock.sendMessage(jid, {
          text:
            answers[
              Math.floor(Math.random() * answers.length)
            ]
        });
      }

    } catch (err) {
      console.log("Message Error:", err);
    }
  });
}

startBot();
