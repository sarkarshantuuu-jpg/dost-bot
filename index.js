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
      //          const code = await sock.requestPairingCode(phoneNumber)

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

    const command = text.trim().split(/\s+/)[0].toLowerCase()
    const args = text.trim().split(/\s+/).slice(1)

    try {

      // =========================
      // HI
      // =========================

      if (text.trim().toLowerCase() === 'hi') {
        await sock.sendMessage(jid, {
          text: 'Hello jaan! Dost bot online hai ❤️'
        })
        return
      }

      // =========================
      // HELP
      // =========================

      if (command === '!help') {
        await sock.sendMessage(jid, {
          text:
`🤖 *DOST BOT COMMANDS*

🛠️ MEDIA
!sticker
!photo
!toimg
!tovideo
!crop
!caption <text>
!blur
!mirror
!rotate
!gif

👤 WHATSAPP
!dp
!mydp
!tagall
!admins
!groupinfo
!link

😂 FUN
!roast
!joke
!meme
!fact
!shayari
!quote
!ship
!8ball <question>
!dice
!coin

🤖 BOT
!help
!ping
!alive
!owner
!uptime`
        })
        return
      }

      // =========================
      // PING
      // =========================

      if (command === '!ping') {
        await sock.sendMessage(jid, {
          text: '🏓 Pong!'
        })
        return
      }

      // =========================
      // ALIVE
      // =========================

      if (command === '!alive') {
        await sock.sendMessage(jid, {
          text: '✅ Dost Bot is alive and running 😎'
        })
        return
      }

      // =========================
      // OWNER
      // =========================

      if (command === '!owner') {
        await sock.sendMessage(jid, {
          text: `👑 Owner: +${OWNER}`
        })
        return
      }

      // =========================
      // UPTIME
      // =========================

      if (command === '!uptime') {
        const seconds = Math.floor((Date.now() - START_TIME) / 1000)

        const days = Math.floor(seconds / 86400)
        const hours = Math.floor((seconds % 86400) / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60

        await sock.sendMessage(jid, {
          text: `⏱️ Bot Uptime:\n${days}d ${hours}h ${minutes}m ${secs}s`
        })
        return
      }

      // =========================
      // GET QUOTED MESSAGE
      // =========================

      const context =
        msg.message.extendedTextMessage?.contextInfo

      const quotedMessage = context?.quotedMessage

      // =========================
      // IMAGE -> STICKER
      // =========================

      if (command === '!sticker') {

        if (!quotedMessage?.imageMessage) {
          await sock.sendMessage(jid, {
            text: '❌ Image ko reply karke !sticker likho.'
          })
          return
        }

        const quoted = {
          key: {
            remoteJid: jid,
            id: context.stanzaId,
            fromMe: false
          },
          message: quotedMessage
        }

        const buffer = await downloadMediaMessage(
          quoted,
          'buffer',
          {},
          {
            logger: P({ level: 'silent' })
          }
        )

        const sticker = await sharp(buffer)
          .resize(512, 512, {
            fit: 'contain',
            background: {
              r: 0,
              g: 0,
              b: 0,
              alpha: 0
            }
          })
          .webp()
          .toBuffer()

        await sock.sendMessage(jid, {
          sticker
        })

        return
      }

      // =========================
      // STICKER -> PHOTO
      // =========================

      if (command === '!photo' || command === '!toimg') {

        if (!quotedMessage?.stickerMessage) {
          await sock.sendMessage(jid, {
            text: '❌ Sticker ko reply karke !photo ya !toimg likho.'
          })
          return
        }

        const quoted = {
          key: {
            remoteJid: jid,
            id: context.stanzaId,
            fromMe: false
          },
          message: quotedMessage
        }

        const buffer = await downloadMediaMessage(
          quoted,
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

      // =========================
      // IMAGE CROP
      // =========================

      if (command === '!crop') {

        if (!quotedMessage?.imageMessage) {
          await sock.sendMessage(jid, {
            text: '❌ Image ko reply karke !crop likho.'
          })
          return
        }

        const quoted = {
          key: {
            remoteJid: jid,
            id: context.stanzaId,
            fromMe: false
          },
          message: quotedMessage
        }

        const buffer = await downloadMediaMessage(
          quoted,
          'buffer',
          {},
          {
            logger: P({ level: 'silent' })
          }
        )

        const cropped = await sharp(buffer)
          .resize(800, 800, {
            fit: 'cover'
          })
          .jpeg()
          .toBuffer()

        await sock.sendMessage(jid, {
          image: cropped
        })

        return
      }

      // =========================
      // BLUR
      // =========================

      if (command === '!blur') {

        if (!quotedMessage?.imageMessage) {
          await sock.sendMessage(jid, {
            text: '❌ Image ko reply karke !blur likho.'
          })
          return
        }

        const quoted = {
          key: {
            remoteJid: jid,
            id: context.stanzaId,
            fromMe: false
          },
          message: quotedMessage
        }

        const buffer = await downloadMediaMessage(
          quoted,
          'buffer',
          {},
          {
            logger: P({ level: 'silent' })
          }
        )

        const result = await sharp(buffer)
          .blur(8)
          .jpeg()
          .toBuffer()

        await sock.sendMessage(jid, {
          image: result
        })

        return
      }

      // =========================
      // MIRROR
      // =========================

      if (command === '!mirror') {

        if (!quotedMessage?.imageMessage) {
          await sock.sendMessage(jid, {
            text: '❌ Image ko reply karke !mirror likho.'
          })
          return
        }

        const quoted = {
          key: {
            remoteJid: jid,
            id: context.stanzaId,
            fromMe: false
          },
          message: quotedMessage
        }

        const buffer = await downloadMediaMessage(
          quoted,
          'buffer',
          {},
          {
            logger: P({ level: 'silent' })
          }
        )

        const result = await sharp(buffer)
          .flop()
          .jpeg()
          .toBuffer()

        await sock.sendMessage(jid, {
          image: result
        })

        return
      }

      // =========================
      // ROTATE
      // =========================

      if (command === '!rotate') {

        if (!quotedMessage?.imageMessage) {
          await sock.sendMessage(jid, {
            text: '❌ Image ko reply karke !rotate likho.'
          })
          return
        }

        const quoted = {
          key: {
            remoteJid: jid,
            id: context.stanzaId,
            fromMe: false
          },
          message: quotedMessage
        }

        const buffer = await downloadMediaMessage(
          quoted,
          'buffer',
          {},
          {
            logger: P({ level: 'silent' })
          }
        )

        const result = await sharp(buffer)
          .rotate(90)
          .jpeg()
          .toBuffer()

        await sock.sendMessage(jid, {
          image: result
        })

        return
      }

      // =========================
      // CAPTION
      // =========================

      if (command === '!caption') {

        if (!quotedMessage?.imageMessage) {
          await sock.sendMessage(jid, {
            text: '❌ Image ko reply karke !caption <text> likho.'
          })
          return
        }

        const caption = args.join(' ') || 'Dost Bot'

        const quoted = {
          key: {
            remoteJid: jid,
            id: context.stanzaId,
            fromMe: false
          },
          message: quotedMessage
        }

        const buffer = await downloadMediaMessage(
          quoted,
          'buffer',
          {},
          {
            logger: P({ level: 'silent' })
          }
        )

        await sock.sendMessage(jid, {
          image: buffer,
          caption
        })

        return
      }

      // =========================
      // DP
      // =========================

      if (command === '!dp') {

        if (!args[0]) {
          await sock.sendMessage(jid, {
            text: '❌ Example: !dp 919876543210'
          })
          return
        }

        const number =
          args[0].replace(/[^0-9]/g, '') +
          '@s.whatsapp.net'

        try {
          const url = await sock.profilePictureUrl(
            number,
            'image'
          )

          await sock.sendMessage(jid, {
            image: { url },
            caption: '👤 Profile Picture'
          })

        } catch {
          await sock.sendMessage(jid, {
            text: '❌ Profile picture nahi mili.'
          })
        }

        return
      }

      // =========================
      // MY DP
      // =========================

      if (command === '!mydp') {

        try {
          const url = await sock.profilePictureUrl(
            sock.user.id,
            'image'
          )

          await sock.sendMessage(jid, {
            image: { url },
            caption: '👤 My DP'
          })

        } catch {
          await sock.sendMessage(jid, {
            text: '❌ DP nahi mili.'
          })
        }

        return
      }

      // =========================
      // GROUP CHECK
      // =========================

      let metadata = null

      if (jid.endsWith('@g.us')) {
        metadata = await sock.groupMetadata(jid)
      }

      // =========================
      // TAG ALL
      // =========================

      if (command === '!tagall') {

        if (!metadata) {
          await sock.sendMessage(jid, {
            text: '❌ Ye command group me use karo.'
          })
          return
        }

        const mentions = metadata.participants.map(
          p => p.id
        )

        const textTag = mentions
          .map((id, i) => `${i + 1}. @${id.split('@')[0]}`)
          .join('\n')

        await sock.sendMessage(jid, {
          text: `📢 *TAG ALL*\n\n${textTag}`,
          mentions
        })

        return
      }

      // =========================
      // ADMINS
      // =========================

      if (command === '!admins') {

        if (!metadata) {
          await sock.sendMessage(jid, {
            text: '❌ Group me use karo.'
          })
          return
        }

        const admins = metadata.participants.filter(
          p => p.admin
        )

        const mentions = admins.map(p => p.id)

        const list = admins
          .map(
            (p, i) =>
              `${i + 1}. @${p.id.split('@')[0]}`
          )
          .join('\n')

        await sock.sendMessage(jid, {
          text: `👑 *GROUP ADMINS*\n\n${list || 'No admins found'}`,
          mentions
        })

        return
      }

      // =========================
      // GROUP INFO
      // =========================

      if (command === '!groupinfo') {

        if (!metadata) {
          await sock.sendMessage(jid, {
            text: '❌ Group me use karo.'
          })
          return
        }

        await sock.sendMessage(jid, {
          text:
`👥 *GROUP INFO*

📛 Name: ${metadata.subject}
👤 Members: ${metadata.participants.length}
🆔 ID: ${jid}`
        })

        return
      }

      // =========================
      // GROUP LINK
      // =========================

      if (command === '!link') {

        if (!metadata) {
          await sock.sendMessage(jid, {
            text: '❌ Group me use karo.'
          })
          return
        }

        try {
          const code = await sock.groupInviteCode(jid)

          await sock.sendMessage(jid, {
            text: `🔗 Group Link:\nhttps://chat.whatsapp.com/${code}`
          })

        } catch {
          await sock.sendMessage(jid, {
            text: '❌ Group link lene ke liye bot ko admin hona pad sakta hai.'
          })
        }

        return
      }

      // =========================
      // JOKE
      // =========================

      if (command === '!joke') {

        const jokes = [
          '😂 Programmer ka favourite place? The BUGER KING.',
          '🤣 WiFi slow ho to sabse pehle router ko ghoora jata hai.',
          '😎 Dost: Padhai kaisi chal rahi? Main: WiFi ki tarah—kabhi connected, kabhi disconnected.'
        ]

        await sock.sendMessage(jid, {
          text: jokes[Math.floor(Math.random() * jokes.length)]
        })

        return
      }

      // =========================
      // FACT
      // =========================

      if (command === '!fact') {

        const facts = [
          '🧠 Honey kabhi easily spoil nahi hota.',
          '🌍 Earth ka lagbhag 71% surface water se covered hai.',
          '🐙 Octopus ke teen hearts hote hain.'
        ]

        await sock.sendMessage(jid, {
          text: facts[Math.floor(Math.random() * facts.length)]
        })

        return
      }

      // =========================
      // SHAYARI
      // =========================

      if (command === '!shayari') {

        await sock.sendMessage(jid, {
          text:
`✨ *Shayari*

Dosti wo nahi jo har waqt saath ho,
Dosti wo hai jo door rehkar bhi yaad ho ❤️`
        })

        return
      }

      // =========================
      // QUOTE
      // =========================

      if (command === '!quote') {

        const quotes = [
          '✨ Believe in yourself.',
          '🔥 Small steps every day.',
          '💪 Never stop learning.',
          '😎 Be yourself.'
        ]

        await sock.sendMessage(jid, {
          text: quotes[Math.floor(Math.random() * quotes.length)]
        })

        return
      }

      // =========================
      // ROAST
      // =========================

      if (command === '!roast') {

        const roasts = [
          '😂 Bhai tera confidence dekh ke WiFi bhi disconnect ho gaya.',
          '🤣 Itna serious mat ho, calculator bhi tujhe dekh ke confuse ho jata hai.',
          '😎 Tu special hai... bas kis category me, ye abhi research chal rahi hai.'
        ]

        await sock.sendMessage(jid, {
          text: roasts[Math.floor(Math.random() * roasts.length)]
        })

        return
      }

      // =========================
      // SHIP
      // =========================

      if (command === '!ship') {

        const percentage =
          Math.floor(Math.random() * 101)

        await sock.sendMessage(jid, {
          text: `❤️ Compatibility: *${percentage}%*`
        })

        return
      }

      // =========================
      // 8 BALL
      // =========================

      if (command === '!8ball') {

        if (!args.length) {
          await sock.sendMessage(jid, {
            text: '🎱 Example: !8ball Kal baarish hogi?'
          })
          return
        }

        const answers = [
          '🎱 Haan.',
          '🎱 Nahi.',
          '🎱 Shayad.',
          '🎱 Definitely!',
          '🎱 Abhi predict nahi kar sakta.'
        ]

        await sock.sendMessage(jid, {
          text: answers[Math.floor(Math.random() * answers.length)]
        })

        return
      }

      // =========================
      // DICE
      // =========================

      if (command === '!dice') {

        const number =
          Math.floor(Math.random() * 6) + 1

        await sock.sendMessage(jid, {
          text: `🎲 You rolled: *${number}*`
        })

        return
      }

      // =========================
      // COIN
      // =========================

      if (command === '!coin') {

        const result =
          Math.random() < 0.5
            ? 'Heads'
            : 'Tails'

        await sock.sendMessage(jid, {
          text: `🪙 *${result}*`
        })

        return
      }

      // =========================
      // MEME
      // =========================

      if (command === '!meme') {

        await sock.sendMessage(jid, {
          text:
`😂 *MEME*

Teacher: Homework kahan hai?
Me: Sir, Google Drive me tha...
Google: Storage full hai. 😭`
        })

        return
      }

      // =========================
      // DEFAULT
      // =========================

      if (text.startsWith('!')) {
        await sock.sendMessage(jid, {
          text: '❓ Unknown command. !help likho.'
        })
      }

    } catch (error) {

      console.log('Command Error:', error)

      await sock.sendMessage(jid, {
        text: '❌ Command chalate waqt error aa gaya.'
      })
    }
  })
}

startBot()
