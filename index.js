const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys')
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
          console.log('PAIRING CODE FOR ' + phoneNumber + ': ' + code)
        } catch (e) {
          console.log('Error:', e.message)
        }
      }, 3000)
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
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || ''
    const lower = text.toLowerCase().trim()

    if (lower === 'hi') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Hello jaan! Dost bot online hai ❤️' })
    }
    if (lower === 'hello') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Hello hello! 😍' })
    }
    if (lower === 'ping') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Pong! Bot zinda hai 🔥' })
    }
    if (lower === 'alive') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Bot zinda hai jaan 🔥' })
    }
    if (lower === 'owner') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Mera owner: 919229681078 ❤️' })
    }
    if (lower === 'bot') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Haan bolo jaan? Dost bot sun raha hai 😎' })
    }
    if (lower === 'bye') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Bye bye jaan 👋' })
    }
    if (lower === 'menu') {
      await sock.sendMessage(msg.key.remoteJid, { text: '*DOST BOT MENU*\n\n1. hi - hello bolega\n2. ping - check karega\n3. alive - zinda hai?\n4. owner - owner number\n5. s - photo ko sticker banao\n6. menu - ye list\n\nSticker ke liye kisi photo pe reply karke s likho' })
    }

    // STICKER MAKER - bina prefix ke
    if (lower === 's' || lower === 'sticker') {
      try {
        let mediaMsg = null
        if (msg.message.imageMessage) {
          mediaMsg = msg
        } else {
          const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage
          if (quoted?.imageMessage) {
            mediaMsg = { message: quoted, key: msg.key }
          }
        }
        if (!mediaMsg) {
          await sock.sendMessage(msg.key.remoteJid, { text: 'Kisi photo pe reply karke s likh jaan 🖼️' })
          return
        }
        const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {})
        await sock.sendMessage(msg.key.remoteJid, { sticker: buffer })
      } catch (e) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Sticker nahi bana, fir try kar' })
      }
    }
  })
}
startBot()
