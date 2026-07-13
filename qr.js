const { makeid } = require('./id');
const QRCode = require('qrcode');
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

let router = express.Router();

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();

    async function TEDDY_XMD() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            const { version } = await fetchLatestBaileysVersion();
            const logger = pino({ level: 'silent' });

            let client = makeWASocket({
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
                const { connection, lastDisconnect, qr } = s;

                if (qr && !res.headersSent) {
                    await res.end(await QRCode.toBuffer(qr));
                }

                if (connection === 'open') {
                    try {
                        await client.sendMessage(client.user.id, {
                            text: '🤖 *TEDDY-XMD* 🤖\nGenerating your session, please wait a moment...'
                        });

                        await delay(5000);

                        let data = fs.readFileSync(
                            __dirname + `/temp/${id}/creds.json`
                        );

                        let b64data = Buffer.from(data).toString('base64');

                        let session = await client.sendMessage(
                            client.user.id,
                            {
                                text: 'TEDDY-XMD:~' + b64data
                            }
                        );

                        await client.sendMessage(
                            client.user.id,
                            {
                                text:
`🤖 *TEDDY-XMD Successfully Linked*

⚠️ Do NOT share this SESSION_ID with anyone.

Copy and paste the following session during deployment:

TEDDY-XMD:~xxxxxxxxxxxxxxxx

👨‍💻 Developer:
https://wa.me/254799963583

👑 TEDDY-XMD - King of Automation 🚀`
                            },
                            { quoted: session }
                        );

                        await delay(500);
                        await client.ws.close();
                        removeFile('./temp/' + id);

                    } catch (e) {
                        console.log(
                            'Error sending session messages:',
                            e
                        );
                    }
                } else if (connection === 'close') {
                    const code =
                        lastDisconnect?.error?.output?.statusCode;

                    if (code !== DisconnectReason.loggedOut) {
                        await delay(5000);
                        TEDDY_XMD();
                    }
                }
            });

        } catch (err) {
            console.log('QR service error:', err);

            if (!res.headersSent) {
                await res.json({
                    code: 'Service is Currently Unavailable'
                });
            }

            removeFile('./temp/' + id);
        }
    }

    return await TEDDY_XMD();
});

module.exports = router;