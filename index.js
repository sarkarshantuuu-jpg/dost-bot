// index.js - 60 SEC FIX
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");

let pairingRequested = false;
let canRestart = true;

async function start(){
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const sock = makeWASocket({
    auth: state,
    logger: P({level:"silent"}),
    browser: ["DOST-ULTRA","Chrome","1.0"]
  });
  sock.ev.on("creds.update", saveCreds);

  if(!state.creds.registered &&!pairingRequested){
    pairingRequested = true;
    canRestart = false; // 60 sec tak restart bilkul band
    const num = process.env.PHONE_NUMBER;
    console.log("PHONE_NUMBER: "+num);

    setTimeout(async()=>{
      try{
        const cleanNum = num.replace(/\D/g,"");
        const code = await sock.requestPairingCode(cleanNum);
        console.log("================================");
        console.log("YOUR CODE: "+code);
        console.log("VALID FOR 60 SECONDS");
        console.log("================================");

        // 60 sec ke baad hi restart allow
        setTimeout(()=>{
          canRestart = true;
          console.log("60 sec over, now can restart if not linked");
        }, 60000);

      }catch(e){
        console.log("Pair fail: "+e.message);
        pairingRequested = false;
        canRestart = true;
      }
    },3000);
  }

  sock.ev.on("connection.update", (u)=>{
    const {connection, lastDisconnect} = u;
    if(connection==="open"){
      console.log("=== LINKED SUCCESS ===");
      pairingRequested = false;
      canRestart = true;
    }
    if(connection==="close"){
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log("Closed: "+statusCode);

      if(!canRestart){
        console.log("Waiting 60 sec... code still valid, not restarting");
        return;
      }

      if(statusCode===DisconnectReason.loggedOut){
        try{ fs.rmSync("./auth", {recursive:true, force:true}); }catch{}
        pairingRequested = false;
      }
      setTimeout(start, 3000);
    }
  });

  sock.ev.on("messages.upsert", async (m)=>{
    const msg=m.messages?.[0]; if(!msg||!msg.message||msg.key.fromMe) return;
    const jid=msg.key.remoteJid;
    const txt=msg.message.conversation||msg.message.extendedTextMessage?.text||"";
    if(txt.toLowerCase()===".ping") await sock.sendMessage(jid,{text:"Pong! 60 sec fix working!"});
  });
}
start();
