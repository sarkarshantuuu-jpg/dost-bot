const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require("@whiskeysockets/baileys");

const P = require("pino");
const sharp = require("sharp");

const PREFIX = ".";
const START_TIME = Date.now();

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  // PAIRING
  if (!state.creds.registered) {
    const phone = process.env.PHONE_NUMBER;

    if (!phone) {
      console.log("❌ PHONE_NUMBER missing");
    } else {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(
            phone.replace(/\D/g, "")
          );

          console.log("==============================");
          console.log("PAIRING CODE:", code);
          console.log("==============================");
        } catch (e) {
          console.log("Pairing Error:", e.message);
        }
      }, 3000);
    }
  }

  // CONNECTION
  sock.ev.on("connection.update", update => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ DOST BOT ONLINE 🔥");
    }

    if (connection === "close") {
      const loggedOut =
        lastDisconnect?.error?.output?.statusCode ===
        DisconnectReason.loggedOut;

      if (!loggedOut) {
        console.log("🔄 Reconnecting...");
        setTimeout(startBot, 3000);
      }
    }
  });

  // MESSAGES
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];

    if (!msg?.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      "";

    if (!text) return;

    const clean = text.trim();

    // HI
    if (
      clean.toLowerCase() === "hi" ||
      clean.toLowerCase() === "hello"
    ) {
      await sock.sendMessage(jid, {
        text: "Hello jaan! Dost bot online hai ❤️\n.help likho"
      });
      return;
    }

    // PREFIX
    if (!clean.startsWith(PREFIX)) return;

    const parts = clean
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);

    const command = parts.shift()?.toLowerCase();
    const args = parts;
    const query = args.join(" ");

    try {

      // -------------------------
      // HELP
      // -------------------------
      if (command === "help" || command === "menu") {
        return sock.sendMessage(jid, {
          text:
`🤖 *DOST BOT COMMANDS*

🛠️ MEDIA
.sticker
.photo
.toimg
.tovideo
.crop
.caption <text>
.blur
.mirror
.rotate
.gif

👤 WHATSAPP
.dp <number>
.mydp
.tagall
.admins
.groupinfo
.link

😂 FUN
.roast
.joke
.meme
.fact
.shayari
.quote
.ship
.8ball <question>
.dice
.coin

🤖 BOT
.help
.ping
.alive
.owner
.uptime`
        });
      }

      // -------------------------
      // BASIC
      // -------------------------
      if (command === "ping") {
        return sock.sendMessage(jid, {
          text: "🏓 Pong!"
        });
      }

      if (command === "alive") {
        const mins =
          Math.floor((Date.now() - START_TIME) / 60000);

        return sock.sendMessage(jid, {
          text: `✅ DOST BOT ALIVE 🔥\n⏱️ ${mins} minutes`
        });
      }

      if (command === "owner") {
        const owner =
          process.env.OWNER_NUMBER || "Not configured";

        return sock.sendMessage(jid, {
          text: `👑 Owner: wa.me/${owner}`
        });
      }

      if (command === "uptime") {
        const sec =
          Math.floor((Date.now() - START_TIME) / 1000);

        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;

        return sock.sendMessage(jid, {
          text: `⏱️ Uptime: ${d}d ${h}h ${m}m ${s}s`
        });
      }

      // -------------------------
      // QUOTED MEDIA
      // -------------------------
      const context =
        msg.message.extendedTextMessage?.contextInfo;

      const quotedMessage =
        context?.quotedMessage;

      async function getQuotedBuffer() {
        if (!quotedMessage) return null;

        const quoted = {
          key: {
            remoteJid: jid,
            id: context.stanzaId,
            participant: context.participant
          },
          message: quotedMessage
        };

        return downloadMediaMessage(
          quoted,
          "buffer",
          {},
          {
            logger: P({ level: "silent" }),
            reuploadRequest: sock.updateMediaMessage
          }
        );
      }

      // -------------------------
      // STICKER
      // -------------------------
      if (command === "sticker") {
        if (!quotedMessage?.imageMessage) {
          return sock.sendMessage(jid, {
            text: "❌ Photo ko reply karke .sticker likho."
          });
        }

        const buffer = await getQuotedBuffer();

        const sticker = await sharp(buffer)
          .resize(512, 512, {
            fit: "contain",
            background: {
              r: 0,
              g: 0,
              b: 0,
              alpha: 0
            }
          })
          .webp()
          .toBuffer();

        return sock.sendMessage(jid, {
          sticker
        });
      }

      // -------------------------
      // PHOTO / TOIMG
      // -------------------------
      if (
        command === "photo" ||
        command === "toimg"
      ) {
        if (!quotedMessage?.stickerMessage) {
          return sock.sendMessage(jid, {
            text:
              "❌ Sticker ko reply karke .photo ya .toimg likho."
          });
        }

        const buffer = await getQuotedBuffer();

        const image = await sharp(buffer)
          .png()
          .toBuffer();

        return sock.sendMessage(jid, {
          image,
          caption: "📸 Sticker → Photo"
        });
      }

      // -------------------------
      // IMAGE EFFECTS
      // -------------------------
      if (
        ["crop", "blur", "mirror", "rotate"]
          .includes(command)
      ) {
        if (!quotedMessage?.imageMessage) {
          return sock.sendMessage(jid, {
            text:
              `❌ Photo ko reply karke .${command} likho.`
          });
        }

        const buffer = await getQuotedBuffer();

        let image;

        if (command === "crop") {
          image = await sharp(buffer)
            .resize(800, 800, { fit: "cover" })
            .jpeg()
            .toBuffer();
        }

        if (command === "blur") {
          image = await sharp(buffer)
            .blur(8)
            .jpeg()
            .toBuffer();
        }

        if (command === "mirror") {
          image = await sharp(buffer)
            .flop()
            .jpeg()
            .toBuffer();
        }

        if (command === "rotate") {
          image = await sharp(buffer)
            .rotate(90)
            .jpeg()
            .toBuffer();
        }

        return sock.sendMessage(jid, {
          image
        });
      }

      // -------------------------
      // CAPTION
      // -------------------------
      if (command === "caption") {
        if (!quotedMessage?.imageMessage) {
          return sock.sendMessage(jid, {
            text:
              "❌ Photo ko reply karke .caption <text> likho."
          });
        }

        if (!query) {
          return sock.sendMessage(jid, {
            text:
              "Example: .caption Hello Dost"
          });
        }

        const buffer = await getQuotedBuffer();

        return sock.sendMessage(jid, {
          image: buffer,
          caption: query
        });
      }

      // -------------------------
      // VIDEO / GIF
      // -------------------------
      if (
        command === "tovideo" ||
        command === "gif"
      ) {
        return sock.sendMessage(jid, {
          text:
            "⚠️ Is command ke liye FFmpeg setup required hai."
        });
      }

      // -------------------------
      // DP
      // -------------------------
      if (command === "dp") {
        if (!args[0]) {
          return sock.sendMessage(jid, {
            text:
              "Example: .dp 919876543210"
          });
        }

        const number =
          args[0].replace(/\D/g, "") +
          "@s.whatsapp.net";

        try {
          const url =
            await sock.profilePictureUrl(
              number,
              "image"
            );

          return sock.sendMessage(jid, {
            image: { url },
            caption: "👤 Profile Picture"
          });
        } catch {
          return sock.sendMessage(jid, {
            text:
              "❌ DP available nahi hai."
          });
        }
      }

      // -------------------------
      // MY DP
      // -------------------------
      if (command === "mydp") {
        try {
          const url =
            await sock.profilePictureUrl(
              sock.user.id,
              "image"
            );

          return sock.sendMessage(jid, {
            image: { url },
            caption: "👤 My DP"
          });
        } catch {
          return sock.sendMessage(jid, {
            text: "❌ DP nahi mili."
          });
        }
      }

      // -------------------------
      // GROUP DATA
      // -------------------------
      let metadata = null;

      if (jid.endsWith("@g.us")) {
        metadata =
          await sock.groupMetadata(jid);
      }

      // TAG ALL
      if (command === "tagall") {
        if (!metadata) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        const mentions =
          metadata.participants.map(p => p.id);

        const list = mentions
          .map(
            (id, i) =>
              `${i + 1}. @${id.split("@")[0]}`
          )
          .join("\n");

        return sock.sendMessage(jid, {
          text: `📢 *TAG ALL*\n\n${list}`,
          mentions
        });
      }

      // ADMINS
      if (command === "admins") {
        if (!metadata) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        const admins =
          metadata.participants.filter(
            p => p.admin
          );

        const mentions =
          admins.map(p => p.id);

        const list = admins
          .map(
            (p, i) =>
              `${i + 1}. @${p.id.split("@")[0]}`
          )
          .join("\n");

        return sock.sendMessage(jid, {
          text:
            `👑 *ADMINS*\n\n${list || "None"}`,
          mentions
        });
      }

      // GROUP INFO
      if (command === "groupinfo") {
        if (!metadata) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        return sock.sendMessage(jid, {
          text:
`👥 *GROUP INFO*

📛 ${metadata.subject}
👤 Members: ${metadata.participants.length}`
        });
      }

      // GROUP LINK
      if (command === "link") {
        if (!metadata) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        try {
          const code =
            await sock.groupInviteCode(jid);

          return sock.sendMessage(jid, {
            text:
              `🔗 https://chat.whatsapp.com/${code}`
          });
        } catch {
          return sock.sendMessage(jid, {
            text:
              "❌ Bot ko admin permission chahiye."
          });
        }
      }

      // -------------------------
      // FUN
      // -------------------------
      if (command === "joke") {
        const data = [
          "😂 WiFi slow ho to router ko ghoorne se speed nahi badhti.",
          "🤣 Programmer ki life: Error → Google → Copy → Paste.",
          "😎 Dost: Padhai? Me: Kal se pakka."
        ];

        return sock.sendMessage(jid, {
          text:
            data[Math.floor(Math.random() * data.length)]
        });
      }

      if (command === "fact") {
        const data = [
          "🧠 Octopus ke 3 hearts hote hain.",
          "🌍 Earth ka lagbhag 71% surface water hai.",
          "🐝 Bees dance movements se information share karti hain."
        ];

        return sock.sendMessage(jid, {
          text:
            data[Math.floor(Math.random() * data.length)]
        });
      }

      if (command === "shayari") {
        return sock.sendMessage(jid, {
          text:
`✨ *Shayari*

Dosti wo nahi jo har waqt saath ho,
Dosti wo hai jo door rehkar bhi yaad ho ❤️`
        });
      }

      if (command === "quote") {
        const data = [
          "✨ Believe in yourself.",
          "🔥 Small steps every day.",
          "💪 Never stop learning.",
          "😎 Be yourself."
        ];

        return sock.sendMessage(jid, {
          text:
            data[Math.floor(Math.random() * data.length)]
        });
      }

      if (command === "roast") {
        const data = [
          "😂 Bhai tera confidence alag hi level ka hai.",
          "🤣 Tujhe dekh ke calculator bhi confuse ho jata hai.",
          "😎 Tu special hai, bas category unknown hai."
        ];

        return sock.sendMessage(jid, {
          text:
            data[Math.floor(Math.random() * data.length)]
        });
      }

      if (command === "ship") {
        const n =
          Math.floor(Math.random() * 101);

        return sock.sendMessage(jid, {
          text:
            `❤️ Compatibility: *${n}%*`
        });
      }

      if (command === "8ball") {
        if (!query) {
          return sock.sendMessage(jid, {
            text:
              "Example: .8ball Kal baarish hogi?"
          });
        }

        const answers = [
          "🎱 Haan!",
          "🎱 Nahi!",
          "🎱 Shayad.",
          "🎱 Definitely!",
          "🎱 Mujhe nahi pata 😅"
        ];

        return sock.sendMessage(jid, {
          text:
            answers[Math.floor(Math.random() * answers.length)]
        });
      }

      if (command === "dice") {
        const n =
          Math.floor(Math.random() * 6) + 1;

        return sock.sendMessage(jid, {
          text:
            `🎲 Dice: *${n}*`
        });
      }

      if (command === "coin") {
        const result =
          Math.random() < 0.5
            ? "Heads"
            : "Tails";

        return sock.sendMessage(jid, {
          text:
            `🪙 *${result}*`
        });
      }

      if (command === "meme") {
        return sock.sendMessage(jid, {
          text:
`😂 *MEME*

Teacher: Homework?
Me: Sir, kal pakka.
Teacher: Ye kal kab aayega? 😭`
        });
      }

      // UNKNOWN
      return sock.sendMessage(jid, {
        text:
          "❓ Unknown command. .help likho."
      });

    } catch (err) {
      console.error("Command Error:", err);

      await sock.sendMessage(jid, {
        text:
          "❌ Command me error aa gaya."
      });
    }
  });
}

startBot().catch(console.error);
