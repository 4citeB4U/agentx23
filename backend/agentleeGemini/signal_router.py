# signal_router.py
from __future__ import annotations
import json, time, base64, hmac, hashlib, os, asyncio
from typing import Dict, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.websockets import WebSocketState

router = APIRouter(prefix="", tags=["signaling"])

# ------------------------------
# Simple in-memory room state
# ------------------------------
class Room:
    def __init__(self) -> None:
        self.clients: Dict[str, WebSocket] = {}  # peerId -> ws

rooms: Dict[str, Room] = {}

def get_room(name: str) -> Room:
    room = rooms.get(name)
    if not room:
        room = rooms[name] = Room()
    return room

# ------------------------------
# TURN HMAC creds (coturn: use-auth-secret)
# ------------------------------
def make_turn_cred(uid: str, ttl: int = 3600) -> Dict[str, str]:
    secret = os.getenv("TURN_SECRET", "")
    if not secret:
        # Return STUN-only if not configured
        return {
            "urls": ["stun:stun.l.google.com:19302"],
            "username": "",
            "credential": ""
        }
    exp = int(time.time()) + ttl
    username = f"{exp}:{uid[:64]}"
    digest = hmac.new(secret.encode("utf-8"), username.encode("utf-8"), hashlib.sha1).digest()
    credential = base64.b64encode(digest).decode("ascii")
    domain = os.getenv("TURN_DOMAIN", "turn.example.com")
    urls = [
        f"stun:stun.l.google.com:19302",
        f"turn:{domain}:3478?transport=tcp",
        f"turns:{domain}:443?transport=tcp"
    ]
    return {"urls": urls, "username": username, "credential": credential, "ttl": ttl}

@router.get("/turn")
async def turn(uid: str = Query("anon")) -> Dict[str, str]:
    """Return time-limited TURN credentials for the given user id."""
    return make_turn_cred(uid)

# ------------------------------
# WebSocket signaling: /signal/ws
# Protocol (JSON):
#  Client -> server:
#   {t:"join", room:"R", id:"peerId", jwt:"..."}
#   {t:"offer"|"answer"|"trickle", to:"peerId", sdp|candidate: ...}
#  Server -> client:
#   {t:"joined", self:"peerId", peers:[...], turn:{...}}
#   {t:"peer-join", id:"peerId"} / {t:"peer-leave", id:"peerId"}
#   {t:"offer"|"answer"|"trickle", from:"peerId", ...}
# ------------------------------
@router.websocket("/signal/ws")
async def signal_ws(ws: WebSocket):
    await ws.accept()
    peer_id: Optional[str] = None
    room_name: Optional[str] = None
    try:
        # Expect first message to be a join
        raw = await ws.receive_text()
        msg = json.loads(raw)
        if msg.get("t") != "join":
            await ws.close(code=4400); return
        room_name = str(msg.get("room") or "default")
        peer_id = str(msg.get("id") or f"peer-{int(time.time()*1000)}")

        room = get_room(room_name)
        # Notify existing peers about this join
        for pid, other in list(room.clients.items()):
            if other.client_state == WebSocketState.CONNECTED:
                await other.send_text(json.dumps({"t":"peer-join","id":peer_id}))

        # Add to room and ack
        room.clients[peer_id] = ws
        await ws.send_text(json.dumps({
            "t": "joined",
            "self": peer_id,
            "peers": [pid for pid in room.clients.keys() if pid != peer_id],
            "turn": make_turn_cred(peer_id)
        }))

        # Main loop: relay offer/answer/candidates and simple chat
        while True:
            raw = await ws.receive_text()
            m = json.loads(raw)
            t = m.get("t")
            if t in ("offer","answer","trickle","dm","moderation"):
                to = m.get("to")
                if not to:
                    continue
                target = get_room(room_name).clients.get(to)
                if target and target.client_state == WebSocketState.CONNECTED:
                    m["from"] = peer_id
                    await target.send_text(json.dumps(m))
            else:
                # Ignore unknown message types; you can add more as needed
                pass
    except WebSocketDisconnect:
        pass
    finally:
        # Cleanup
        if room_name and peer_id:
            room = get_room(room_name)
            # Remove and notify
            if peer_id in room.clients:
                del room.clients[peer_id]
            for pid, other in list(room.clients.items()):
                if other.client_state == WebSocketState.CONNECTED:
                    try:
                        await other.send_text(json.dumps({"t":"peer-leave","id":peer_id}))
                    except Exception:
                        pass
