const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const BOT_TOKEN = "9130024533:AAEnz59o8XbZyJ3jK9n_qM_mfycdCm2q0Eg";
const ADMIN_ID = "8343576029"; // String format taaki type match mein dikkat na aaye
const TARGET_CHANNEL_ID = -1002292581257;

const WELCOME_FILE = path.join(__dirname, 'welcome_msg.json');
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

const DEFAULT_WELCOME_TEXT =
`https://t.me/+bI2T4MkLWC4yNmRl
https://t.me/+bI2T4MkLWC4yNmRl
https://t.me/+bI2T4MkLWC4yNmRl

💸💸JOIN VIP CHANNEL ✨✨`;

function loadWelcome() {
    try {
        if (fs.existsSync(WELCOME_FILE)) {
            return JSON.parse(fs.readFileSync(WELCOME_FILE, 'utf8'));
        }
    } catch (e) {
        console.error("Load welcome error:", e);
    }
    return null;
}

function saveWelcome(data) {
    try {
        fs.writeFileSync(WELCOME_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Save welcome error:", e);
    }
}

function extractMessage(msg) {
    if (msg.photo && msg.photo.length) {
        return {
            type: 'photo',
            file_id: msg.photo[msg.photo.length - 1].file_id,
            caption: msg.caption || "",
            caption_entities: msg.caption_entities || []
        };
    }
    if (msg.document) {
        return {
            type: 'document',
            file_id: msg.document.file_id,
            caption: msg.caption || "",
            caption_entities: msg.caption_entities || []
        };
    }
    if (msg.video) {
        return {
            type: 'video',
            file_id: msg.video.file_id,
            caption: msg.caption || "",
            caption_entities: msg.caption_entities || []
        };
    }
    if (msg.text) {
        return {
            type: 'text',
            text: msg.text,
            entities: msg.entities || []
        };
    }
    return null;
}

async function tgCall(method, body) {
    try {
        const r = await fetch(`${TG}/${method}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        return await r.json();
    } catch (e) {
        console.error(`TG API Error (${method}):`, e);
        return { ok: false };
    }
}

async function sendSavedWelcome(chatId, w) {
    if (w.type === 'text') {
        return tgCall('sendMessage', {
            chat_id: chatId,
            text: w.text,
            entities: w.entities,
            disable_web_page_preview: true
        });
    }
    const methodMap = { photo: 'sendPhoto', document: 'sendDocument', video: 'sendVideo' };
    return tgCall(methodMap[w.type], {
        chat_id: chatId,
        [w.type]: w.file_id,
        caption: w.caption,
        caption_entities: w.caption_entities
    });
}

async function sendDefaultWelcome(chatId) {
    return tgCall('sendMessage', {
        chat_id: chatId,
        text: DEFAULT_WELCOME_TEXT,
        disable_web_page_preview: true
    });
}

async function sendWelcome(chatId) {
    const w = loadWelcome();
    let res;
    if (w) {
        res = await sendSavedWelcome(chatId, w);
    } else {
        res = await sendDefaultWelcome(chatId);
    }
    if (!res || !res.ok) {
        console.error("❌ Welcome send failed:", res);
    }
    return res;
}

app.get('/', (req, res) => {
    res.send("Client Bot Server is Running Perfectly!");
});

app.post('/api/webhook', async (req, res) => {
    try {
        const update = req.body;
        console.log("📥 Incoming Telegram Update:", JSON.stringify(update));

        if (update.message) {
            const senderId = String(update.message.from.id);
            const messageText = update.message.text || "";
            console.log(`👤 Message from ID: ${senderId}, Text: ${messageText}`);

            if (messageText.startsWith('/setwelcome')) {
                if (senderId !== ADMIN_ID) {
                    console.log(`❌ Unauthorized /setwelcome attempt by ID: ${senderId}`);
                    await tgCall('sendMessage', { chat_id: update.message.chat.id, text: "⚠️ Aap admin nahi hain!" });
                } else {
                    const chatId = update.message.chat.id;
                    const replied = update.message.reply_to_message;
                    let reply;

                    if (!replied) {
                        reply = "⚠️ किसी मैसेज/फोटो/डॉक्यूमेंट पर रिप्लाई करके /setwelcome लिखें।";
                    } else {
                        const data = extractMessage(replied);
                        if (!data) {
                            reply = "⚠️ यह मैसेज टाइप सपोर्टेड नहीं है। टेक्स्ट, फोटो, वीडियो या डॉक्यूमेंट इस्तेमाल करें।";
                        } else {
                            saveWelcome(data);
                            reply = "✅ वेलकम मैसेज सफलतापूर्वक सेव हो गया!";
                        }
                    }
                    await tgCall('sendMessage', { chat_id: chatId, text: reply });
                }
            } else if (messageText.startsWith('/start')) {
                const chatId = update.message.chat.id;
                await sendWelcome(chatId);
                console.log("✅ Welcome message sent to chat:", chatId);
            }
        }

        const event = update.chat_join_request;
        if (event) {
            const userId = event.from.id;
            const reqChatId = event.chat.id;

            if (reqChatId === TARGET_CHANNEL_ID) {
                console.log("🔥 Valid Chat Join Request detected from User ID:", userId);
                try {
                    const wRes = await sendWelcome(event.user_chat_id || userId);
                    if (wRes && wRes.ok) {
                        console.log("✅ Welcome sent to join-request user:", userId);
                    } else {
                        console.log("ℹ️ Join welcome could not be sent (User hasn't started bot yet):", userId);
                    }
                } catch (e) {
                    console.error("❌ Join welcome failed:", e);
                }
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error("❌ Webhook Error:", err);
        res.status(500).json({ ok: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
    if (domain) {
        try {
            const webhookUrl = `https://${domain}/api/webhook`;
            const r = await tgCall('setWebhook', {
                url: webhookUrl,
                allowed_updates: ["message", "chat_join_request"]
            });
            console.log("Webhook set:", webhookUrl, r);
        } catch (e) {
            console.error("Webhook setup failed:", e);
        }
    } else {
        console.log("⚠️ Railway domain nahi mila, webhook set nahi hua.");
    }
});
