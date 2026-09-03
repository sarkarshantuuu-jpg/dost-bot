const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const P = require("pino");

const NUMBER = "919229681078";

async function startBot(){
const { version } = await fetchLatestBaileysVersion();
const { state, saveCreds } = await useMultiFileAuthState("./auth");
const sock = makeWASocket({
version,
auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({level:"silent"})) },
logger: P({level:"silent"}),
browser: ["Chrome","Ubuntu","22.04"],
printQRInTerminal: false
});
sock.ev.on("creds.update", saveCreds);

sock.ev.on("connection.update", async (s)=>{
const { connection, lastDisconnect } = s;
if(connection === "open"){
console.log("BOT ONLINE: "+NUMBER);
}
if(connection === "close"){
let code = lastDisconnect?.error?.output?.statusCode;
if(code!== DisconnectReason.loggedOut){
console.log("Reconnect...");
setTimeout(startBot, 4000);
}
}
});

// PAIRING CODE - Socket ready hone ke baad
if(!state.creds.registered){
console.log("Waiting for socket...");
let wait = setInterval(async ()=>{
if(sock.ws && sock.ws.readyState === 1){
clearInterval(wait);
try{
let code = await sock.requestPairingCode(NUMBER);
console.log("==========================");
console.log("NUMBER: "+NUMBER);
console.log("YOUR CODE: "+code);
console.log("==========================");
console.log("WhatsApp > Linked Devices > Link with phone number > Paste code");
}catch(e){
console.log("Pair fail: "+e.message);
}
}
}, 3000);
}

sock.ev.on("messages.upsert", async (m)=>{
const msg = m.messages[0];
if(!msg?.message || msg.key.fromMe) return;
let txt = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
if(!txt.startsWith(".")) return;
let cmd = txt.slice(1).split(" ")[0].toLowerCase();
let jid = msg.key.remoteJid;
let reply = (t)=> sock.sendMessage(jid, {text:t}, {quoted:msg});
if(cmd==="ping") reply("PONG - "+NUMBER);
if(cmd==="alive") reply("DOST-ULTRA ALIVE\nNUM: "+NUMBER);
if(cmd==="help") reply("MENU for "+NUMBER+"\n.ping\nalive\ncoin\ndice\nhelp");
if(cmd==="coin") reply(Math.random()<0.5?"Heads":"Tails");
if(cmd==="dice") reply(""+(Math.floor(Math.random()*6)+1));
});
}
startBot();
