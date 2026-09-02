const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");

let PREFIX = ".";
try{ if(fs.existsSync("./prefix.txt")) PREFIX = fs.readFileSync("./prefix.txt","utf8").trim()||"."; }catch{}
function getMenu(){ try{ if(fs.existsSync("./custom_menu.txt")) return fs.readFileSync("./custom_menu.txt","utf8"); }catch{} return null; }

async function start(){
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({
    auth: state,
    logger: P({level:"silent"}),
    browser:["DOST","Chrome","1.0"],
    printQRInTerminal: false
  });
  sock.ev.on("creds.update", saveCreds);

  // pairing code - 1 bar hi mango
  if(!state.creds.registered){
    const n = process.env.PHONE_NUMBER;
    if(n){
      setTimeout(async()=>{
        try{
          const c = await sock.requestPairingCode(n.replace(/\D/g,""));
          console.log("==================================");
          console.log("PAIRING CODE: "+c);
          console.log("Is code ko 20 sec me WhatsApp me dalo");
          console.log("WhatsApp > Linked Devices > Link with phone number");
          console.log("==================================");
        }catch(e){ console.log("Pair Error: "+e.message); }
      },5000);
    }
  }

  sock.ev.on("connection.update", (u)=>{
    const {connection, lastDisconnect} = u;
    if(connection==="open"){
      console.log("DOST ONLINE - LINKED SUCCESSFULLY PREFIX "+PREFIX);
    }
    if(connection==="close"){
      const status = lastDisconnect?.error?.output?.statusCode;
      console.log("Connection Closed - status: "+status);
      // agar logged out nahi hai to hi restart karo, warna naya code mat banao
      if(status!== DisconnectReason.loggedOut){
        setTimeout(start, 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async (m)=>{
    const msg=m.messages?.[0]; if(!msg||!msg.message||msg.key.fromMe) return;
    const jid=msg.key.remoteJid; const sender=msg.key.participant||jid;
    const txt=msg.message.conversation||msg.message.extendedTextMessage?.text||"";
    if(!txt) return; const clean=txt.trim();

    const isOwner = process.env.OWNER_NUMBER? sender.includes(process.env.OWNER_NUMBER.replace(/\D/g,"")) : true;
    let used=null;
    if(clean.startsWith(PREFIX)) used=PREFIX;
    else if(clean.startsWith(".") && ["setmenu","getmenu","delmenu","setprefix","help","menu","ping","tagall"].includes(clean.slice(1).split(" ")[0].toLowerCase())) used=".";
    else return;

    const body=clean.slice(used.length).trim();
    const cmd=body.split(" ")[0].toLowerCase();
    const after=clean.slice(used.length+cmd.length).trim();

    try{
      if(cmd==="setmenu"){ if(!isOwner) return sock.sendMessage(jid,{text:"Owner only"}); fs.writeFileSync("./custom_menu.txt", after); return sock.sendMessage(jid,{text:"Menu saved"}); }
      if(cmd==="getmenu"){ const mm=getMenu(); return sock.sendMessage(jid,{text: mm?mm.slice(0,4000):"Default menu"}); }
      if(cmd==="delmenu"){ if(fs.existsSync("./custom_menu.txt")) fs.unlinkSync("./custom_menu.txt"); return sock.sendMessage(jid,{text:"Default restored"}); }
      if(cmd==="setprefix"){ if(!isOwner) return; PREFIX=after.split(" ")[0]; fs.writeFileSync("./prefix.txt", PREFIX); return sock.sendMessage(jid,{text:"Prefix "+PREFIX}); }
      if(cmd==="help"||cmd==="menu"){
        const c=getMenu(); if(c) return sock.sendMessage(jid,{text:c.replace(/{prefix}/g,PREFIX)});
        return sock.sendMessage(jid,{text:"DOST-ULTRA ONLINE\nPrefix: "+PREFIX+"\n\n.help\n.ping\n.setmenu <text>\n.setprefix <symbol>\n.tagall"});
      }
      if(cmd==="ping") return sock.sendMessage(jid,{text:"Pong - bot working! "+PREFIX+"help"});
      if(cmd==="tagall"){
        if(!jid.endsWith("@g.us")) return;
        const meta=await sock.groupMetadata(jid); const mentions=meta.participants.map(p=>p.id);
        let t="TAG ALL\n"; for(let i=0;i<mentions.length;i++) t+=(i+1)+". @"+mentions[i].split("@")[0]+"\n";
        return sock.sendMessage(jid,{text:t,mentions});
      }
    }catch(e){ console.log(e.message); }
  });
}
start();
