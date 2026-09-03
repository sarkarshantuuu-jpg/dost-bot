const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const fs = require("fs");

const PREFIX = ".";
const START_TIME = Date.now();
let BOT_ACTIVE = true;

let CUSTOM_CMDS = {};
if (fs.existsSync("./custom.json")) { try { CUSTOM_CMDS = JSON.parse(fs.readFileSync("./custom.json")); } catch {} }
function saveCustom() { fs.writeFileSync("./custom.json", JSON.stringify(CUSTOM_CMDS, null, 2)); }

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({ auth: state, logger: P({ level: "silent" }), printQRInTerminal: false });
  sock.ev.on("creds.update", saveCreds);

  if (!state.creds.registered) {
    const phone = process.env.PHONE_NUMBER;
    setTimeout(async () => {
      try { const code = await sock.requestPairingCode(phone.replace(/\D/g, "")); console.log("PAIRING CODE: " + code); } catch (e) { console.log(e.message); }
    }, 3000);
  }

  sock.ev.on("connection.update", u => {
    if (u.connection === "open") console.log("DOST BOT ONLINE");
    if (u.connection === "close" && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) setTimeout(startBot, 3000);
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith("@g.us");
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
    if (!text) return;
    const clean = text.trim();
    if (!clean.startsWith(PREFIX)) return;
    const parts = clean.slice(1).trim().split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    const query = parts.join(" ");

    try {
      if (command === "off") { BOT_ACTIVE = false; return sock.sendMessage(jid, { text: "🔴 BOT OFF" }); }
      if (command === "on") { BOT_ACTIVE = true; return sock.sendMessage(jid, { text: "🟢 BOT ON" }); }
      if (command === "bot") return sock.sendMessage(jid, { text: BOT_ACTIVE? "ON 🟢" : "OFF 🔴" });
      if (!BOT_ACTIVE) return;

      // CUSTOM
      if (command === "addcmd") { let n=parts[0]?.toLowerCase(); let r=parts.slice(1).join(" "); if(!n||!r) return sock.sendMessage(jid,{text:"Use:.addcmd naam reply"}); CUSTOM_CMDS[n]=r; saveCustom(); return sock.sendMessage(jid,{text:`✅.${n} add`}); }
      if (command === "delcmd") { delete CUSTOM_CMDS[parts[0]]; saveCustom(); return sock.sendMessage(jid,{text:"🗑️ deleted"}); }
      if (command === "listcmd") { return sock.sendMessage(jid,{text:"📜."+Object.keys(CUSTOM_CMDS).join("\n.")}); }
      if (CUSTOM_CMDS[command]) return sock.sendMessage(jid,{text:CUSTOM_CMDS[command]});

      if (command === "help" || command === "menu") {
        return sock.sendMessage(jid, { text: `╭〔 DOST-ULTRA 〕\n├ STEP 1 ACTIVE: GROUP COMMANDS WORKING\n├.tagall.hidetag.kick.add.promote.demote.groupinfo.link.open.close\n├ STEP 2 NEXT: DOWNLOADER\n╰─.help likho` });
      }
      if (command === "ping") return sock.sendMessage(jid, { text: "Pong " + Math.floor((Date.now()-START_TIME)/1000)+"s" });

      // --- GROUP COMMANDS WORKING ---
      if (command === "groupinfo" || command === "infogp") {
        if (!isGroup) return sock.sendMessage(jid,{text:"Group me use karo"});
        const meta = await sock.groupMetadata(jid);
        return sock.sendMessage(jid,{text:`*${meta.subject}*\nMembers: ${meta.participants.length}\nDesc: ${meta.desc || "No desc"}`});
      }
      if (command === "link" || command === "invite") {
        if (!isGroup) return;
        const code = await sock.groupInviteCode(jid);
        return sock.sendMessage(jid,{text:"https://chat.whatsapp.com/"+code});
      }
      if (command === "tagall") {
        if (!isGroup) return;
        const meta = await sock.groupMetadata(jid);
        let txt = query? `*${query}*\n\n` : "*TAG ALL*\n\n";
        let mentions = [];
        for(let p of meta.participants){ txt+=`@`+p.id.split("@")[0]+" "; mentions.push(p.id); }
        return sock.sendMessage(jid,{text:txt, mentions});
      }
      if (command === "hidetag") {
        if (!isGroup) return;
        const meta = await sock.groupMetadata(jid);
        let mentions = meta.participants.map(a=>a.id);
        return sock.sendMessage(jid,{text: query || "Hi", mentions});
      }
      if (command === "kick") {
        if (!isGroup) return;
        let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
        if (!user) return sock.sendMessage(jid,{text:"Kisi ko tag/reply karke.kick likho"});
        await sock.groupParticipantsUpdate(jid,[user],"remove");
        return sock.sendMessage(jid,{text:"Kicked"});
      }
      if (command === "add") {
        if (!isGroup) return;
        let num = query.replace(/[^0-9]/g,"");
        if(!num) return sock.sendMessage(jid,{text:".add 91XXXXXXXXXX"});
        await sock.groupParticipantsUpdate(jid,[num+"@s.whatsapp.net"],"add");
        return sock.sendMessage(jid,{text:"Added"});
      }
      if (command === "promote") {
        let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
        await sock.groupParticipantsUpdate(jid,[user],"promote");
        return sock.sendMessage(jid,{text:"Promoted to admin"});
      }
      if (command === "demote") {
        let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
        await sock.groupParticipantsUpdate(jid,[user],"demote");
        return sock.sendMessage(jid,{text:"Demoted"});
      }
      if (command === "open") { await sock.groupSettingUpdate(jid,"not_announcement"); return sock.sendMessage(jid,{text:"Group opened"}); }
      if (command === "close") { await sock.groupSettingUpdate(jid,"announcement"); return sock.sendMessage(jid,{text:"Group closed"}); }

      // STICKER
      if (command === "sticker" || command === "s") {
        const q = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.imageMessage) return sock.sendMessage(jid,{text:"Photo reply.sticker"});
        const quoted = { key: { remoteJid: jid, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant }, message: q };
        const buf = await downloadMediaMessage(quoted,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage});
        const webp = await sharp(buf).resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).webp().toBuffer();
        return sock.sendMessage(jid,{sticker:webp});
      }

    } catch (e) { console.log(e.message); sock.sendMessage(jid,{text:"Error: "+e.message}); }
  });
}
startBot();
