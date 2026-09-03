const{default:makeWASocket,useMultiFileAuthState,DisconnectReason,downloadMediaMessage}=require("@whiskeysockets/baileys");
const P=require("pino");
const sharp=require("sharp");
const axios=require("axios");
const fs=require("fs");
const PREFIX=".";
const START_TIME=Date.now();
const OWNER=(process.env.OWNER_NUMBER||"919999999999").replace(/\D/g,"");
let BOT_ACTIVE=true;
let CUSTOM_CMDS={};
if(fs.existsSync("./custom.json")){try{CUSTOM_CMDS=JSON.parse(fs.readFileSync("./custom.json"));}catch{CUSTOM_CMDS={};}}
function saveCustom(){fs.writeFileSync("./custom.json",JSON.stringify(CUSTOM_CMDS,null,2));}
function isOwner(msg){const n=(msg.key.participant||msg.key.remoteJid||"").split("@")[0].replace(/\D/g,"");return n===OWNER;}
function uptime(){const s=Math.floor((Date.now()-START_TIME)/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;return`${h}h ${m}m ${sec}s`;}
async function startBot(){
const{state,saveCreds}=await useMultiFileAuthState("auth");
const sock=makeWASocket({auth:state,logger:P({level:"silent"}),printQRInTerminal:false});
sock.ev.on("creds.update",saveCreds);
if(!state.creds.registered){
const phone=process.env.PHONE_NUMBER;
if(phone)setTimeout(async()=>{try{const code=await sock.requestPairingCode(phone.replace(/\D/g,""));console.log("PAIRING CODE:",code);}catch(e){console.log("PAIRING ERROR:",e.message);}},3000);
else console.log("PHONE_NUMBER environment variable missing.");
}
sock.ev.on("connection.update",u=>{
if(u.connection==="open")console.log("DOST-ULTRA ONLINE");
if(u.connection==="close"&&u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut)setTimeout(startBot,3000);
});
sock.ev.on("messages.upsert",async({messages})=>{
const msg=messages?.[0];
if(!msg?.message||msg.key.fromMe)return;
const jid=msg.key.remoteJid;
if(!jid)return;
const isGroup=jid.endsWith("@g.us");
const text=msg.message.conversation||msg.message.extendedTextMessage?.text||msg.message.imageMessage?.caption||msg.message.videoMessage?.caption||"";
if(!text||!text.trim().startsWith(PREFIX))return;
const parts=text.trim().slice(PREFIX.length).split(/\s+/);
const command=(parts.shift()||"").toLowerCase();
const query=parts.join(" ");
try{
if(command==="on"||command==="off"){
if(!isOwner(msg))return sock.sendMessage(jid,{text:"❌ Owner only."});
BOT_ACTIVE=command==="on";
return sock.sendMessage(jid,{text:BOT_ACTIVE?"🟢 BOT ON":"🔴 BOT OFF"});
}
if(!BOT_ACTIVE)return;
if(command==="owner")return sock.sendMessage(jid,{text:`👑 OWNER\n\n@${OWNER}`,mentions:[`${OWNER}@s.whatsapp.net`]});
if(command==="ping")return sock.sendMessage(jid,{text:"🏓 Pong!"});
if(command==="alive"||command==="bot")return sock.sendMessage(jid,{text:`╭〔 DOST-ULTRA 〕\n├ Status: ${BOT_ACTIVE?"🟢 ONLINE":"🔴 OFFLINE"}\n├ Uptime: ${uptime()}\n├ Prefix: ${PREFIX}\n╰────────────`});
if(command==="uptime")return sock.sendMessage(jid,{text:`⏱️ Uptime: ${uptime()}`});
if(command==="addcmd"){
if(!isOwner(msg))return sock.sendMessage(jid,{text:"❌ Owner only."});
const name=parts.shift()?.toLowerCase(),reply=parts.join(" ");
if(!name||!reply)return sock.sendMessage(jid,{text:".addcmd hello | Hello 👋"});
CUSTOM_CMDS[name]=reply;saveCustom();
return sock.sendMessage(jid,{text:`✅ .${name} added`});
}
if(command==="delcmd"){
if(!isOwner(msg))return sock.sendMessage(jid,{text:"❌ Owner only."});
const name=parts[0]?.toLowerCase();
if(!name||!CUSTOM_CMDS[name])return sock.sendMessage(jid,{text:"❌ Command not found."});
delete CUSTOM_CMDS[name];saveCustom();
return sock.sendMessage(jid,{text:`🗑️ .${name} deleted`});
}
if(command==="listcmd"){
const list=Object.keys(CUSTOM_CMDS);
return sock.sendMessage(jid,{text:list.length?`╭〔 CUSTOM COMMANDS 〕\n${list.map(x=>`├ .${x}`).join("\n")}\n╰────────────`:"❌ No custom commands."});
}
if(command==="editcmd"){
if(!isOwner(msg))return sock.sendMessage(jid,{text:"❌ Owner only."});
const name=parts.shift()?.toLowerCase(),reply=parts.join(" ");
if(!name||!reply||!CUSTOM_CMDS[name])return sock.sendMessage(jid,{text:".editcmd hello New reply"});
CUSTOM_CMDS[name]=reply;saveCustom();
return sock.sendMessage(jid,{text:`✏️ .${name} updated`});
}
if(CUSTOM_CMDS[command])return sock.sendMessage(jid,{text:CUSTOM_CMDS[command]});
if(command==="help"||command==="menu"){
const customList=Object.keys(CUSTOM_CMDS).length?Object.keys(CUSTOM_CMDS).map(x=>`⬡ ${x}`).join("\n"):"⬡ No custom commands";
const ms=Date.now()-START_TIME,hrs=Math.floor(ms/3600000),mins=Math.floor(ms%3600000/60000);
const menuText=`╭┈───〔 DOST-ULTRA 〕┈───⊷
├✦ Owner: nexxxr
├✦ Total: 100+ Commands
├✦ Runtime: ${hrs}h ${mins}m
├✦ Prefix: .
├✦ Mode: public
├✦ Status: ${BOT_ACTIVE?"ON 🟢":"OFF 🔴"}
╰───────────────────⊷

『 DOWNLOADER - 20 』
⬡ ytmp3, ytmp4, song, video, play
⬡ fb, fb2, insta, ig2, tiktok, tt2
⬡ mediafire, gdrive, apk, apk2, pinterest
⬡ yts, spotify, soundcloud, threads

『 MEDIA - 18 』
⬡ sticker, s, photo, toimg, tovideo
⬡ crop, cut, circle, blur, mirror
⬡ rotate, flip, invert, caption, text
⬡ emojimix, tourl, remini, upscale, hd

『 WHATSAPP GROUP - 20 』
⬡ tagall, hidetag, admins, groupinfo
⬡ link, invite, revoke, join, leave
⬡ kick, add, promote, demote
⬡ setname, setdesc, setpp, open, close
⬡ kickall, dispoff, dispon

『 FUN - 22 』
⬡ roast, insult, joke, meme, fact
⬡ shayari, quote, love, truth, dare
⬡ ship, couple, 8ball, dice, coin
⬡ simi, chatbot, afk, slaps, hug
⬡ kiss, cuddle, crush, compatibility

『 AI / TOOLS - 15 』
⬡ gpt, ai, gemini, bing, dalle
⬡ imagine, flux, remini, upscale
⬡ translate, trt, calc, weather
⬡ shorturl, qr, ssweb, toaudio

『 OWNER ONLY - 15 』
⬡ on, off, bot, ban, unban
⬡ sudo, delsudo, listsudo
⬡ mode, public, private, restart
⬡ update, broadcast, bcgroup, del

『 CUSTOM SETUP - 4 』
⬡ addcmd, delcmd, listcmd, editcmd
${customList}

╭───────────────
│ Type .help <cmd> for details
╰───────────────────`;
return sock.sendMessage(jid,{text:menuText});
}
const groupCommands=["tagall","hidetag","admins","groupinfo","link","invite","revoke","leave","kick","add","promote","demote","setname","setdesc","setpp","open","close","kickall","dispoff","dispon"];
if(!isGroup&&groupCommands.includes(command))return sock.sendMessage(jid,{text:"❌ Ye command group me use karo."});
if(command==="tagall"||command==="hidetag"){
const meta=await sock.groupMetadata(jid),mentions=meta.participants.map(p=>p.id);
const txt=command==="tagall"?"*📢 TAG ALL*\n\n"+meta.participants.map(p=>`@${p.id.split("@")[0]}`).join(" "):query||"📢 Announcement";
return sock.sendMessage(jid,{text:txt,mentions});
}
if(command==="admins"){
const meta=await sock.groupMetadata(jid);
const admins=meta.participants.filter(p=>p.admin==="admin"||p.admin==="superadmin");
return sock.sendMessage(jid,{text:`👑 GROUP ADMINS\n\n${admins.map(p=>`@${p.id.split("@")[0]}`).join("\n")}`,mentions:admins.map(p=>p.id)});
}
if(command==="groupinfo"){
const meta=await sock.groupMetadata(jid);
return sock.sendMessage(jid,{text:`╭〔 GROUP INFO 〕\n├ Name: ${meta.subject}\n├ Members: ${meta.participants.length}\n├ ID: ${jid}\n╰────────────`});
}
if(command==="link"||command==="invite"){
try{const code=await sock.groupInviteCode(jid);return sock.sendMessage(jid,{text:`🔗 Group Link:\nhttps://chat.whatsapp.com/${code}`});}catch{return sock.sendMessage(jid,{text:"❌ Bot ko admin permission chahiye."});}
}
if(command==="revoke"){
try{await sock.groupRevokeInvite(jid);return sock.sendMessage(jid,{text:"✅ Group invite link revoked."});}catch{return sock.sendMessage(jid,{text:"❌ Bot admin nahi hai."});}
}
if(command==="open"||command==="close"){
try{await sock.groupSettingUpdate(jid,command==="open"?"not_announcement":"announcement");return sock.sendMessage(jid,{text:command==="open"?"🔓 Group opened.":"🔒 Group closed."});}catch{return sock.sendMessage(jid,{text:"❌ Bot ko admin permission chahiye."});}
}
if(command==="setname"){
if(!query)return sock.sendMessage(jid,{text:".setname New Group Name"});
try{await sock.groupUpdateSubject(jid,query);return sock.sendMessage(jid,{text:"✅ Group name updated."});}catch{return sock.sendMessage(jid,{text:"❌ Bot admin nahi hai."});}
}
if(command==="setdesc"){
if(!query)return sock.sendMessage(jid,{text:".setdesc New description"});
try{await sock.groupUpdateDescription(jid,query);return sock.sendMessage(jid,{text:"✅ Description updated."});}catch{return sock.sendMessage(jid,{text:"❌ Bot admin nahi hai."});}
}
if(command==="sticker"||command==="s"){
const ctx=msg.message.extendedTextMessage?.contextInfo,q=ctx?.quotedMessage;
if(!q?.imageMessage&&!msg.message.imageMessage)return sock.sendMessage(jid,{text:"📸 Image ko reply karke .sticker bhejo."});
const mediaMsg=q?{key:{remoteJid:jid,id:ctx.stanzaId,participant:ctx.participant},message:q}:msg;
const buf=await downloadMediaMessage(mediaMsg,"buffer",{},{logger:P({level:"silent"}),reuploadRequest:sock.updateMediaMessage});
const webp=await sharp(buf).resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).webp().toBuffer();
return sock.sendMessage(jid,{sticker:webp});
}
if(command==="joke"){
const jokes=["Teacher: Homework kaha hai? Student: Sir, network issue tha 😭","Phone 1%: Ab asli relationship test hota hai 😂","Mummy: Phone chhod do. Me: Bas 5 minute. Also me: 2 hours later 💀"];
return sock.sendMessage(jid,{text:jokes[Math.floor(Math.random()*jokes.length)]});
}
if(command==="fact"){
const facts=["Octopus ke teen hearts hote hain.","Honey bahut lambe time tak preserve ho sakta hai.","Banana botanical sense me berry hai."];
return sock.sendMessage(jid,{text:"🧠 "+facts[Math.floor(Math.random()*facts.length)]});
}
if(command==="shayari"){
const data=["✨ Muskurate raho, zindagi khud khoobsurat lagne lagegi.","🌙 Raat chhoti hai, khwab bade rakho.","❤️ Dil saaf ho to alfaaz kam bhi kaafi hote hain."];
return sock.sendMessage(jid,{text:data[Math.floor(Math.random()*data.length)]});
}
if(command==="quote")return sock.sendMessage(jid,{text:"💫 Believe in yourself and keep moving forward."});
if(command==="dice")return sock.sendMessage(jid,{text:`🎲 ${Math.floor(Math.random()*6)+1}`});
if(command==="coin")return sock.sendMessage(jid,{text:Math.random()<.5?"🪙 HEAD":"🪙 TAIL"});
if(command==="8ball"){
if(!query)return sock.sendMessage(jid,{text:".8ball Will I win?"});
const answers=["🎱 Yes.","🎱 Definitely.","🎱 Maybe.","🎱 Ask again later.","🎱 Probably not."];
return sock.sendMessage(jid,{text:answers[Math.floor(Math.random()*answers.length)]});
}
if(command==="calc"){
if(!query)return sock.sendMessage(jid,{text:".calc 25*4"});
if(!/^[0-9+\-*/().%\\s]+$/.test(query))return sock.sendMessage(jid,{text:"❌ Invalid calculation."});
try{const result=Function(`"use strict";return (${query})`)();return sock.sendMessage(jid,{text:`🧮 ${query} = ${result}`});}catch{return sock.sendMessage(jid,{text:"❌ Calculation error."});}
}
async function ytdl(type,url){
await sock.sendMessage(jid,{text:`⏳ Downloading ${type}...`});
try{
let api=`https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(url)}`;
if(type==="video")api=`https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(url)}`;
const{data}=await axios.get(api,{timeout:30000});
const dlUrl=data?.url||data?.result||data?.download||data?.data?.url;
if(!dlUrl)throw new Error("Download URL nahi mila.");
if(type==="audio")return sock.sendMessage(jid,{audio:{url:dlUrl},mimetype:"audio/mpeg"},{quoted:msg});
return sock.sendMessage(jid,{video:{url:dlUrl},caption:"*DOST-ULTRA YT*"},{quoted:msg});
}catch{return sock.sendMessage(jid,{text:"❌ Download fail.\nDirect YouTube link try karo."});}
}
if(command==="ytmp3"||command==="yta"){
if(!query)return sock.sendMessage(jid,{text:".ytmp3 <youtube link>"});
return ytdl("audio",query);
}
if(command==="ytmp4"||command==="ytv"){
if(!query)return sock.sendMessage(jid,{text:".ytmp4 <youtube link>"});
return ytdl("video",query);
}
if(command==="song"||command==="play"||command==="video"){
if(!query)return sock.sendMessage(jid,{text:".song Kesariya"});
try{
await sock.sendMessage(jid,{text:`🔍 Searching ${query}...`});
const{data}=await axios.get(`https://api.ryzendesu.vip/api/search/youtube?query=${encodeURIComponent(query)}`,{timeout:30000});
const video=data?.[0]||data?.result?.[0]||data?.data?.[0];
if(!video)throw new Error("No result");
const id=video.id||video.videoId;
if(!id)throw new Error("Video ID missing");
return ytdl(command==="video"?"video":"audio",`https://youtube.com/watch?v=${id}`);
}catch{return sock.sendMessage(jid,{text:"❌ Search fail. Direct YouTube link use karo."});}
}
if(command==="fb"||command==="facebook"){
if(!query)return sock.sendMessage(jid,{text:".fb <link>"});
try{
await sock.sendMessage(jid,{text:"⏳ FB downloading..."});
const{data}=await axios.get(`https://api.ryzendesu.vip/api/downloader/fb?url=${encodeURIComponent(query)}`,{timeout:30000});
const url=data?.data?.[0]?.url||data?.url||data?.result;
if(!url)throw new Error();
return sock.sendMessage(jid,{video:{url},caption:"FB - DOST"},{quoted:msg});
}catch{return sock.sendMessage(jid,{text:"❌ Facebook download fail."});}
}
if(command==="insta"||command==="ig"){
if(!query)return sock.sendMessage(jid,{text:".insta <link>"});
try{
await sock.sendMessage(jid,{text:"⏳ Instagram downloading..."});
const{data}=await axios.get(`https://api.ryzendesu.vip/api/downloader/igdl?url=${encodeURIComponent(query)}`,{timeout:30000});
const url=data?.data?.[0]?.url||data?.url||data?.result;
if(!url)throw new Error();
return sock.sendMessage(jid,{video:{url},caption:"Instagram - DOST"},{quoted:msg});
}catch{return sock.sendMessage(jid,{text:"❌ Instagram download fail."});}
}
if(command==="tiktok"||command==="tt"){
if(!query)return sock.sendMessage(jid,{text:".tiktok <link>"});
try{
await sock.sendMessage(jid,{text:"⏳ TikTok downloading..."});
const{data}=await axios.get(`https://api.ryzendesu.vip/api/downloader/tiktok?url=${encodeURIComponent(query)}`,{timeout:30000});
const url=data?.data?.play||data?.url||data?.result?.play;
if(!url)throw new Error();
return sock.sendMessage(jid,{video:{url},caption:"TikTok - DOST"},{quoted:msg});
}catch{return sock.sendMessage(jid,{text:"❌ TikTok download fail."});}
}
const known=new Set(["fb2","ig2","tt2","mediafire","gdrive","apk","apk2","pinterest","yts","spotify","soundcloud","threads","photo","toimg","tovideo","crop","cut","circle","blur","mirror","rotate","flip","invert","caption","text","emojimix","tourl","remini","upscale","hd","kick","add","promote","demote","setpp","kickall","dispoff","dispon","roast","insult","meme","love","truth","dare","ship","couple","simi","chatbot","afk","slaps","hug","kiss","cuddle","crush","compatibility","gpt","ai","gemini","bing","dalle","imagine","flux","translate","trt","weather","shorturl","qr","ssweb","toaudio","ban","unban","sudo","delsudo","listsudo","mode","public","private","restart","update","broadcast","bcgroup","del","join","leave"]);
if(known.has(command))return sock.sendMessage(jid,{text:`⚠️ .${command} ka handler abhi configured nahi hai.`});
}catch(e){
console.log("ERROR:",e.message);
await sock.sendMessage(jid,{text:"❌ Command process nahi ho paya."}).catch(()=>{});
}
});
}
startBot().catch(console.error);
