const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const fs = require("fs");
const axios = require("axios");

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
    if (u.connection === "open") console.log("DOST BOT ONLINE STEP 2");
    if (u.connection === "close" && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) setTimeout(startBot, 3000);
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith("@g.us");
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
    if (!text) return;
    if (!text.trim().startsWith(PREFIX)) return;
    const parts = text.trim().slice(1).split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    const query = parts.join(" ");

    try {
      if (command === "off") { BOT_ACTIVE = false; return sock.sendMessage(jid, { text: "🔴 OFF" }); }
      if (command === "on") { BOT_ACTIVE = true; return sock.sendMessage(jid, { text: "🟢 ON" }); }
      if (!BOT_ACTIVE) return;

      if (command === "addcmd") { let n=parts[0]?.toLowerCase(); let r=parts.slice(1).join(" "); if(!n||!r) return; CUSTOM_CMDS[n]=r; saveCustom(); return sock.sendMessage(jid,{text:`✅.${n} added`}); }
      if (command === "delcmd") { delete CUSTOM_CMDS[parts[0]]; saveCustom(); return sock.sendMessage(jid,{text:"🗑️ deleted"}); }
      if (CUSTOM_CMDS[command]) return sock.sendMessage(jid,{text:CUSTOM_CMDS[command]});

      if (command === "help" || command === "menu") {
        return sock.sendMessage(jid,{text:`╭〔 DOST-ULTRA STEP 2 〕\n├ WORKING DOWNLOADER ADDED\n├.ytmp3 <link> |.ytmp4 <link>\n├.song <name> |.video <name>\n├.fb <link> |.insta <link> |.tiktok <link>\n├ GROUP:.tagall.kick.add etc\n╰─ Next: STEP 3 FUN`});
      }
      if (command === "ping") return sock.sendMessage(jid,{text:"Pong"});

      // GROUP
      if (command === "tagall") {
        if(!isGroup) return;
        const meta = await sock.groupMetadata(jid);
        let txt = "*TAGALL*\n"; let mentions=[];
        for(let p of meta.participants){ txt+=`@${p.id.split("@")[0]} `; mentions.push(p.id); }
        return sock.sendMessage(jid,{text:txt, mentions});
      }

      // --- DOWNLOADER LOGIC ---
      async function ytdl(type, url){
        await sock.sendMessage(jid,{text:`⏳ Downloading ${type}...`});
        try {
          // Using free API - savetube
          let api = `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(url)}`;
          if(type==="video") api = `https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(url)}`;
          const {data} = await axios.get(api);
          let dlUrl = data.url || data.result || data.download || data.data?.url;
          if(!dlUrl) throw new Error("API fail");
          if(type==="audio") return sock.sendMessage(jid,{audio:{url:dlUrl}, mimetype:"audio/mpeg"}, {quoted:msg});
          else return sock.sendMessage(jid,{video:{url:dlUrl}, caption:"*DOST-ULTRA YT*"}, {quoted:msg});
        } catch(e){ return sock.sendMessage(jid,{text:"❌ Fail, dusra link try karo\n"+e.message}); }
      }

      if (command === "ytmp3" || command === "yta") {
        if(!query) return sock.sendMessage(jid,{text:".ytmp3 <youtube link>"});
        return ytdl("audio", query);
      }
      if (command === "ytmp4" || command === "ytv") {
        if(!query) return sock.sendMessage(jid,{text:".ytmp4 <youtube link>"});
        return ytdl("video", query);
      }
      if (command === "song" || command === "play") {
        if(!query) return sock.sendMessage(jid,{text:".song kesariya"});
        await sock.sendMessage(jid,{text:`🔍 Searching ${query}...`});
        try{
          const search = await axios.get(`https://api.ryzendesu.vip/api/search/youtube?query=${encodeURIComponent(query)}`);
          let video = search.data[0] || search.data.result?.[0] || search.data.data?.[0];
          let url = "https://youtube.com/watch?v="+ (video.id || video.videoId);
          return ytdl("audio", url);
        }catch(e){ return sock.sendMessage(jid,{text:"Search fail, direct link use karo.ytmp3 se"}); }
      }
      if (command === "fb" || command === "facebook") {
        if(!query) return sock.sendMessage(jid,{text:".fb <link>"});
        try{
          await sock.sendMessage(jid,{text:"⏳ FB downloading..."});
          const {data} = await axios.get(`https://api.ryzendesu.vip/api/downloader/fb?url=${encodeURIComponent(query)}`);
          let url = data.data?.[0]?.url || data.url || data.result;
          return sock.sendMessage(jid,{video:{url:url}, caption:"FB - DOST"}, {quoted:msg});
        }catch(e){ return sock.sendMessage(jid,{text:"FB fail"}); }
      }
      if (command === "insta" || command === "ig") {
        if(!query) return sock.sendMessage(jid,{text:".insta <link>"});
        try{
          await sock.sendMessage(jid,{text:"⏳ Insta downloading..."});
          const {data} = await axios.get(`https://api.ryzendesu.vip/api/downloader/igdl?url=${encodeURIComponent(query)}`);
          let url = data.data?.[0]?.url || data.url;
          return sock.sendMessage(jid,{video:{url:url}, caption:"Insta - DOST"}, {quoted:msg});
        }catch(e){ return sock.sendMessage(jid,{text:"Insta fail"}); }
      }
      if (command === "tiktok" || command === "tt") {
        if(!query) return sock.sendMessage(jid,{text:".tiktok <link>"});
        try{
          await sock.sendMessage(jid,{text:"⏳ TikTok downloading..."});
          const {data} = await axios.get(`https://api.ryzendesu.vip/api/downloader/tiktok?url=${encodeURIComponent(query)}`);
          let url = data.data?.play || data.url || data.result?.play;
          return sock.sendMessage(jid,{video:{url:url}, caption:"TikTok - DOST"}, {quoted:msg});
        }catch(e){ return sock.sendMessage(jid,{text:"TikTok fail"}); }
      }

      // sticker
      if (command === "sticker" || command === "s") {
        const q = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.imageMessage &&!msg.message.imageMessage) return;
        const m = q? { key: { remoteJid: jid, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant }, message: q } : msg;
        const buf = await downloadMediaMessage(m,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage});
        const webp = await sharp(buf).resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).webp().toBuffer();
        return sock.sendMessage(jid,{sticker:webp});
      }

    } catch (e) { console.log(e); }
  });
}
startBot();
