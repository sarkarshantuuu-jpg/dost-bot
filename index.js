const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const P = require("pino");
const MY_NUMBER = "919229681078";
const PREFIX = ".";

async function startBot(){
const {version} = await fetchLatestBaileysVersion();
const {state, saveCreds} = await useMultiFileAuthState("./auth");
const sock = makeWASocket({
version,
auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:"silent"}))},
logger:P({level:"silent"}),
browser:["Ubuntu","Chrome","22.04"]
});
sock.ev.on("creds.update", saveCreds);

if(!state.creds.registered){
setTimeout(async()=>{
try{
const code = await sock.requestPairingCode(MY_NUMBER);
console.log("CODE:"+code+" FOR:"+MY_NUMBER);
}catch(e){console.log(e.message);}
},7000);
}

sock.ev.on("connection.update",(u)=>{
if(u.connection==="open") console.log("CONNECTED:"+MY_NUMBER);
if(u.connection==="close"){
let r = u.lastDisconnect?.error?.output?.statusCode;
if(r!==DisconnectReason.loggedOut) setTimeout(startBot,3000);
}
});

sock.ev.on("messages.upsert",async(m)=>{
const msg=m.messages[0];
if(!msg?.message||msg.key.fromMe) return;
let text=(msg.message.conversation||msg.message.extendedTextMessage?.text||"").trim();
if(!text.startsWith(PREFIX)) return;
let cmd=text.slice(1).split(" ")[0].toLowerCase();
let jid=msg.key.remoteJid;
let reply=(t)=>sock.sendMessage(jid,{text:t},{quoted:msg});

if(cmd==="ping") return reply(`*PING*\nNumber:${MY_NUMBER}\nSpeed:${Date.now()%100}ms`);
if(cmd==="alive") return reply(`*DOST-ULTRA ALIVE*\nOwner:${MY_NUMBER}\nBot: Online\nUptime:${Math.floor(process.uptime()/60)}m`);
if(cmd==="owner") return reply(`Owner: wa.me/${MY_NUMBER}`);
if(cmd==="coin") return reply(`Coin: ${Math.random()<0.5?"Heads":"Tails"}`);
if(cmd==="dice") return reply(`Dice: ${Math.floor(Math.random()*6)+1}`);
if(cmd==="uptime") return reply(`Uptime: ${Math.floor(process.uptime()/60)} min`);
if(cmd==="roast") return reply("Tu ultra pro hai bhai 🔥");
if(cmd==="joke") return reply("Pappu: Sir homework nahi kiya\nTeacher: kyu?\nPappu: Railway ne crash kara diya 😂");
if(cmd==="shayari") return reply("Teri muskan pe duniya fida
