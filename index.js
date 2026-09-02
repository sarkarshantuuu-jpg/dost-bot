const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const P = require("pino");

async function startBot(){
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({level:"silent"})) },
    logger: P({level:"silent"}),
    browser: Browsers.ubuntu("Chrome")
  });

  sock.ev.on("creds.update", saveCreds);

  if (!state.creds.registered){
    const num = (process.env.PHONE_NUMBER || "910000000000").replace(/\D/g,"");
    console.log("NUMBER: " + num);
    setTimeout(async()=>{
      try{
        const code = await sock.requestPairingCode(num);
        console.log("\n\n PAIRING CODE: " + code + " \n\n");
      }catch(e){ console.log(e.message); }
    }, 3000);
  }

  sock.ev.on("connection.update", ({connection, lastDisconnect})=>{
    if(connection==="open") console.log("CONNECTED");
    if(connection==="close" && lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut){
      startBot();
    }
  });

  sock.ev.on("messages.upsert", async({messages})=>{
    const msg = messages[0];
    if(!msg?.message) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    if(text === ".ping"){
      await sock.sendMessage(msg.key.remoteJid, {text: "pong"}, {quoted: msg});
    }
    if(text === ".help"){
      await sock.sendMessage(msg.key.remoteJid, {text: "Bot ON hai\n.ping"}, {quoted: msg});
    }
  });
}
startBot();
