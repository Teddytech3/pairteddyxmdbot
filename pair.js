const { webcrypto } = require('crypto');
globalThis.crypto = webcrypto; // FIX: Required for Baileys pairing code on Node 18/20

const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    delay,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    DisconnectReason,
} = require("@whiskeysockets/baileys");

const router = express.Router();

// Auto cleanup temp folder
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    if (!num) {
        return res.status(400).send({ error: "Please provide ?number=2547XXXXXXXX" });
    }

    async function TEDDY_XMD() {
        const sessionPath = path.join(TEMP_DIR, id);
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        try {
            const { version } = await fetchLatestBaileysVersion();
            const logger = pino({ level: 'silent' });

            const client = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger),
                },
                printQRInTerminal: false,
                logger,
                browser: Browsers.ubuntu('Chrome'),
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
            });

            client.ev.on('creds.update', saveCreds);

            client.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === 'open') {
                    try {
                        await client.sendMessage(client.user.id, {
                            text: '🤖 *TEDDY-XMD* 🤖\nGenerating your session, please wait a moment...'
                        });

                        await delay(3000);

                        const credsPath = path.join(sessionPath, 'creds.json');
                        const data = fs.readFileSync(credsPath);
                        const b64data = Buffer.from(data).toString('base64');

                        const session = await client.sendMessage(
                            client.user.id,
                            { text: 'TEDDY-XMD:~' + b64data }
                        );

                        await client.sendMessage(
                            client.user.id,
                            {
                                text:
`╔════════════════════╗
║      TEDDY-XMD
╚════════════════════╝

✅ Your WhatsApp account has been linked successfully!

⚠️ DO NOT share this Session ID with anyone.

📋 Session Format:
TEDDY-XMD:~xxxxxxxxxxxxxxxx

📌 Copy and paste the Session ID into the SESSION_ID variable during deployment.

👨‍💻 Developer: https://wa.me/254799963583
🤖 TEDDY-XMD | 👑 King of Automation 🚀`
                            },
                            { quoted: session }
                        );

                        await delay(2000);
                        await client.ws.close();
                        removeFile(sessionPath);

                    } catch (e) {
                        console.log('Error sending session messages:', e);
                        removeFile(sessionPath);
                    }
                }

                else if (connection === 'close') {
                    const code = lastDisconnect?.error?.output?.statusCode;
                    if (code !== DisconnectReason.loggedOut) {
                        console.log("Reconnecting...");
                        await delay(5000);
                        TEDDY_XMD();
                    } else {
                        removeFile(sessionPath);
                    }
                }
            });

            // Request pairing code
            if (!client.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');

                const code = await client.requestPairingCode(num);

                if (!res.headersSent) {
                    await res.send({
                        bot: 'TEDDY-XMD',
                        status: 'success',
                        code: code
                    });
                }
            }

        } catch (err) {
            console.log('Pair service error:', err);
            removeFile(sessionPath);
            if (!res.headersSent) {
                await res.status(500).send({
                    bot: 'TEDDY-XMD',
                    status: 'error',
                    code: 'Service Currently Unavailable'
                });
            }
        }
    }

    await TEDDY_XMD();
});

module.exports = router;
