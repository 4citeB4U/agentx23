
import os
import requests
from dotenv import load_dotenv


def load_env():
    load_dotenv("c:/Tools/Portable-VSCode-MCP-Kit/.env.local")


def get_telegram_config():
    token = os.getenv("TELEGRAM_BOT_TOKEN_2") or os.getenv("TELEGRAM_BOT_TOKEN")
    user_id = os.getenv("TELEGRAM_USER_ID")
    if not token or not user_id:
        raise RuntimeError("Missing TELEGRAM_BOT_TOKEN(_2) or TELEGRAM_USER_ID in .env.local")
    return token, user_id

def get_ngrok_url():
    try:
        response = requests.get("http://127.0.0.1:4040/api/tunnels", timeout=8)
        data = response.json()
        for tunnel in data.get('tunnels', []):
            if tunnel['proto'] == 'https':
                return tunnel['public_url']
    except Exception as e:
        print(f"Error fetching ngrok URL: {e}")
        return None

def send_telegram_message(token: str, user_id: str, message: str):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": user_id,
        "text": message
    }
    try:
        response = requests.post(url, json=payload, timeout=12)
        response.raise_for_status()
        print("Message sent successfully!")
    except Exception as e:
        print(f"Error sending Telegram message: {e}")

if __name__ == "__main__":
    load_env()
    token, user_id = get_telegram_config()
    url = get_ngrok_url()
    if url:
        print(f"Found Ngrok URL: {url}")
        message = (
            "🚀 *Agent Lee OS - Remote Access*\n\n"
            "Your neural bridge is active.\n\n"
            f"🔗 Link: {url}\n"
        )
        send_telegram_message(token, user_id, message)
    else:
        print("Could not find active Ngrok tunnel.")
