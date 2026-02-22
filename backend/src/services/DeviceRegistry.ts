import fs from 'fs/promises';
import path from 'path';

/**
 * DEVICE REGISTRY
 * Manages authorized devices and their public/secret keys.
 * For this initial implementation, we store keys in a local JSON (Sovereign Storage).
 */

interface DeviceRecord {
    id: string;
    secret: string;
    nickname: string;
    status: 'active' | 'revoked';
    level: number; // 1: Read, 2: Write, 4: Admin, 8: Desktop
}

const REGISTRY_PATH = path.resolve('c:\\Tools\\Portable-VSCode-MCP-Kit\\workspace\\devices.json');

export class DeviceRegistry {
    private static devices: Record<string, DeviceRecord> = {};
    private static loadPromise: Promise<void> | null = null;

    static async load() {
        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = (async () => {
            try {
                try {
                    const data = await fs.readFile(REGISTRY_PATH, 'utf-8');
                    this.devices = JSON.parse(data);
                } catch {
                    // If doesn't exist or is invalid, start with empty.
                    this.devices = {};
                }

                const envDeviceId = process.env.DEVICE_ID?.trim();
                const envSecret = process.env.CRYPTO_SECRET?.trim();

                if (envDeviceId && envSecret) {
                    const existing = this.devices[envDeviceId];
                    this.devices[envDeviceId] = {
                        id: envDeviceId,
                        secret: envSecret,
                        nickname: existing?.nickname || 'Env Bound Device',
                        status: 'active',
                        level: existing?.level || 4
                    };

                    // Never allow registry persistence issues to deadlock request handling.
                    try {
                        await this.save();
                    } catch (error) {
                        console.error('[DeviceRegistry] Failed to persist env-bound device:', error);
                    }
                }
            } catch (error) {
                // Critical: do not rethrow. Async Express middleware will hang requests on rejected promises.
                console.error('[DeviceRegistry] Load failure (continuing with in-memory registry):', error);
                this.devices = this.devices || {};
            }
        })();

        return this.loadPromise;
    }

    static async ensureReady() {
        await this.load();
    }

    static async save() {
        await fs.writeFile(REGISTRY_PATH, JSON.stringify(this.devices, null, 2));
    }

    static getDevice(id: string): DeviceRecord | undefined {
        const device = this.devices[id];
        if (device && device.status === 'active') return device;
        return undefined;
    }

    static async registerDevice(id: string, secret: string, nickname: string) {
        this.devices[id] = { id, secret, nickname, status: 'active', level: 1 };
        await this.save();
    }

    static async revokeDevice(id: string) {
        if (this.devices[id]) {
            this.devices[id].status = 'revoked';
            await this.save();
        }
    }
}
