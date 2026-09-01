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

  const prefix = process.env.PREFIX || '.'
  const mode = (process.env.MODE || 'public').toLowerCase()
  const owner = (process.env.OWNER_NUMBER || '919229681078').replace(/[^0-9]/g, '')

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
      console.log('DOST BOT ULTRA ON 🔥')
      console.log(`PREFIX: ${prefix} | MODE: ${mode}`)
    }
  })

  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const sender = isGroup? msg.key.participant : from
    const senderNum = sender.replace(/[^0-9]/g, '')

    // MODE check - private me sirf owner sunega
    if (mode === 'private' &&!senderNum.includes(owner) &&!msg.key.fromMe) return
    if (msg.key.fromMe) return

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''

    // Bina prefix wala - hi
    if (text.toLowerCase() === 'hi') {
      await sock.sendMessage(from, { text: 'Hello jaan! Dost bot online hai ❤️' })
    }

    // Prefix wala check
    if (!text.startsWith(prefix)) return

    const args = text.slice(prefix.length).trim()
    const cmd = args.split(' ')[0].toLowerCase()
    const q = args.slice(cmd.length).trim()

    if (cmd === 'ping') {
      await sock.sendMessage(from, { text: `Pong! ${Date.now()}ms 🔥\nPrefix: ${prefix} | Mode: ${mode}` })
    }
    if (cmd === 'menu') {
      await sock.sendMessage(from, { text: `*DOST BOT MENU*\n\n${prefix}ping - check bot\n${prefix}owner - owner info\n${prefix}alive - bot alive?\n\nhi - bina prefix ke bhi chalega` })
    }
    if (cmd === 'alive') {
      await sock.sendMessage(from, { text: 'Bot zinda hai jaan 🔥' })
    }
    if (cmd === 'owner') {
      await sock.sendMessage(from, { text: `Owner: wa.me/${owner}` })
    }
  })
}
startBot()    }
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
