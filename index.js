const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const P = require('pino')
const http = require('http')
http.createServer((req,res)=>res.end('BOT ONLINE')).listen(process.env.PORT||3000)

async function startBot(){
const { state, saveCreds } = await useMultiFileAuthState('session')
const sock = makeWASocket({
logger: P({ level: 'silent' }),
auth: state,
browser: ["Dost","Chrome","1.0.0"]
})
sock.ev.on('creds.update', saveCreds)
sock.ev.on('connection.update', (u)=>{
const { connection, lastDisconnect, qr } = u
if(qr){
console.log('SCAN THIS QR:');
qrcode.generate(qr,{small:true})
}
if(connection==='close'){
const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
if(shouldReconnect) startBot()
} else if(connection==='open'){
console.log('BOT CONNECTED')
}
})
sock.ev.on('messages.upsert', async(m)=>{
const msg=m.messages[0];if(!msg.message||msg.key.fromMe)return
const from=msg.key.remoteJid
const t=(msg.message.conversation||msg.message.extendedTextMessage?.text||"").toLowerCase()
if(t==='.ping')await sock.sendMessage(from,{text:'Pong! Active hai bhai'})
if(t==='.menu')await sock.sendMessage(from,{text:'*MENU*\n.ping\n.menu\n.wosb'})
if(t==='.wosb')await sock.sendMessage(from,{text:'WOSB Active ✅'})
})
}
startBot()        }
        if(text === '.wosb'){
            await sock.sendMessage(from, { text: '✅ WOSB System Active & No Error!' })
        }
    })
}
startBot()
