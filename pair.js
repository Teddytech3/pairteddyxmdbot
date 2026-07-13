const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
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

function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function TEDDY_XMD() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

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

                        await delay(5000);

                        const data = fs.readFileSync(
                            __dirname + `/temp/${id}/creds.json`
                        );

                        const b64data = Buffer.from(data).toString('base64');

                        const session = await client.sendMessage(
                            client.user.id,
                            {
                                text: 'TEDDY-XMD:~' + b64data
                            }
                        );

                        await client.sendMessage(
                            client.user.id,
                            {
                                text:
`╔════════════════════╗
║      TEDDY-XMD
╚════════════════════╝

✅ Your WhatsApp account has been linked successfully.

⚠️ DO NOT share this Session ID with anyone.

📋 Session Format:
TEDDY-XMD:~xxxxxxxxxxxxxxxx

📌 Copy and paste the Session ID into the SESSION_ID variable during deployment.

👨‍💻 Developer:
https://wa.me/254799963583

🤖 TEDDY-XMD
👑 King of Automation 🚀`
                            },
                            { quoted: session }
                        );

                        await delay(1000);
                        await client.ws.close();

                        removeFile('./temp/' + id);

                    } catch (e) {
                        console.log(
                            'Error sending session messages:',
                            e
                        );
                    }
                }

                else if (connection === 'close') {
                    const code =
                        lastDisconnect?.error?.output?.statusCode;

                    if (code !== DisconnectReason.loggedOut) {
                        await delay(5000);
                        TEDDY_XMD();
                    } else {
                        removeFile('./temp/' + id);
                    }
                }
            });

            if (!client.authState.creds.registered) {
                await delay(1500);

                num = (num || '')
                    .replace(/[^0-9]/g, '');

                const code =
                    await client.requestPairingCode(num);

                if (!res.headersSent) {
                    await res.send({
                        bot: 'TEDDY-XMD',
                        session: 'TEDDY-XMD:~',
                        code
                    });
                }
            }

        } catch (err) {
            console.log('Pair service error:', err);

            removeFile('./temp/' + id);

            if (!res.headersSent) {
                await res.send({
                    bot: 'TEDDY-XMD',
                    session: 'TEDDY-XMD:~',
                    code: 'Service Currently Unavailable'
                });
            }
        }
    }

    await TEDDY_XMD();
});

module.exports = router;