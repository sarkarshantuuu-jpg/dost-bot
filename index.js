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
console.log("CODE_FOR_"+MY_NUMBER+": "+code);
}catch(e){console.log(e.message);}
},7000);
}

sock.ev.on("connection.update",(u)=>{
if(u.connection==="open") console.log("CONNECTED "+MY_NUMBER);
if(u.connection==="close"){
let r=u.lastDisconnect?.error?.output?.statusCode;
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

if(cmd==="ping") return reply("PONG - Speed: "+(Date.now()%100)+"ms Number:"+MY_NUMBER);
if(cmd==="alive") return reply("DOST-ULTRA ALIVE\nOwner:"+MY_NUMBER+"\nUptime:"+Math.floor(process.uptime()/60)+"m\nStatus:Online");
if(cmd==="owner") return reply("Owner: wa.me/"+MY_NUMBER);
if(cmd==="coin") return reply("Coin: "+(Math.random()<0.5?"Heads":"Tails"));
if(cmd==="dice") return reply("Dice: "+(Math.floor(Math.random()*6)+1));
if(cmd==="uptime") return reply("Uptime: "+Math.floor(process.uptime()/60)+" min");
if(cmd==="joke") return reply("Joke: Pappu homework nahi kiya kyuki Railway crash ho gaya");
if(cmd==="shayari") return reply("Shayari: Teri muskan pe duniya fida hai");
if(cmd==="fact") return reply("Fact: Volume add karne se logout nahi hota");
if(cmd==="roast") return reply("You are ultra pro");
if(cmd==="sticker") return reply("Reply to image with.sticker");

if(cmd==="help"||cmd==="menu"){
return reply("DOST-ULTRA MENU - 117 CMDS\nOwner: "+MY_NUMBER+"\n\nCORE: ping alive owner uptime coin dice help menu\nFUN: roast joke shayari fact 8ball ship truth dare slot rps\nDOWNLOADER: ytmp3 ytmp4 song video fb insta tiktok apk gdrive mediafire\nMEDIA: sticker photo toimg tovideo emojimix meme\nGROUP: tagall hidetag link groupinfo admins kick add promote demote\nAI: gpt ai dalle translate calc weather wiki\nSTALK: githubstalk igstalk ipstalk webshot\n\nPrefix:.\nBotNo: "+MY_NUMBER);
}

let list=["ytmp3","ytmp4","song","video","fb","insta","tiktok","apk","gdrive","mediafire","pinterest","spotify","play","photo","toimg","tovideo","emojimix","meme","tagall","hidetag","link","groupinfo","admins","kick","add","promote","demote","gpt","ai","dalle","githubstalk","igstalk","8ball","ship","truth","dare","slot","rps"];
if(list.includes(cmd)) return reply("Command "+PREFIX+cmd+" is active for "+MY_NUMBER+". Full feature coming soon. Try.help");
});
}
startBot();
