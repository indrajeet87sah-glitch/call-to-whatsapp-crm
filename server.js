const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const callLogs = [];

app.get('/api/logs', (req, res) => {
    res.json({
        totalCalls: callLogs.length,
        sentCount: callLogs.filter(l => l.status === "Sent").length,
        failedCount: callLogs.filter(l => l.status === "Failed").length,
        logs: callLogs
    });
});

app.post('/api/call-ended', async (req, res) => {
    let { number, secret, callType = "Missed Call", customMessage } = req.body;

    if (secret !== process.env.WEBHOOK_SECRET) {
        return res.status(403).json({ error: "Unauthorized Request! Invalid Secret." });
    }

    if (!number) {
        return res.status(400).json({ error: "Caller number missing!" });
    }

    number = number.replace(/\D/g, '');
    if (number.length === 10) {
        number = '91' + number;
    }

    const payload = customMessage ? {
        messaging_product: "whatsapp",
        to: number,
        type: "text",
        text: { body: customMessage }
    } : {
        messaging_product: "whatsapp",
        to: number,
        type: "template",
        template: {
            name: "hello_world",
            language: { code: "en_US" }
        }
    };

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const logEntry = {
            id: Date.now(),
            callerNumber: `+${number}`,
            callType,
            messageSent: customMessage || "Template: hello_world",
            status: "Sent",
            messageId: response.data.messages[0].id,
            timestamp: new Date().toLocaleTimeString()
        };
        callLogs.unshift(logEntry);

        console.log(`✅ WhatsApp Sent to +${number}`);
        res.status(200).json({ success: true, log: logEntry });

    } catch (error) {
        const errMsg = error.response?.data?.error?.message || error.message;
        console.error("❌ WhatsApp API Error:", errMsg);

        callLogs.unshift({
            id: Date.now(),
            callerNumber: `+${number}`,
            callType,
            messageSent: customMessage || "Template: hello_world",
            status: "Failed",
            error: errMsg,
            timestamp: new Date().toLocaleTimeString()
        });

        res.status(500).json({ success: false, error: errMsg });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 CRM Dashboard Live at http://localhost:${PORT}`);
});