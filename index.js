const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");

let PREFIX = ".";
try{ if(fs.existsSync("./prefix.txt")){ PREFIX = fs.readFileSync("./prefix.txt","utf8").trim() || "."; } }catch(e){}

function getMenu(){ try{ if(fs.existsSync("./custom_menu.txt")){ return fs.readFileSync("./custom_menu.txt","utf8"); } }catch(e){} return null; }

async function start(){
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({ auth: state, logger: P({level:"silent"}), browser: ["DOST","Chrome","1"] });
  sock.ev.on("creds.update", saveCreds);

  if(!state.creds.registered){
    const num = process.env.PHONE_NUMBER;
    if(num){ setTimeout(async()=>{ try{ const code = await sock.requestPairingCode(num.replace(/\D/g,"")); console.log("CODE: " + code); }catch(e){ console.log(e.message); } },3000); }
  }

  sock.ev.on("connection.update", (u)=>{
    if(u.connection==="open"){ console.log("DOST ONLINE PREFIX " + PREFIX); }
    if(u.connection==="close" && u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut){ setTimeout(start,3000); }
  });

  sock.ev.on("messages.upsert", async (m)=>{
    const msg = m.messages?.[0];
    if(!msg ||!msg.message || msg.key.fromMe) return;
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const txt = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    if(!txt) return;
    const clean = txt.trim();
    const isOwner = process.env.OWNER_NUMBER? sender.includes(process.env.OWNER_NUMBER.replace(/\D/g,"")) : true;

    let used = null;
    if(clean.startsWith(PREFIX)){ used = PREFIX; }
    else if(clean.startsWith(".") && clean.slice(1).toLowerCase().startsWith("setmenu")){ used = "."; }
    else if(clean.startsWith(".") && clean.slice(1).toLowerCase().startsWith("setprefix")){ used = "."; }
    else if(clean.startsWith(".") && clean.slice(1).toLowerCase().startsWith("getmenu")){ used = "."; }
    else if(clean.startsWith(".") && clean.slice(1).toLowerCase().startsWith("delmenu")){ used = "."; }
    else{ return; }

    const body = clean.slice(used.length).trim();
    const cmd = body.split(" ")[0].toLowerCase();
    const after = clean.slice(used.length + cmd.length).trim();

    if(cmd==="setmenu"){ if(!isOwner){ return sock.sendMessage(jid,{text:"Owner only"}); } fs.writeFileSync("./custom_menu.txt", after); return sock.sendMessage(jid,{text:"Menu saved"}); }
    if(cmd==="getmenu"){ const mm = getMenu(); return sock.sendMessage(jid,{text: mm? mm.slice(0,4000) : "Default"}); }
    if(cmd==="delmenu"){ if(fs.existsSync("./custom_menu.txt")){ fs.unlinkSync("./custom_menu.txt"); } return sock.sendMessage(jid,{text:"Deleted"}); }
    if(cmd==="setprefix"){ if(!isOwner) return; PREFIX = after.split(" ")[0]; fs.writeFileSync("./prefix.txt", PREFIX); return sock.sendMessage(jid,{text:"Prefix " + PREFIX}); }
    if(cmd==="help" || cmd==="menu"){
      const custom = getMenu();
      if(custom){ return sock.sendMessage(jid,{text:custom}); }
      return sock.sendMessage(jid,{text:"DOST-ULTRA\nPrefix: " + PREFIX + "\n.help,.setmenu,.setprefix,.getmenu,.delmenu"});
    }
  });
}
start();
