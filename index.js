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
let BOT_ACTIVE = true; // ON OFF STATE

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

    if (
      clean.toLowerCase() === "hi" ||
      clean.toLowerCase() === "hello"
    ) {
      if (!BOT_ACTIVE) return;
      await sock.sendMessage(jid, {
        text: "Hello jaan! Dost bot online hai ❤️\n.help likho"
      });
      return;
    }

    if (!clean.startsWith(PREFIX)) return;

    const parts = clean
     .slice(PREFIX.length)
     .trim()
     .split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    const args = parts;
    const query = args.join(" ");

    try {

      // ON OFF COMMANDS
      if (command === "off" || command === "bot off" || command === "stop") {
        BOT_ACTIVE = false;
        return sock.sendMessage(jid, {
          text: "🔴 *BOT OFF* ho gaya hai.\nAb koi command kaam nahi karega.\nON karne ke liye *.on* likho."
        });
      }

      if (command === "on" || command === "bot on" || command === "start") {
        BOT_ACTIVE = true;
        return sock.sendMessage(jid, {
          text: "🟢 *BOT ON* ho gaya hai 🔥\nAb sab commands kaam karenge."
        });
      }

      if (command === "bot" || command === "status") {
        return sock.sendMessage(jid, {
          text: `🤖 *BOT STATUS:* ${BOT_ACTIVE? "🟢 ON" : "🔴 OFF"}\n⏱️ Uptime: ${Math.floor((Date.now() - START_TIME)/60000)} min`
        });
      }

      // IF BOT OFF, IGNORE ALL
      if (!BOT_ACTIVE) return;

      if (command === "help" || command === "menu") {
        return sock.sendMessage(jid, {
          text:
`🤖 *DOST BOT COMMANDS*

⚙️ BOT CONTROL
.on mentions
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
