const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const PREFIX = process.env.PREFIX || '.';
const OWNER = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const PHONE = String(process.env.PHONE_NUMBER || '').replace(/\D/g, '');
const BOT_NAME = process.env.BOT_NAME || 'DOST-ULTRA';
const START_TIME = Date.now();
const DATA = path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
const stateFile = path.join(DATA, 'state.json');
let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : { enabled: true, mode: 'public', custom: {} };
const saveState = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

const menu = `╭┈───〔 ${BOT_NAME} 〕┈───⊷\n├✦ Owner: ${OWNER || 'OWNER'}\n├✦ Prefix: ${PREFIX}\n├✦ Mode: ${state.mode}\n├✦ Status: ${state.enabled ? '🟢 ON' : '🔴 OFF'}\n╰───────────────────⊷\n\n『 DOWNLOADER 』\n⬡ ytmp3, ytmp4, song, video, fb, insta, tiktok, mediafire\n\n『 MEDIA 』\n⬡ sticker, photo, toimg, tovideo, crop, caption, blur, mirror, rotate, gif\n\n『 WHATSAPP 』\n⬡ dp, mydp, tagall, admins, groupinfo, link, kick, add, promote, demote\n\n『 FUN 』\n⬡ roast, joke, meme, fact, shayari, quote, ship, 8ball, dice, coin\n\n『 AI / TOOLS 』\n⬡ gpt, ai, dalle, imagine, remini, upscale, translate\n\n『 BOT 』\n⬡ help, ping, alive, owner, uptime\n\n『 OWNER 』\n⬡ on, off, addcmd, delcmd, listcmd, mode, broadcast`;

function jidNum(jid='') { return jid.split('@')[0].split(':')[0].replace(/\D/g,''); }
function isOwner(m) { return !!OWNER && jidNum(m.key.participant || m.key.remoteJid) === OWNER; }
function textOf(m) { return m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || ''; }
function quoted(m) { return m.message?.extendedTextMessage?.contextInfo?.quotedMessage; }
function mentioned(m) { return m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []; }
function uptime() { let s=Math.floor((Date.now()-START_TIME)/1000); const d=Math.floor(s/86400); s%=86400; const h=Math.floor(s/3600); s%=3600; const mi=Math.floor(s/60); s%=60; return `${d}d ${h}h ${mi}m ${s}s`; }
async function reply(sock,jid,text,m) { return sock.sendMessage(jid,{text},{quoted:m}); }
function targetJid(m,args=[]) { return mentioned(m)[0] || (args[0] && args[0].includes('@') ? args[0].replace(/\D/g,'')+'@s.whatsapp.net' : null); }
async function isGroupAdmin(sock,jid,user) { try { const md=await sock.groupMetadata(jid); const p=md.participants.find(x=>x.id===user); return !!p && ['admin','superadmin'].includes(p.admin); } catch { return false; } }
async function botIsAdmin(sock,jid) { return isGroupAdmin(sock,jid,sock.user.id); }
async function mediaBuffer(m) { return downloadMediaMessage(m,'buffer',{}, { logger:P({level:'silent'}), reuploadRequest: async msg => msg }); }
async function getImage(m) {
  if (m.message?.imageMessage) return mediaBuffer(m);
  const q=quoted(m); if(q?.imageMessage) return mediaBuffer({message:q,key:{remoteJid:m.key.remoteJid,fromMe:false,id:'quoted'}});
  return null;
}
async function makeSticker(sock,jid,m) { const b=await getImage(m); if(!b) return reply(sock,jid,`🖼️ Image bhejo/reply karo with ${PREFIX}sticker`,m); const out=await sharp(b).resize({width:512,height:512,fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:80}).toBuffer(); return sock.sendMessage(jid,{sticker:out},{quoted:m}); }
async function imageTransform(sock,jid,m,op,arg='') { const b=await getImage(m); if(!b) return reply(sock,jid,'🖼️ Image bhejo ya image ko reply karo.',m); let p=sharp(b); if(op==='crop') p=p.resize(512,512,{fit:'cover'}); if(op==='blur') p=p.blur(8); if(op==='mirror') p=p.flop(); if(op==='rotate') p=p.rotate(Number(arg)||90); if(op==='upscale') p=p.resize({width:1024,withoutEnlargement:false}); const out=await p.jpeg({quality:90}).toBuffer(); return sock.sendMessage(jid,{image:out},{quoted:m}); }
async function ai(prompt) { if(!process.env.AI_API_URL) return null; const headers=process.env.AI_API_KEY?{Authorization:`Bearer ${process.env.AI_API_KEY}`}:{ }; const r=await axios.post(process.env.AI_API_URL,{prompt},{headers,timeout:30000}); return r.data?.text || r.data?.reply || r.data?.response || r.data?.content || JSON.stringify(r.data); }
function fun(cmd,args) { const lists={joke:['Why did the computer go to the doctor? It had a virus.','I told my Wi-Fi a joke. No connection.'],fact:['Octopuses have three hearts.','Bananas are berries botanically.'],quote:['Small steps still move you forward.','Consistency beats waiting for motivation.'],shayari:['Khamosh raaste bhi manzil ka pata dete hain.','Muskurahat chhoti si, par asar bada karti hai.']}; if(lists[cmd]) return lists[cmd][Math.floor(Math.random()*lists[cmd].length)]; if(cmd==='dice') return `🎲 ${1+Math.floor(Math.random()*6)}`; if(cmd==='coin') return Math.random()<.5?'🪙 Heads':'🪙 Tails'; if(cmd==='8ball') return ['🎱 Yes','🎱 No','🎱 Maybe','🎱 Definitely'][Math.floor(Math.random()*4)]; if(cmd==='meme') return '😂 Meme: Jab bot finally command samajh jaye.'; if(cmd==='roast') return '🔥 Roast: Itna slow reply to calculator bhi nahi karta 😭'; return null; }

