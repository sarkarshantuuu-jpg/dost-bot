const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require('@whiskeysockets/baileys')

const P = require('pino')
const sharp = require('sharp')
const fs = require('fs')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  // Pairing
  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER

    if (phoneNumber) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phoneNumber)

          console.log('================================')
          console.log('PAIRING CODE:', code)
          console.log('WhatsApp > Linked Devices > Link with phone number')
          console.log('================================')
        } catch (e) {
          console.log('Pairing Error:', e.message)
        }
      }, 3000)
    } else {
      console.log('PHONE_NUMBER environment variable missing!')
    }
  }

  // Connection
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) {
        console.log('Reconnecting...')
        startBot()
      }
    }

    if (connection === 'open') {
      console.log('✅ Bot Connected! Dost ready 😎')
    }
  })

  // Messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]

    if (!msg || !msg.message || msg.key.fromMe) return

    const jid = msg.key.remoteJid

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    const command = text.trim().split(/\s+/)[0].toLowerCase()

    try {

      // HI
      if (text.trim().toLowerCase() === 'hi') {
        await sock.sendMessage(jid, {
          text: 'Hello jaan! 😎 Dost bot online hai ❤️'
        })
        return
      }

      // HELP
      if (command === '!help') {
        await sock.sendMessage(jid, {
          text:
`🤖 *DOST BOT COMMANDS*

👋 hi
🖼️ !sticker
📸 !photo
👤 !dp @number
🎵 !gana <audio-url>
❓ !help

Reply to an image with !sticker
Reply to a sticker with !photo`
        })
        return
      }

      // STICKER
      if (command === '!sticker') {
        const quoted =
          msg.message.extendedTextMessage?.contextInfo?.quotedMessage

        if (!quoted) {
          await sock.sendMessage(jid, {
            text: '❌ Kisi image/video ko reply karke !sticker likho.'
          })
          return
        }

        const fakeMsg = {
          key: {
            remoteJid: jid,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            fromMe: false
          },
          message: quoted
        }

        const buffer = await downloadMediaMessage(
          fakeMsg,
          'buffer',
          {},
          {
            logger: P({ level: 'silent' })
          }
        )

        const sticker = await sharp(buffer)
          .resize(512, 512, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp()
          .toBuffer()

        await sock.sendMessage(jid, {
          sticker
        })

        return
      }

      // STICKER -> PHOTO
      if (command === '!photo') {
        const quoted =
          msg.message.extendedTextMessage?.contextInfo?.quotedMessage

        if (!quoted?.stickerMessage) {
          await sock.sendMessage(jid, {
            text: '❌ Sticker ko reply karke !photo likho.'
          })
          return
        }

        const fakeMsg = {
          key: {
            remoteJid: jid,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            fromMe: false
          },
          message: quoted
        }

        const buffer = await downloadMediaMessage(
          fakeMsg,
          'buffer',
          {},
          {
            logger: P({ level: 'silent' })
          }
        )

        const image = await sharp(buffer)
          .png()
          .toBuffer()

        await sock.sendMessage(jid, {
          image,
          caption: '📸 Sticker → Photo'
        })

        return
      }

      // DP
      if (command === '!dp') {
        const args = text.trim().split(/\s+/)

        if (!args[1]) {
          await sock.sendMessage(jid, {
            text: '❌ Example: !dp 919876543210'
          })
          return
        }

        let number = args[1].replace(/[^0-9]/g, '')

        if (number.length < 10) {
          await sock.sendMessage(jid, {
            text: '❌ Valid WhatsApp number do.'
          })
          return
        }

        if (!number.includes('@')) {
          number = number + '@s.whatsapp.net'
        }

        try {
          const url = await sock.profilePictureUrl(number, 'image')

          await sock.sendMessage(jid, {
            image: { url },
            caption: '👤 Profile picture'
          })
        } catch {
          await sock.sendMessage(jid, {
            text: '❌ Profile picture available nahi hai.'
          })
        }

        return
      }

      // GANA / AUDIO
      if (command === '!gana') {
        const args = text.trim().split(/\s+/)

        if (!args[1]) {
          await sock.sendMessage(jid, {
            text: '❌ Example: !gana https://example.com/song.mp3'
          })
          return
        }

        const audioUrl = args[1]

        await sock.sendMessage(jid, {
          audio: { url: audioUrl },
          mimetype: 'audio/mpeg',
          ptt: false
        })

        return
      }

    } catch (err) {
      console.log('Command Error:', err)

      await sock.sendMessage(jid, {
        text: '❌ Command chalate waqt error aa gaya.'
      })
    }
  })
}

startBot()
