"""
tunnel_notify.py — waits for cloudflared to assign a URL, writes it to ip.txt,
and sends it to Telegram so the link always arrives on your phone automatically.
"""
import os, re, time, urllib.request, urllib.parse, json

LOG_PATH = os.path.join(os.path.dirname(__file__), '..', 'tunnel.log')
IP_PATH  = os.path.join(os.path.dirname(__file__), '..', 'ip.txt')

def load_env():
    env = {}
    env_file = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    if os.path.exists(env_file):
        for line in open(env_file, encoding='utf-8'):
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    return env

def send_telegram(token, chat_id, text):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}).encode()
    try:
        urllib.request.urlopen(url, data=data, timeout=10)
        print(f"[tunnel_notify] Sent to Telegram: {text[:80]}")
    except Exception as e:
        print(f"[tunnel_notify] Telegram send failed: {e}")

def find_url_in_logs():
    """Scan PM2 cloudflared error log for a trycloudflare URL."""
    pm2_log = os.path.expanduser(r'~\.pm2\logs\AgentLee-Tunnel-error.log')
    paths = [pm2_log, LOG_PATH]
    pattern = re.compile(r'https://[\w\-]+\.trycloudflare\.com')
    for path in paths:
        if not os.path.exists(path):
            continue
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            matches = pattern.findall(content)
            if matches:
                return matches[-1]  # most recent
        except Exception:
            pass
    return None

def main():
    env = load_env()
    token   = env.get('TELEGRAM_BOT_TOKEN', '')
    chat_id = env.get('TELEGRAM_USER_ID', '')

    print("[tunnel_notify] Waiting for cloudflared tunnel URL...")

    url = None
    for attempt in range(60):          # wait up to 2 minutes
        url = find_url_in_logs()
        if url:
            break
        time.sleep(2)

    if not url:
        print("[tunnel_notify] Timed out waiting for tunnel URL.")
        return

    arcade_url = url + '/arcade/PACMAN.html'

    # Write to ip.txt
    with open(IP_PATH, 'w') as f:
        f.write(f"TUNNEL_URL={url}\nARCADE_URL={arcade_url}\n")
    print(f"[tunnel_notify] URL saved to ip.txt: {url}")

    # Send to Telegram
    if token and chat_id:
        msg = (
            "⚡ <b>Agent Lee OS — Live</b>\n\n"
            f"🌐 App: <a href=\"{url}\">{url}</a>\n"
            f"🕹️ Pac-Lee: <a href=\"{arcade_url}\">{arcade_url}</a>\n\n"
            "Tap a link to open. Dismiss browser warning if shown."
        )
        send_telegram(token, chat_id, msg)
    else:
        print("[tunnel_notify] Telegram credentials not set — skipping notification.")

if __name__ == '__main__':
    main()
