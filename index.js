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
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  // =========================
  // PAIRING
  // =========================
  if (!state.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER;

    if (!phoneNumber) {
      console.log("❌ PHONE_NUMBER environment variable missing");
    } else {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(
            phoneNumber.replace(/[^0-9]/g, "")
          );

          console.log("================================");
          console.log("PAIRING CODE:", code);
          console.log("WhatsApp > Linked Devices > Link with phone number");
          console.log("================================");
        } catch (err) {
          console.log("❌ Pairing error:", err.message);
        }
      }, 3000);
    }
  }

  // =========================
  // CONNECTION
  // =========================
  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ Dost Bot Connected!");
    }

    if (connection === "close") {
      const loggedOut =
        lastDisconnect?.error?.output?.statusCode ===
        DisconnectReason.loggedOut;

      if (!loggedOut) {
        console.log("🔄 Reconnecting...");
        setTimeout(startBot, 3000);
      } else {
        console.log("❌ WhatsApp logged out.");
      }
    }
  });

  // =========================
  // MESSAGE HANDLER
  // =========================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];

    if (!msg?.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    // HI
    if (text.trim().toLowerCase() === "hi") {
      await sock.sendMessage(jid, {
        text: "Hello jaan! Dost bot online hai ❤️"
      });
      return;
    }

    if (!text.trim().startsWith(PREFIX)) return;

    const parts = text.trim().slice(1).split(/\s+/);
    const command = (parts.shift() || "").toLowerCase();
    const args = parts;

    try {
      // =========================
      // HELP
      // =========================
      if (command === "help") {
        return sock.sendMessage(jid, {
          text:
`🤖 *DOST BOT*

🛠️ MEDIA
.sticker
.photo
.toimg
.crop
.caption <text>
.blur
.mirror
.rotate

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

      // =========================
      // PING
      // =========================
      if (command === "ping") {
        return sock.sendMessage(jid, {
          text: "🏓 Pong!"
        });
      }

      // =========================
      // ALIVE
      // =========================
      if (command === "alive") {
        return sock.sendMessage(jid, {
          text: "✅ Dost Bot is alive 😎"
        });
      }

      // =========================
      // OWNER
      // =========================
      if (command === "owner") {
        return sock.sendMessage(jid, {
          text: `👑 Owner: +${process.env.OWNER_NUMBER || "Not set"}`
        });
      }

      // =========================
      // UPTIME
      // =========================
      if (command === "uptime") {
        const sec = Math.floor((Date.now() - START_TIME) / 1000);

        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;

        return sock.sendMessage(jid, {
          text: `⏱️ *Uptime*\n${d}d ${h}h ${m}m ${s}s`
        });
      }

      // =========================
      // QUOTED MESSAGE
      // =========================
      const context =
        msg.message.extendedTextMessage?.contextInfo;

      const quotedMessage = context?.quotedMessage;

      async function getQuotedBuffer() {
        if (!quotedMessage || !context?.stanzaId) {
          throw new Error("NO_QUOTED_MEDIA");
        }

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

      // =========================
      // IMAGE -> STICKER
      // =========================
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

      // =========================
      // STICKER -> PHOTO
      // =========================
      if (command === "photo" || command === "toimg") {
        if (!quotedMessage?.stickerMessage) {
          return sock.sendMessage(jid, {
            text: "❌ Sticker ko reply karke .photo ya .toimg likho."
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

      // =========================
      // CROP
      // =========================
      if (command === "crop") {
        if (!quotedMessage?.imageMessage) {
          return sock.sendMessage(jid, {
            text: "❌ Photo ko reply karke .crop likho."
          });
        }

        const buffer = await getQuotedBuffer();

        const image = await sharp(buffer)
          .resize(800, 800, { fit: "cover" })
          .jpeg()
          .toBuffer();

        return sock.sendMessage(jid, {
          image
        });
      }

      // =========================
      // BLUR
      // =========================
      if (command === "blur") {
        if (!quotedMessage?.imageMessage) {
          return sock.sendMessage(jid, {
            text: "❌ Photo ko reply karke .blur likho."
          });
        }

        const buffer = await getQuotedBuffer();

        const image = await sharp(buffer)
          .blur(8)
          .jpeg()
          .toBuffer();

        return sock.sendMessage(jid, {
          image
        });
      }

      // =========================
      // MIRROR
      // =========================
      if (command === "mirror") {
        if (!quotedMessage?.imageMessage) {
          return sock.sendMessage(jid, {
            text: "❌ Photo ko reply karke .mirror likho."
          });
        }

        const buffer = await getQuotedBuffer();

        const image = await sharp(buffer)
          .flop()
          .jpeg()
          .toBuffer();

        return sock.sendMessage(jid, {
          image
        });
      }

      // =========================
      // ROTATE
      // =========================
      if (command === "rotate") {
        if (!quotedMessage?.imageMessage) {
          return sock.sendMessage(jid, {
            text: "❌ Photo ko reply karke .rotate likho."
          });
        }

        const buffer = await getQuotedBuffer();

        const image = await sharp(buffer)
          .rotate(90)
          .jpeg()
          .toBuffer();

        return sock.sendMessage(jid, {
          image
        });
      }

      // =========================
      // CAPTION
      // =========================
      if (command === "caption") {
        if (!quotedMessage?.imageMessage) {
          return sock.sendMessage(jid, {
            text: "❌ Photo ko reply karke .caption Hello likho."
          });
        }

        const caption = args.join(" ");

        if (!caption) {
          return sock.sendMessage(jid, {
            text: "❌ Caption likho.\nExample: .caption Hello"
          });
        }

        const buffer = await getQuotedBuffer();

        return sock.sendMessage(jid, {
          image: buffer,
          caption
        });
      }

      // =========================
      // DP
      // =========================
      if (command === "dp") {
        if (!args[0]) {
          return sock.sendMessage(jid, {
            text: "❌ Example: .dp 919876543210"
          });
        }

        const number =
          args[0].replace(/[^0-9]/g, "") +
          "@s.whatsapp.net";

        try {
          const url = await sock.profilePictureUrl(
            number,
            "image"
          );

          return sock.sendMessage(jid, {
            image: { url },
            caption: "👤 Profile Picture"
          });
        } catch {
          return sock.sendMessage(jid, {
            text: "❌ Profile picture available nahi hai."
          });
        }
      }

      // =========================
      // MY DP
      // =========================
      if (command === "mydp") {
        try {
          const number = sock.user?.id;

          if (!number) throw new Error("NO_USER");

          const url = await sock.profilePictureUrl(
            number,
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

      // =========================
      // GROUP METADATA
      // =========================
      let metadata = null;

      if (jid.endsWith("@g.us")) {
        metadata = await sock.groupMetadata(jid);
      }

      // =========================
      // TAG ALL
      // =========================
      if (command === "tagall") {
        if (!metadata) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        const mentions = metadata.participants.map(
          p => p.id
        );

        const list = mentions
          .map((id, i) =>
            `${i + 1}. @${id.split("@")[0]}`
          )
          .join("\n");

        return sock.sendMessage(jid, {
          text: `📢 *TAG ALL*\n\n${list}`,
          mentions
        });
      }

      // =========================
      // ADMINS
      // =========================
      if (command === "admins") {
        if (!metadata) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        const admins = metadata.participants.filter(
          p => p.admin
        );

        const mentions = admins.map(p => p.id);

        const list = admins
          .map((p, i) =>
            `${i + 1}. @${p.id.split("@")[0]}`
          )
          .join("\n");

        return sock.sendMessage(jid, {
          text: `👑 *ADMINS*\n\n${list || "No admins found"}`,
          mentions
        });
      }

      // =========================
      // GROUP INFO
      // =========================
      if (command === "groupinfo") {
        if (!metadata) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        return sock.sendMessage(jid, {
          text:
`👥 *GROUP INFO*

📛 Name: ${metadata.subject}
👤 Members: ${metadata.participants.length}`
        });
      }

      // =========================
      // GROUP LINK
      // =========================
      if (command === "link") {
        if (!metadata) {
          return sock.sendMessage(jid, {
            text: "❌ Group me use karo."
          });
        }

        try {
          const code = await sock.groupInviteCode(jid);

          return sock.sendMessage(jid, {
            text: `🔗 https://chat.whatsapp.com/${code}`
          });
        } catch {
          return sock.sendMessage(jid, {
            text: "❌ Bot ko admin permission chahiye."
          });
        }
      }

      // =========================
      // FUN COMMANDS
      // =========================

      if (command === "joke") {
        const jokes = [
          "😂 Programmer ka favourite place? BUGER KING.",
          "🤣 WiFi slow hai to router ko ghoorne se speed nahi badhti.",
          "😎 Padhai aur WiFi dono kabhi-kabhi connected hote hain."
        ];

        return sock.sendMessage(jid, {
          text: jokes[Math.floor(Math.random() * jokes.length)]
        });
      }

      if (command === "fact") {
        const facts = [
          "🧠 Octopus ke teen hearts hote hain.",
          "🌍 Earth ki surface ka lagbhag 71% water hai.",
          "🐝 Bees communication ke liye dance movements use karti hain."
        ];

        return sock.sendMessage(jid, {
          text: facts[Math.floor(Math.random() * facts.length)]
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
        const quotes = [
          "✨ Believe in yourself.",
          "🔥 Small steps every day.",
          "💪 Never stop learning.",
          "😎 Be yourself."
        ];

        return sock.sendMessage(jid, {
          text: quotes[Math.floor(Math.random() * quotes.length)]
        });
      }

      if (command === "roast") {
        const roasts = [
          "😂 Bhai tera confidence dekh ke WiFi bhi disconnect ho gaya.",
          "🤣 Calculator bhi tujhe dekh ke confuse ho jata hai.",
          "😎 Tu special hai... category abhi research me hai."
        ];

        return sock.sendMessage(jid, {
          text: roasts[Math.floor(Math.random() * roasts.length)]
        });
      }

      if (command === "ship") {
        const percentage =
          Math.floor(Math.random() * 101);

        return sock.sendMessage(jid, {
          text: `❤️ Compatibility: *${percentage}%*`
        });
      }

      if (command === "8ball") {
        if (!args.length) {
          return sock.sendMessage(jid, {
            text: "🎱 Example: .8ball Kal baarish hogi?"
          });
        }

        const answers = [
          "🎱 Haan.",
          "🎱 Nahi.",
          "🎱 Shayad.",
          "🎱 Definitely!",
          "🎱 Abhi predict nahi kar sakta."
        ];

        return sock.sendMessage(jid, {
          text: answers[Math.floor(Math.random() * answers.length)]
        });
      }

      if (command === "dice") {
        const n = Math.floor(Math.random() * 6) + 1;

        return sock.sendMessage(jid, {
          text: `🎲 You rolled: *${n}*`
        });
      }

      if (command === "coin") {
        const result =
          Math.random() < 0.5 ? "Heads" : "Tails";

        return sock.sendMessage(jid, {
          text: `🪙 *${result}*`
        });
      }

      if (command === "meme") {
        return sock.sendMessage(jid, {
          text:
`😂 *MEME*

Teacher: Homework kahan hai?
Me: Sir, Google Drive me tha...
Google: Storage full hai. 😭`
        });
      }

      // =========================
      // UNKNOWN COMMAND
      // =========================
      return sock.sendMessage(jid, {
        text: "❓ Unknown command. .help likho."
      });

    } catch (err) {
      console.log("❌ Command Error:", err);

      await sock.sendMessage(jid, {
        text: `❌ Error: ${err.message || "Something went wrong"}`
      });
    }
  });
}

startBot().catch(err => {
  console.error("❌ BOT START ERROR:", err);
});
