const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false
  })
  sock.ev.on('creds.update', saveCreds)
  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER
    if (phoneNumber) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phoneNumber)
          console.log('================================')
          console.log(`PAIRING CODE FOR ${phoneNumber}: ${code}`)
          console.log('WhatsApp > Linked Devices > Link with phone number')
          console.log('================================')
        } catch (e) {
          console.log('Error:', e.message)
        }
      }, 3000)
    } else {
      console.log('Set PHONE_NUMBER variable in Railway!')
    }
  }
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
      if (shouldReconnect) startBot()
    } else if (connection === 'open') {
      console.log('Bot Connected! Dost ready')
    }
  })
  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages[0]
    if (!msg.message || msg.key.fromMe) return
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    if (text.toLowerCase() === 'hi') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Hello jaan! Dost bot online hai ❤️' })
    }
  })
}
startBot()
