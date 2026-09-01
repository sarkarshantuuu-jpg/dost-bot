const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require('@whiskeysockets/baileys')

const P = require('pino')
const sharp = require('sharp')

const START_TIME = Date.now()

const PREFIX = '.'
const OWNER = process.env.OWNER_NUMBER || '919999999999'

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  // =========================
  // PAIRING CODE
  // =========================

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
          console.log('Pairing Error:', e.message)
        }
      }, 3000)
    } else {
      console.log('Set PHONE_NUMBER environment variable!')
    }
  }

  // =========================
  // CONNECTION
  // =========================

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect } = update

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      if (shouldReconnect) {
        console.log('Reconnecting...')
        startBot()
      }
    }

    if (connection === 'open') {
      console.log('✅ Bot Connected! Dost ready 😎')
    }
  })

  // =========================
  // MESSAGES
  // =========================

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]

    if (!msg?.message || msg.key.fromMe) return

    const jid = msg.key.remoteJid

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    // HI
    if (text.trim().toLowerCase() === 'hi') {
      await sock.sendMessage(jid, {
        text: 'Hello jaan! Dost bot online hai ❤️'
      })
      return
    }

    // Only commands beginning with .
    if (!text.trim().startsWith(PREFIX)) return

    const parts = text.trim().slice(PREFIX.length).split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)

    try {

      // =========================
      // HELP
      // =========================

      if (command === 'help') {
        await sock.sendMessage(jid, {
          text:
`🤖 *DOST BOT*

🛠️ MEDIA
.sticker
.photo
.toimg
.tovideo
.crop
.caption <text>
.blur
.mirror
.rotate
.gif

👤 WHATSAPP
.dp
.mydp
.tagall
.admins
.groupinfo
.link

😂 FUN
.roast
.joke
.meme
.fact
.shayari
.quote
.ship
.8ball <question>
.dice
.coin

🤖 BOT
.help
.ping
.alive
.owner
.uptime`
        })
        return
      }

      // =========================
      // PING
      // =========================

      if (command === 'ping') {
        await sock.sendMessage(jid, {
          text: '🏓 Pong!'
        })
        return
      }

      // =========================
      // ALIVE
      //
