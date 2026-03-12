/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.PHONEVIEW.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = PhoneView module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\PhoneView.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

import { Loader2, Smartphone, Usb, Wifi, WifiOff } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const PHONE_BRIDGE_URL = "http://localhost:8008";
const BRIDGE_STATUS_URL = "/api/phone/status";

interface PhoneStatus {
  bridgeOnline: boolean;
  deviceConnected: boolean;
  deviceName?: string;
  adbHost?: string;
  streamUrl?: string;
  error?: string;
}

export const PhoneView: React.FC = () => {
  const [status, setStatus] = useState<PhoneStatus>({
    bridgeOnline: false,
    deviceConnected: false,
  });
  const [loading, setLoading] = useState(true);
  const [adbHost, setAdbHost] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const handshake = (import.meta as any).env.VITE_NEURAL_HANDSHAKE || "";
      const r = await fetch(BRIDGE_STATUS_URL, {
        headers: { "x-neural-handshake": handshake },
      });
      if (r.ok) {
        const data = await r.json();
        setStatus(data);
      } else {
        setStatus({
          bridgeOnline: false,
          deviceConnected: false,
          error: `HTTP ${r.status}`,
        });
      }
    } catch {
      setStatus({
        bridgeOnline: false,
        deviceConnected: false,
        error: "Bridge offline",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleConnect = async () => {
    if (!adbHost.trim()) return;
    setConnecting(true);
    setConnectError("");
    try {
      const handshake = (import.meta as any).env.VITE_NEURAL_HANDSHAKE || "";
      const r = await fetch("/api/phone/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-neural-handshake": handshake,
        },
        body: JSON.stringify({ adbHost: adbHost.trim() }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        await fetchStatus();
      } else {
        setConnectError(data.error || "Connection failed");
      }
    } catch (e: unknown) {
      setConnectError(e instanceof Error ? e.message : "Connection error");
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20} />
        <span className="text-sm font-mono">Checking phone bridge...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-black/30 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-cyan-400" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-cyan-400">
            Phone Mirror
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Bridge status */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono ${status.bridgeOnline ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-red-500/40 text-red-400 bg-red-500/10"}`}
          >
            {status.bridgeOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
            {status.bridgeOnline ? "bridge online" : "bridge offline"}
          </div>
          {/* Device status */}
          {status.bridgeOnline && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono ${status.deviceConnected ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10" : "border-gray-500/40 text-gray-500"}`}
            >
              <Usb size={10} />
              {status.deviceConnected
                ? status.deviceName || "device connected"
                : "no device"}
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      {status.bridgeOnline && status.deviceConnected ? (
        /* Live mirror iframe */
        <div className="flex-1 flex items-center justify-center bg-black p-4">
          <div className="relative h-full max-h-[700px] w-auto aspect-[9/19.5] border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,240,255,0.08)]">
            <iframe
              ref={iframeRef}
              src={status.streamUrl || PHONE_BRIDGE_URL}
              className="w-full h-full border-none bg-black"
              allow="fullscreen"
              title="Android Phone Mirror"
            />
          </div>
        </div>
      ) : (
        /* Setup / connect panel */
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          {!status.bridgeOnline ? (
            /* Bridge offline — setup instructions */
            <div className="max-w-md w-full space-y-6">
              <div className="text-center">
                <Smartphone size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 text-sm leading-relaxed">
                  The{" "}
                  <span className="text-cyan-400 font-mono">
                    AgentLee-PhoneBridge
                  </span>{" "}
                  PM2 service is offline.
                </p>
              </div>
              <div className="bg-black/40 border border-white/10 rounded-xl p-5 space-y-3">
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500">
                  Setup — run once
                </p>
                <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">{`# 1. Clone ws-scrcpy
git clone https://github.com/NetrisTV/ws-scrcpy phone-bridge
cd phone-bridge && npm install && npm run build

# 2. Start via PM2
npx pm2 start ecosystem.config.cjs --only AgentLee-PhoneBridge

# 3. Enable ADB Wi-Fi on phone
adb tcpip 5555`}</pre>
              </div>
            </div>
          ) : (
            /* Bridge online but no device — connect form */
            <div className="max-w-sm w-full space-y-4">
              <div className="text-center">
                <Usb size={40} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm">
                  Enter your phone's Wi-Fi IP to connect via ADB
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adbHost}
                  onChange={(e) => setAdbHost(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  placeholder="192.168.x.x:5555"
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={handleConnect}
                  disabled={connecting || !adbHost.trim()}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 disabled:opacity-40 transition-all"
                >
                  {connecting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </button>
              </div>
              {connectError && (
                <p className="text-red-400 text-xs font-mono text-center">
                  {connectError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
