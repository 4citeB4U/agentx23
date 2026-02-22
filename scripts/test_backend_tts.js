import crypto from 'node:crypto';

const DEVICE_ID = process.env.DEVICE_ID || 'MOBILE_ACCESS';
const DEVICE_SECRET = process.env.DEVICE_SECRET || 'sovereign_mobile';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001';

function signRequest(body) {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(12).toString('hex');
    const message = JSON.stringify(body) + timestamp + nonce;
    const signature = crypto.createHmac('sha256', DEVICE_SECRET).update(message).digest('hex');

    return {
        'x-device-id': DEVICE_ID,
        'x-neural-signature': signature,
        'x-neural-timestamp': timestamp,
        'x-neural-nonce': nonce
    };
}

async function testTTS() {
    try {
        const body = {
            text: 'Agent Lee is now speaking with high fidelity.',
            voice: 'en-US-AndrewMultilingualNeural'
        };
        const signedHeaders = signRequest(body);

        const response = await fetch(`${BACKEND_URL}/api/chat/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...signedHeaders
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            console.log("TTS Success: Audio stream received.");
            console.log("Content-Type:", response.headers.get('content-type'));
        } else {
            console.error("TTS Failed:", await response.text());
        }
    } catch (err) {
        console.error("Connection failed:", err.message);
    }
}

testTTS();
