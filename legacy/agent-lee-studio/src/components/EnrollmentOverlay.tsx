import { Key, RefreshCw, Shield, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { BACKEND_URL } from '../constants';
import { SovereignIdentity } from '../services/SovereignIdentity';

export const EnrollmentOverlay: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [deviceId, setDeviceId] = useState('');
    const [secret, setSecret] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleEnroll = async () => {
        setIsLoading(true);
        try {
            await SovereignIdentity.enroll(deviceId, secret);
            const payload = { probe: 'verify_device_link' };
            const headers = await SovereignIdentity.signRequest(payload);
            const res = await fetch(`${BACKEND_URL}/api/device/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                onComplete();
            } else {
                alert('Verification failed. Check Access ID and Passphrase.');
            }
        } catch (e) {
            alert('Enrollment Error: ' + e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl">
            <div className="w-full max-w-md p-8 glass-card border-studio-accent/30 animate-float">
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-studio-accent/10 border border-studio-accent/30 flex items-center justify-center mb-4 text-studio-accent">
                        <Shield size={32} />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-2 uppercase">Identity Enrollment</h2>
                    <p className="text-studio-text-dim text-xs px-8 leading-relaxed">
                        Secure your neural link. Enter your Access ID and passphrase to bind this terminal.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <Zap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-studio-accent/50" />
                        <input
                            type="text"
                            placeholder="ACCESS ID (e.g. MOBILE_ACCESS)"
                            className="w-full bg-black/40 border border-studio-border-strong rounded-lg py-3 pl-10 pr-4 text-xs font-mono focus:border-studio-accent focus:outline-none transition-all"
                            value={deviceId}
                            onChange={(e) => setDeviceId(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-studio-accent/50" />
                        <input
                            type="password"
                            placeholder="PASSPHRASE"
                            className="w-full bg-black/40 border border-studio-border-strong rounded-lg py-3 pl-10 pr-4 text-xs font-mono focus:border-studio-accent focus:outline-none transition-all"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleEnroll}
                        disabled={isLoading}
                        className="w-full bg-studio-accent/10 hover:bg-studio-accent/20 border border-studio-accent/40 text-studio-accent font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all uppercase text-[10px] tracking-widest mt-6"
                    >
                        {isLoading ? <RefreshCw className="animate-spin" size={14} /> : 'BIND_TERMINAL'}
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-studio-border text-[9px] text-studio-text-muted font-mono flex items-center justify-between">
                    <span>SECURITY_LAYER: V2_HMAC_SIGNED</span>
                    <span className="text-studio-accent/40">MASTER_Sovereign_OS</span>
                </div>
            </div>
        </div>
    );
};
