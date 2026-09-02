const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");

const MY_NUMBER = "919229681078";
const PREFIX = ".";
const BOT_NAME = "DOST-ULTRA";
const OWNER_NAME = "DOST";

const getText = (msg) => (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "").trim();

async function startBot(){
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const logger = P({level:"silent"});

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: true
  });

  sock.ev.on("creds.update", saveCreds);

  if(!state.creds.registered){
    setTimeout(async()=>{
      try{
        if(sock.ws.readyState === 1){
          const code = await sock.requestPairingCode(MY_NUMBER);
          console.log(`\nCODE FOR ${MY_NUMBER}: ${code}\n`);
        }
      }catch(e){ console.log("Pairing retry: "+e.message); }
    }, 8000);
  }

  sock.ev.on("connection.update", ({connection, lastDisconnect})=>{
    if(connection==="open"){
      console.log(`✅ ${BOT_NAME} CONNECTED FOR ${MY_NUMBER}`);
      if(!state.creds.registered){
        sock.requestPairingCode(MY_NUMBER).then(c=>console.log(`CODE: ${c}`)).catch(()=>{});
      }
    }
    if(connection==="close"){
      const reason = lastDisconnect?.error?.output?.statusCode;
      if(reason !== DisconnectReason.loggedOut) setTimeout(startBot, 3000);
      else { if(fs.existsSync("./auth")) fs.rmSync("./auth",{recursive:true,force:true}); }
    }
  });

  sock.ev.on("messages.upsert", async({messages})=>{
    const msg = messages[0]; if(!msg?.message || msg.key.fromMe) return;
    const text = getText(msg); if(!text.startsWith(PREFIX)) return;
    const args = text.slice(1).trim().split(/ +/);
    const cmd = args[0].toLowerCase();
    const q = args.slice(1).join(" ");
    const jid = msg.key.remoteJid;
    const reply = (t) => sock.sendMessage(jid, {text:t}, {quoted:msg});

    // === CORE COMMANDS ===
    if(cmd==="ping"){ return reply(`🏓 Pong! ${Date.now()%1000}ms\nBot: ${MY_NUMBER}`); }
    if(cmd==="alive"){ return reply(`🤖 *${BOT_NAME} Alive!*\n\n👑 Owner: ${OWNER_NAME}\n📞 Number: ${MY_NUMBER}\n⏱️ Uptime: ${Math.floor(process.uptime()/60)}m\n🟢 Status: Online`); }
    if(cmd==="coin"){ return reply(`🪙 *${Math.random()<0.5?"Heads":"Tails"}*`); }
    if(cmd==="dice"){ return reply(`🎲 Dice: *${Math.floor(Math.random()*6)+1}*`); }

    // === MENU ===
    if(cmd==="help"||cmd==="menu"){
      return reply(
`╭┈───〔 ${BOT_NAME} 〕┈───⊷
├👑 Owner: ${OWNER_NAME}
├📞 ${MY_NUMBER}
├⚡ Prefix: ${PREFIX}
├🟢 Mode: public
╰────────────────⊷

『 DOWNLOADER (18) 』
⬡ ytmp3, ytmp4, song, video, fb, insta, tiktok, mediafire, gdrive, apk, pinterest, spotify, soundcloud, twitter, threads, igstory, play, ytsearch

『 MEDIA (16) 』
⬡ sticker, photo, toimg, tovideo, crop, caption, blur, mirror, rotate, gif, emojimix, quote, meme,
