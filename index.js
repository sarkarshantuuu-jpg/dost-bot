const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const fs = require("fs");
const ytdl = require("@distube/ytdl-core");

const PREFIX = ".";
let BOT_ACTIVE = true;
let CUSTOM_CMDS = {};
if (fs.existsSync("./custom.json")) { try { CUSTOM_CMDS = JSON.parse(fs.readFileSync("./custom.json")); } catch {} }
function saveCustom() { fs.writeFileSync("./custom.json", JSON.stringify(CUSTOM_CMDS, null, 2)); }

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({ auth: state, logger: P({ level: "silent" }) });
  sock.ev.on("creds.update", saveCreds);
  if (!state.creds.registered) {
    const phone = process.env.PHONE_NUMBER;
    setTimeout(async () => { try { console.log("CODE: "+ await sock.requestPairingCode(phone.replace(/\D/g,""))); } catch {} }, 3000);
  }
  sock.ev.on("connection.update", u => {
    if (u.connection === "open") console.log("DOST-ULTRA FULL ONLINE");
    if (u.connection === "close" && u.lastDisconnect?.error?.output?.statusCode!= 401) setTimeout(startBot, 3000);
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith("@g.us");
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
    if (!text ||!text.trim().startsWith(PREFIX)) return;
    const parts = text.trim().slice(1).split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    const query = parts.join(" ");

    try {
      if (command === "off") { BOT_ACTIVE = false; return sock.sendMessage(jid,{text:"🔴 Bot OFF"}); }
      if (command === "on") { BOT_ACTIVE = true; return sock.sendMessage(jid,{text:"🟢 Bot ON"}); }
      if (!BOT_ACTIVE) return;

      if (command === "addcmd") { let n=parts[0]?.toLowerCase(); let r=parts.slice(1).join(" "); if(!n||!r) return; CUSTOM_CMDS[n]=r; saveCustom(); return sock.sendMessage(jid,{text:`✅.${n} added`}); }
      if (command === "delcmd") { delete CUSTOM_CMDS[parts[0]]; saveCustom(); return sock.sendMessage(jid,{text:"Deleted"}); }
      if (command === "listcmd") { return sock.sendMessage(jid,{text:"📜 "+Object.keys(CUSTOM_CMDS).map(c=>"."+c).join("\n")}); }
      if (CUSTOM_CMDS[command]) return sock.sendMessage(jid,{text:CUSTOM_CMDS[command]});

      if (command === "help" || command === "menu") {
        return sock.sendMessage(jid,{text:`╭━━━ DOST-ULTRA FULL ━━━╮
┃ 🔧.ping.bot.on.off
┃ 👥.tagall.hidetag.kick.add
┃.promote.demote.link
┃.open.close.groupinfo
┃ 🎵.ytmp3 <link>.ytmp4 <link>
┃ 😂.joke.roast.shayari
┃ 🖼️.sticker /.s (Photo/Gif/Video)
┃ 💾.addcmd.delcmd.listcmd
╰━━━━━━━━━━━━━━━━━━━━╯`});
      }

      // GROUP
      if (command === "groupinfo") { if(!isGroup) return; const meta = await sock.groupMetadata(jid); return sock.sendMessage(jid,{text:`*${meta.subject}*\nMembers: ${meta.participants.length}`}); }
      if (command === "link") { if(!isGroup) return; const code = await sock.groupInviteCode(jid); return sock.sendMessage(jid,{text:"https://chat.whatsapp.com/"+code}); }
      if (command === "tagall") { if(!isGroup) return; const meta = await sock.groupMetadata(jid); let txt = query?`*${query}*\n\n`:""; let mentions=[]; for(let p of meta.participants){ txt+=`@${p.id.split("@")[0]} `; mentions.push(p.id); } return sock.sendMessage(jid,{text:txt, mentions}); }
      if (command === "hidetag") { if(!isGroup) return; const meta = await sock.groupMetadata(jid); return sock.sendMessage(jid,{text: query||"👋", mentions: meta.participants.map(p=>p.id)}); }
      if (command === "kick") { if(!isGroup) return; let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!user) return; await sock.groupParticipantsUpdate(jid,[user],"remove"); return sock.sendMessage(jid,{text:"Kicked"}); }
      if (command === "add") { if(!isGroup) return; let num = query.replace(/[^0-9]/g,""); if(!num) return; await sock.groupParticipantsUpdate(jid,[num+"@s.whatsapp.net"],"add"); return sock.sendMessage(jid,{text:"Added"}); }
      if (command === "promote") { let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; await sock.groupParticipantsUpdate(jid,[user],"promote"); return sock.sendMessage(jid,{text:"Promoted"}); }
      if (command === "demote") { let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; await sock.groupParticipantsUpdate(jid,[user],"demote"); return sock.sendMessage(jid,{text:"Demoted"}); }
      if (command === "open") { await sock.groupSettingUpdate(jid,"not_announcement"); return sock.sendMessage(jid,{text:"Group Open"}); }
      if (command === "close") { await sock.groupSettingUpdate(jid,"announcement"); return sock
