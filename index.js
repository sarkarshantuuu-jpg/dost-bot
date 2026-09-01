const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const P = require('pino')

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session')
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ["Dost-Bot", "Chrome", "1.0.0"]
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== 401
            if(shouldReconnect) startBot()
        } else if(connection === 'open') {
            console.log('✅ DOST-BOT ONLINE!')
        }
    })

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0]
        if(!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim()

        if(text === '.ping'){
            await sock.sendMessage(from, { text: '🏓 Pong! Bot Active' })
        }
        if(text === '.menu'){
            await sock.sendMessage(from, { text: '*DOST-BOT MENU* 🤖\n\n.ping - Check\n.menu - Menu\n.wosb - WOSB Status' })
        }
        if(text === '.wosb'){
            await sock.sendMessage(from, { text: '✅ WOSB System Active & No Error!' })
        }
    })
}
startBot()
