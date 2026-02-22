/**
 * RESOURCE GOVERNOR
 * Enforces quotas and circuit breakers for AI and file operations.
 */

interface QuotaState {
    requests: number;
    lastReset: number;
}

const QUOTAS: Record<string, { limit: number; windowMs: number }> = {
    'ai_chat': { limit: 50, windowMs: 3600000 }, // 50 requests per hour
    'file_read': { limit: 500, windowMs: 3600000 },
    'file_write': { limit: 100, windowMs: 3600000 }
};

const state: Record<string, QuotaState> = {};

export class ResourceGovernor {
    private static isLocked = false;

    static checkQuota(type: string, deviceId: string): { allowed: boolean; reason?: string } {
        if (this.isLocked) return { allowed: false, reason: 'SYSTEM_LOCKDOWN_ACTIVE' };

        const key = `${type}:${deviceId}`;
        const now = Date.now();
        const config = QUOTAS[type] || { limit: 100, windowMs: 3600000 };

        if (!state[key]) {
            state[key] = { requests: 0, lastReset: now };
        }

        const record = state[key];

        // Reset window
        if (now - record.lastReset > config.windowMs) {
            record.requests = 0;
            record.lastReset = now;
        }

        if (record.requests >= config.limit) {
            return { allowed: false, reason: `QUOTA_EXCEEDED: ${type}` };
        }

        record.requests++;
        return { allowed: true };
    }

    static toggleSafeMode(locked: boolean) {
        this.isLocked = locked;
        console.log(`[security] Safe Mode (Read-Only) Toggled: ${locked}`);
    }

    static status() {
        return { isLocked: this.isLocked };
    }
}