async function start() {
  const { state: authState, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  let version; try { version=(await fetchLatestBaileysVersion()).version; } catch {}
  const sock=makeWASocket({ auth:authState, version, browser:Browsers.ubuntu(BOT_NAME), logger:P({level:'silent'}), printQRInTerminal:false, markOnlineOnConnect:false });
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update', async ({connection,lastDisconnect,qr})=>{
    if(qr){ console.log('\nPAIRING/QR AVAILABLE'); qrcode.generate(qr,{small:true}); }
    if(connection==='open') console.log(`✅ ${BOT_NAME} connected`);
    if(connection==='close'){ const code=new Boom(lastDisconnect?.error)?.output?.statusCode; if(code!==DisconnectReason.loggedOut) setTimeout(start,3000); else console.log('❌ Logged out. Delete auth_info_baileys and pair again.'); }
    if(!authState.creds.registered && PHONE){ try { const code=await sock.requestPairingCode(PHONE); console.log('PAIRING CODE:',code); } catch(e){ console.log('Pairing error:',e.message); } }
  });
  sock.ev.on('messages.upsert', async ({messages})=>{
    const m=messages[0]; if(!m?.message || m.key.fromMe) return;
    const jid=m.key.remoteJid; if(!jid || jid==='status@broadcast') return;
    const body=textOf(m).trim(); if(!body.startsWith(PREFIX)) return;
    const raw=body.slice(PREFIX.length).trim(); const [cmd0,...args]=raw.split(/\s+/); const cmd=(cmd0||'').toLowerCase();
    if(!state.enabled && !isOwner(m)) return;
    if(state.mode==='private' && !isOwner(m)) return;
    try {
      if(state.custom[cmd] && !['addcmd','delcmd','listcmd'].includes(cmd)) return reply(sock,jid,state.custom[cmd],m);
      if(cmd==='help') return reply(sock,jid,menu,m);
      if(cmd==='ping') return reply(sock,jid,'🏓 Pong!',m);
      if(cmd==='alive') return reply(sock,jid,`🟢 ${BOT_NAME} is alive\nUptime: ${uptime()}`,m);
      if(cmd==='uptime') return reply(sock,jid,`⏱️ ${uptime()}`,m);
      if(cmd==='owner') return reply(sock,jid,`👑 Owner: ${OWNER||'OWNER'}`,m);
      if(cmd==='sticker') return makeSticker(sock,jid,m);
      if(['crop','blur','mirror','rotate','upscale'].includes(cmd)) return imageTransform(sock,jid,m,cmd,args[0]);
      if(cmd==='toimg') { const q=quoted(m); if(!q?.stickerMessage) return reply(sock,jid,'Reply to a sticker with .toimg',m); const b=await mediaBuffer({message:q,key:{remoteJid:jid,fromMe:false,id:'quoted'}}); return sock.sendMessage(jid,{image:b},{quoted:m}); }
      if(cmd==='photo') return imageTransform(sock,jid,m,'upscale');
      if(['tovideo','gif','caption'].includes(cmd)) return reply(sock,jid,`⚠️ .${cmd} requires FFmpeg/media conversion pipeline in a future module.`,m);
      if(['joke','meme','fact','shayari','quote','dice','coin','8ball','roast'].includes(cmd)) return reply(sock,jid,fun(cmd,args),m);
      if(cmd==='ship') return reply(sock,jid,`💞 Compatibility: ${Math.floor(Math.random()*101)}%`,m);
      if(['gpt','ai'].includes(cmd)) { const r=await ai(args.join(' ')); return reply(sock,jid,r||'⚠️ AI API configure karo: AI_API_URL + AI_API_KEY (if required).',m); }
      if(cmd==='translate') return reply(sock,jid,'ℹ️ Usage: .translate <text> — configure an AI API in AI_API_URL for translation.',m);
      if(['dalle','imagine','remini'].includes(cmd)) return reply(sock,jid,`⚠️ .${cmd} needs an image-generation/editing API. Configure your provider endpoint first.`,m);
      if(['ytmp3','ytmp4','song','video','fb','insta','tiktok','mediafire'].includes(cmd)) return reply(sock,jid,`⚠️ .${cmd} is not enabled without a dedicated download API. I won't fake a successful download.`,m);
      if(['dp','mydp'].includes(cmd)) { const target=targetJid(m,args)||jid; try { const u=await sock.profilePictureUrl(target,'image'); return sock.sendMessage(jid,{image:{url:u},caption:'🖼️ Profile picture'},{quoted:m}); } catch { return reply(sock,jid,'❌ Profile photo unavailable/privacy restricted.',m); } }
      if(['tagall','admins','groupinfo','link','kick','add','promote','demote'].includes(cmd)) {
        if(!jid.endsWith('@g.us')) return reply(sock,jid,'❌ Ye command group me use karo.',m);
        const md=await sock.groupMetadata(jid);
        if(cmd==='groupinfo') return reply(sock,jid,`👥 ${md.subject}\nMembers: ${md.participants.length}\nCreated: ${md.creation?new Date(md.creation*1000).toLocaleString():'N/A'}`,m);
        if(cmd==='admins') { const a=md.participants.filter(p=>p.admin).map(p=>'@'+jidNum(p.id)); return sock.sendMessage(jid,{text:`👑 Admins:\n${a.join('\n')}`,mentions:md.participants.filter(p=>p.admin).map(p=>p.id)},{quoted:m}); }
        if(cmd==='tagall') { const ms=md.participants.map(p=>p.id); return sock.sendMessage(jid,{text:ms.map(x=>'@'+jidNum(x)).join(' '),mentions:ms},{quoted:m}); }
        if(!isOwner(m) && !(await isGroupAdmin(sock,jid,m.key.participant||m.key.remoteJid))) return reply(sock,jid,'❌ Admin only.',m);
        if(!await botIsAdmin(sock,jid)) return reply(sock,jid,'❌ Bot ko group admin banao.',m);
        const t=targetJid(m,args); if(['kick','add','promote','demote'].includes(cmd)&&!t) return reply(sock,jid,`Usage: .${cmd} @user`,m);
        if(cmd==='link') { const code=await sock.groupInviteCode(jid); return reply(sock,jid,`https://chat.whatsapp.com/${code}`,m); }
        if(cmd==='kick') return sock.groupParticipantsUpdate(jid,[t],'remove').then(()=>reply(sock,jid,'✅ Removed',m));
        if(cmd==='add') return sock.groupParticipantsUpdate(jid,[t],'add').then(()=>reply(sock,jid,'✅ Added',m));
        if(cmd==='promote') return sock.groupParticipantsUpdate(jid,[t],'promote').then(()=>reply(sock,jid,'✅ Promoted',m));
        if(cmd==='demote') return sock.groupParticipantsUpdate(jid,[t],'demote').then(()=>reply(sock,jid,'✅ Demoted',m));
      }
      if(['on','off','addcmd','delcmd','listcmd','mode','broadcast'].includes(cmd)) {
        if(!isOwner(m)) return reply(sock,jid,'❌ Owner only.',m);
        if(cmd==='on'){state.enabled=true;saveState();return reply(sock,jid,'🟢 Bot ON',m)}
        if(cmd==='off'){state.enabled=false;saveState();return reply(sock,jid,'🔴 Bot OFF',m)}
        if(cmd==='mode'){const v=(args[0]||'public').toLowerCase();if(!['public','private'].includes(v))return reply(sock,jid,'Usage: .mode public/private',m);state.mode=v;saveState();return reply(sock,jid,`Mode: ${v}`,m)}
        if(cmd==='addcmd'){const sep=raw.indexOf('|');if(sep<0)return reply(sock,jid,'Usage: .addcmd hello | Hello 👋',m);const n=raw.slice(7,sep).trim().toLowerCase();const r=raw.slice(sep+1).trim();if(!n||!r)return reply(sock,jid,'Invalid addcmd.',m);state.custom[n]=r;saveState();return reply(sock,jid,`✅ Added .${n}`,m)}
        if(cmd==='delcmd'){delete state.custom[(args[0]||'').toLowerCase()];saveState();return reply(sock,jid,'✅ Deleted',m)}
        if(cmd==='listcmd')return reply(sock,jid,`🧩 Custom commands:\n${Object.keys(state.custom).map(x=>PREFIX+x).join('\n')||'None'}`,m);
        if(cmd==='broadcast'){const msg=args.join(' ');if(!msg)return reply(sock,jid,'Usage: .broadcast <message>',m);return reply(sock,jid,'⚠️ Broadcast to all chats is disabled in this starter to avoid bulk messaging/spam.',m)}
      }
    } catch(e) { console.error(e); return reply(sock,jid,`❌ Error: ${e.message}`,m); }
  });
}
start();
