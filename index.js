const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const fs = require("fs");
const ytdl = require("@distube/ytdl-core");

const PREFIX = ".";
let BOT_ACTIVE = true;
if (!fs.existsSync('./custom.json')) fs.writeFileSync('./custom.json', '{}');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })) },
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Dost-Bot", "Chrome", "1.0.0"]
  });
  sock.ev.on("creds.update", saveCreds);
  if (!state.creds.registered) {
    const phone = process.env.PHONE_NUMBER || "919229681078";
    setTimeout(async () => { try { const code = await sock.requestPairingCode(phone.replace(/\D/g,"")); console.log("\nPAIR CODE: "+code+"\n"); } catch(e){ console.log(e.message); } }, 3000);
  }
  sock.ev.on("connection.update", u => {
    if(u.connection==="open") console.log("ONLINE");
    if(u.connection==="close" && u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) setTimeout(startBot,3000);
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0]; if (!msg?.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
    if (!text.trim()) return;
    const clean = text.trim();
    if (!clean.startsWith(PREFIX)) return; // hi auto off

    const parts = clean.slice(PREFIX.length).trim().split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    const args = parts;
    const query = args.join(" ");
    let custom = JSON.parse(fs.readFileSync('./custom.json'));

    if (custom[command]) return sock.sendMessage(jid, { text: custom[command] });

    if (command==="off"){BOT_ACTIVE=false; return sock.sendMessage(jid,{text:"BOT OFF ho gaya"});}
    if (command==="on"){BOT_ACTIVE=true; return sock.sendMessage(jid,{text:"BOT ON ho gaya"});}
    if (command==="bot"){ return sock.sendMessage(jid,{text:"STATUS: "+(BOT_ACTIVE?"ON":"OFF")}); }
    if (!BOT_ACTIVE) return;

    if (command==="addcmd"){
        if(!args[0]) return sock.sendMessage(jid,{text:"Use:.addcmd name reply"});
        custom[args[0].toLowerCase()]=args.slice(1).join(" ");
        fs.writeFileSync('./custom.json',JSON.stringify(custom));
        return sock.sendMessage(jid,{text:"Added."+args[0]});
    }
    if (command==="delcmd"){ delete custom[args[0]]; fs.writeFileSync('./custom.json',JSON.stringify(custom)); return sock.sendMessage(jid,{text:"Deleted"}); }
    if (command==="listcmd"){ return sock.sendMessage(jid,{text:"Custom:\n"+(Object.keys(custom).map(v=>"."+v).join("\n")||"Empty")}); }

    if (command==="menu"||command==="help"){
        return sock.sendMessage(jid,{text:"*DOST BOT MENU*\n\n.on /.off /.bot\n.sticker - photo se sticker\n.song <yt link>\n.video <yt link>\n.addcmd name text\n.listcmd\n.delcmd name\n.ping\n\nStatus: "+(BOT_ACTIVE?"ON":"OFF")});
    }
    if (command==="ping") return sock.sendMessage(jid,{text:"Pong!"});

    if (command==="song"){
        if(!ytdl.validateURL(query)) return sock.sendMessage(jid,{text:"YT link bhejo. Ex:.song https://youtu.be/xxx"});
        try{
            await sock.sendMessage(jid,{text:"Downloading audio..."});
            const info = await ytdl.getInfo(query);
            const stream = ytdl(query,{filter:'audioonly',quality:'highestaudio'});
            return sock.sendMessage(jid,{audio:{stream},mimetype:'audio/mpeg',fileName:info.videoDetails.title+".mp3"},{quoted:msg});
        }catch(e){ return sock.sendMessage(jid,{text:"Error: "+e.message}); }
    }
    if (command==="video"){
        if(!ytdl.validateURL(query)) return sock.sendMessage(jid,{text:"YT link bhejo"});
        try{
            await sock.sendMessage(jid,{text:"Downloading video..."});
            const info = await ytdl.getInfo(query);
            const stream = ytdl(query,{filter:'videoandaudio',quality:'18'});
            return sock.sendMessage(jid,{video:{stream},caption:info.videoDetails.title},{quoted:msg});
        }catch(e){ return sock.sendMessage(jid,{text:"Error: "+e.message}); }
    }
    if (command==="sticker"){
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if(!quoted?.imageMessage &&!msg.message.imageMessage) return sock.sendMessage(jid,{text:"Photo pe reply karke.sticker likho"});
        const source = msg.message.imageMessage? msg : { key: { remoteJid: jid, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant }, message: quoted };
        const buffer = await downloadMediaMessage(source,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage});
        const sticker = await sharp(buffer).resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).webp().toBuffer();
        return sock.sendMessage(jid,{sticker});
    }
  });
}
startBot();
