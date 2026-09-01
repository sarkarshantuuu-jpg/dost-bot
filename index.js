const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys')
const P = require('pino')
const axios = require('axios')
const yts = require('yt-search')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), printQRInTerminal: false })
  sock.ev.on('creds.update', saveCreds)

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(process.env.PHONE_NUMBER)
        console.log(`PAIRING CODE: ${code}`)
      } catch (e) { console.log(e.message) }
    }, 3000)
  }

  sock.ev.on('connection.update', async (u) => {
    if (u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
    if (u.connection === 'open') console.log('DOST ULTRA ON 🔥')
  })

  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages[0]
    if (!msg.message || msg.key.fromMe) return

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || ''
    const lower = text.toLowerCase().trim()
    const args = text.trim().split(/ +/).slice(1).join(' ')
    const jid = msg.key.remoteJid

    // HI HELLO - bina prefix
    if (lower === 'hi' || lower === 'hello' || lower === 'hii') {
      await sock.sendMessage(jid, { text: 'Hello jaan! Dost bot online hai ❤️' })
    }

    // PING ALIVE MENU OWNER BOT - capital small sab chalega
    if (lower === 'ping' || lower.startsWith('ping ')) {
      await sock.sendMessage(jid, { text: 'Pong! Bot zinda hai 🔥' })
    }
    if (lower === 'alive' || lower === 'bot') {
      await sock.sendMessage(jid, { text: 'Bot zinda hai jaan 🔥' })
    }
    if (lower === 'menu' || lower === 'help') {
      await sock.sendMessage(jid, { text: `*DOST BOT MENU* 🔥\n\n1. hi / hello\n2. ping / alive\n3. owner\n4. menu\n5. s - photo pe reply karke sticker\n6. dp / pp - dp nikale\n7. insta <link> - insta video download\n8. yt <link> - yt video download\n9. play / song <naam> - gana download` })
    }
    if (lower === 'owner' || lower.startsWith('owner')) {
      await sock.sendMessage(jid, { text: 'Owner ka number hide hai jaan 😎\nwa.me/919229681078 pe contact karo ❤️' })
    }

    // STICKER - sahi wala
    if (lower === 's' || lower === 'sticker') {
      try {
        let mediaMsg = null
        if (msg.message.imageMessage) mediaMsg = msg
        else {
          const q = msg.message.extendedTextMessage?.contextInfo?.quotedMessage
          if (q?.imageMessage || q?.videoMessage) mediaMsg = { message: q, key: msg.key }
        }
        if (!mediaMsg) {
          await sock.sendMessage(jid, { text: 'Kisi photo/video pe reply karke s likho 🖼️' })
          return
        }
        const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {})
        await sock.sendMessage(jid, { sticker: buffer })
      } catch (e) {
        await sock.sendMessage(jid, { text: 'Sticker nahi bana 😢' })
      }
    }

    // DP DOWNLOAD - dp 9199xxxxxx ya dp pe reply
    if (lower.startsWith('dp') || lower.startsWith('pp')) {
      try {
        let targetJid = jid
        if (args) {
          let num = args.replace(/[^0-9]/g, '')
          if (num) targetJid = num + '@s.whatsapp.net'
        } else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
          targetJid = msg.message.extendedTextMessage.contextInfo.participant
        }
        const ppUrl = await sock.profilePictureUrl(targetJid, 'image')
        await sock.sendMessage(jid, { image: { url: ppUrl }, caption: 'Ye le DP 🔥' })
      } catch (e) {
        await sock.sendMessage(jid, { text: 'DP nahi mila, number private hai' })
      }
    }

    // INSTA DOWNLOAD
    if (lower.startsWith('insta ') || text.includes('instagram.com')) {
      const link = args || text
      try {
        await sock.sendMessage(jid, { text: 'Insta video download kar raha hu...' })
        // free api
        const res = await axios.get(`https://api.mehdi-sh.ir/insta?url=${encodeURIComponent(link)}`)
        const videoUrl = res.data?.result?.url || res.data?.url
        if (videoUrl) {
          await sock.sendMessage(jid, { video: { url: videoUrl }, caption: 'Ye le Insta video 🔥' })
        } else throw new Error()
      } catch {
        await sock.sendMessage(jid, { text: 'Insta link sahi bhej, private video nahi hoga' })
      }
    }

    // YT VIDEO DOWNLOAD - yt <link>
    if (lower.startsWith('yt ') || lower.startsWith('ytmp4 ') || (text.includes('youtu.be') || text.includes('youtube.com'))) {
      if (!lower.startsWith('play') &&!lower.startsWith('song') &&!lower.startsWith('gana')) {
        const link = args || text
        try {
          await sock.sendMessage(jid, { text: 'YT video download kar raha hu...' })
          const api = await axios.get(`https://api.mehdi-sh.ir/youtube?url=${encodeURIComponent(link)}`)
          const url = api.data?.result?.url || api.data?.url
          if (url) await sock.sendMessage(jid, { video: { url }, caption: 'Ye le YT video 🔥' })
          else throw new Error()
        } catch {
          await sock.sendMessage(jid, { text: 'YT link kaam nahi kiya, dusra try kar' })
        }
      }
    }

    // SONG / PLAY - gana download
    if (lower.startsWith('play ') || lower.startsWith('song ') || lower.startsWith('gana ')) {
      if (!args) {
        await sock.sendMessage(jid, { text: 'Gana ka naam likh: play kesariya' })
        return
      }
      try {
        await sock.sendMessage(jid, { text: `*${args}* dhoondh raha hu...` })
        const search = await yts(args)
        const video = search.videos[0]
        if (!video) throw new Error()
        const api = await axios.get(`https://api.mehdi-sh.ir/youtube?url=${encodeURIComponent(video.url)}&type=mp3`)
        const audioUrl = api.data?.result?.url || api.data?.url
        if (audioUrl) {
          await sock.sendMessage(jid, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: `${video.title}.mp3` })
          await sock.sendMessage(jid, { text: `*${video.title}* - ${video.timestamp} \n${video.url}` })
        } else {
          await sock.sendMessage(jid, { image: { url: video.thumbnail }, caption: `*${video.title}*\nLink: ${video.url}\n\nAudio API down hai, yahi se sun le` })
        }
      } catch (e) {
        await sock.sendMessage(jid, { text: 'Gana nahi mila, dusra naam try kar' })
      }
    }
  })
}
startBot()
