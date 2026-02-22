import os
import requests
from dotenv import load_dotenv


def get_tunnel_url() -> str | None:
    # 1. Try the TunnelService backend API (most accurate — managed process)
    try:
        response = requests.get(
            "http://127.0.0.1:8001/api/tunnel/status",
            headers={"x-neural-handshake": os.getenv("NEURAL_HANDSHAKE", "AGENT_LEE_SOVEREIGN_V1")},
            timeout=4
        )
        if response.ok:
            data = response.json()
            url = data.get("url") or ""
            if url.startswith("https://"):
                # Save for fallback
                with open("c:/Tools/Portable-VSCode-MCP-Kit/workspace/tunnel_url.txt", "w") as fw:
                    fw.write(url)
                print(f"✅ Tunnel URL from TunnelService API: {url}")
                return url
    except Exception as e:
        print(f"⚠️  TunnelService API not reachable ({e})")

    # 2. Try ngrok-style API on :4040 (legacy / ngrok native)
    try:
        response = requests.get("http://127.0.0.1:4040/api/tunnels", timeout=4)
        response.raise_for_status()
        data = response.json()
        for tunnel in data.get("tunnels", []):
            public_url = tunnel.get("public_url", "")
            if tunnel.get("proto") == "https" and public_url.startswith("https://"):
                print(f"✅ Tunnel URL from ngrok API: {public_url}")
                return public_url
    except Exception as e:
        print(f"⚠️  ngrok API not reachable on :4040 ({e})")

    # 2. Try parsing the cloudflared log for trycloudflare.com URL
    import re
    cf_log = "c:/Tools/Portable-VSCode-MCP-Kit/workspace/cloudflared.log"
    try:
        with open(cf_log, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        matches = re.findall(r'https://[a-z0-9\-]+\.trycloudflare\.com', content)
        if matches:
            url = matches[-1]  # most recent
            # Also persist it for next call
            with open("c:/Tools/Portable-VSCode-MCP-Kit/workspace/tunnel_url.txt", "w") as fw:
                fw.write(url)
            print(f"✅ Tunnel URL from cloudflared log: {url}")
            return url
    except Exception:
        pass

    # 3. Try reading from the saved tunnel_url.txt file
    url_file = "c:/Tools/Portable-VSCode-MCP-Kit/workspace/tunnel_url.txt"
    try:
        with open(url_file, "r") as f:
            saved = f.read().strip()
        if saved.startswith("https://"):
            print(f"✅ Tunnel URL from file: {saved}")
            return saved
    except Exception:
        pass

    return None


# Keep old name as alias for backward compatibility
def get_ngrok_url() -> str | None:
    return get_tunnel_url()


def main():
    load_dotenv("c:/Tools/Portable-VSCode-MCP-Kit/.env.local")

    token = os.getenv("TELEGRAM_BOT_TOKEN_2") or os.getenv("TELEGRAM_BOT_TOKEN")
    user_id = os.getenv("TELEGRAM_USER_ID")

    if not token or not user_id:
        print("❌ Error: Missing Telegram credentials in .env.local")
        raise SystemExit(1)

    public_url = get_tunnel_url()
    if not public_url:
        print("❌ Error: No active HTTPS tunnel found. Run 'node scripts/tunnel_manager.js' first.")
        raise SystemExit(1)

    provider = "Cloudflare" if "trycloudflare.com" in (public_url or "") else "ngrok" if "ngrok" in (public_url or "") else "Tunnel"
    message = (
        "🚀 *Agent Lee OS - Remote Access Ready*\n\n"
        f"🔗 *Live Link:* {public_url}\n"
        f"☁️ Provider: {provider}\n\n"
        "Tap the link — opens directly, no warnings.\n\n"
        "🔐 *Device Identity*\n"
        "ID: `MOBILE_ACCESS`\n"
        "Secret: `sovereign_mobile`"
    )

    api_url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": user_id,
        "text": message,
        "parse_mode": "Markdown"
    }

    response = requests.post(api_url, json=payload, timeout=12)
    if response.ok:
        print(f"✅ Message sent to Telegram with link: {public_url}")
    else:
        print(f"❌ Failed to send: {response.text}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
