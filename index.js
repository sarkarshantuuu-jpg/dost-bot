const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys");
const P = require("pino");
const sharp = require("sharp");
const fs = require("fs");
const axios = require("axios");

const PREFIX = ".";
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
    setTimeout(async () => { try { const code = await sock.requestPairingCode(phone.replace(/\D/g, "")); console.log("CODE: "+code); } catch {} }, 3000);
  }
  sock.ev.on("connection.update", u => {
    if (u.connection === "open") console.log("ONLINE FIXED");
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
      if (command === "off") { BOT_ACTIVE = false; return sock.sendMessage(jid, { text: "🔴 OFF" }); }
      if (command === "on") { BOT_ACTIVE = true; return sock.sendMessage(jid, { text: "🟢 ON" }); }
      if (!BOT_ACTIVE) return;

      if (command === "addcmd") { let n=parts[0]?.toLowerCase(); let r=parts.slice(1).join(" "); CUSTOM_CMDS[n]=r; saveCustom(); return sock.sendMessage(jid,{text:`✅.${n} added`}); }
      if (command === "delcmd") { delete CUSTOM_CMDS[parts[0]]; saveCustom(); return sock.sendMessage(jid,{text:"deleted"}); }
      if (CUSTOM_CMDS[command]) return sock.sendMessage(jid,{text:CUSTOM_CMDS[command]});

      if (command === "help" || command === "menu") {
        return sock.sendMessage(jid,{text:`╭〔 DOST-ULTRA FIXED 〕\n├.ytmp3 <link>.ytmp4 <link>\n├.song <name>.fb.insta.tiktok\n├.tagall.kick.add.promote\n╰─ try:.ytmp3 https://youtu.be/2Vv-BfVoq4g`});
      }

      if (command === "tagall") {
        if(!isGroup) return;
        const meta = await sock.groupMetadata(jid);
        let txt = "*TAG ALL*\n"; let mentions=[];
        for(let p of meta.participants){ txt+=`@${p.id.split("@")[0]} `; mentions.push(p.id); }
        return sock.sendMessage(jid,{text:txt, mentions});
      }

      // FIXED DOWNLOADER
      async function ytdl(type, url){
        await sock.sendMessage(jid,{text:`⏳ Downloading ${type}... try kar raha hu`});
        const apisA = [
          `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${url}`,
          `https://api.princetechn.com/api/download/ytmp3?apikey=prince&url=${url}`,
          `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${url}`
        ];
        const apisV = [
          `https://api.giftedtech.co.ke/api/download/ytmp4?apikey=gifted&url=${url}`,
          `https://api.princetechn.com/api/download/ytmp4?apikey=prince&url=${url}`
        ];
        let list = type==="audio"? apisA : apisV;
        for(let api of list){
          try{
            const {data} = await axios.get(api,{timeout:20000});
            let dlUrl = data.result?.download_url || data.result?.url || data.result || data.download_url || data.url || data.data?.url || data.data?.[0]?.url;
            if(dlUrl){
              if(type==="audio") return sock.sendMessage(jid,{audio:{url:dlUrl}, mimetype:"audio/mpeg"}, {quoted:msg});
              else return sock.sendMessage(jid,{video:{url:dlUrl}, caption:"DOST"}, {quoted:msg});
            }
          }catch(e){ continue; }
        }
        return sock.sendMessage(jid,{text:"❌ API down hai abhi, 5 min baad.ytmp3 link se try karo"});
      }

      if (command === "ytmp3" || command === "yta") {
        if(!query) return sock.sendMessage(jid,{text:".ytmp3 <link>"});
        return ytdl("audio", query);
      }
      if (command === "ytmp4" || command === "ytv") {
        if(!query) return sock.sendMessage(jid,{text:".ytmp4 <link>"});
        return ytdl("video", query);
      }
      if (command === "song") {
        if(!query) return sock.sendMessage(jid,{text:".song kesariya"});
        return sock.sendMessage(jid,{text:`Bhai.song search wala API down rehta hai, direct use kar:\n1. YouTube pe ja song ka link copy kar\n2..ytmp3 <link> bhej\nExample:.ytmp3 https://youtu.be/2Vv-BfVoq4g`});
      }
      if (command === "fb") {
        if(!query) return;
        try{
          const {data}= await axios.get(`https://api.giftedtech.co.ke/api/download/fb?apikey=gifted&url=${query}`);
          let url = data.result?.[0]?.url || data.result?.url || data.url;
          return sock.sendMessage(jid,{video:{url:url}, caption:"FB"}, {quoted:msg});
        }catch{ return sock.sendMessage(jid,{text:"FB fail, dusra link try"}); }
      }
      if (command === "insta") {
        if(!query) return;
        try{
          const {data}= await axios.get(`https://api.giftedtech.co.ke/api/download/igdl?apikey=gifted&url=${query}`);
          let url = data.result?.[0]?.url || data.result?.url;
          return sock.sendMessage(jid,{video:{url:url}}, {quoted:msg});
        }catch{ return sock.sendMessage(jid,{text:"Insta fail"}); }
      }
      if (command === "tiktok") {
        if(!query) return;
        try{
          const {data}= await axios.get(`https://api.giftedtech.co.ke/api/download/tiktok?apikey=gifted&url=${query}`);
          let url = data.result?.video || data.result?.play || data.url;
          return sock.sendMessage(jid,{video:{url:url}}, {quoted:msg});
        }catch{ return sock.sendMessage(jid,{text:"TikTok fail"}); }
      }

      if (command === "sticker" || command === "s") {
        const q = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const m = q? { key: { remoteJid: jid, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant }, message: q } : msg;
        const buf = await downloadMediaMessage(m,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage});
        const webp = await sharp(buf).resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).webp().toBuffer();
        return sock.sendMessage(jid,{sticker:webp});
      }

    } catch (e) { console.log(e.message); }
  });
}
startBot();
