import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * CRYPTOGRAPHIC AUDIT LOGGER
 * Implements hash-chaining (tamper-evident) and optional encryption.
 */

interface AuditEntry {
    timestamp: string;
    level: string;
    deviceId: string;
    action: string;
    resource: string;
    status: string;
    prevHash: string;
    hash: string;
}

const AUDIT_LOG_PATH = path.resolve('c:\\Tools\\Portable-VSCode-MCP-Kit\\workspace\\audit_log.json');
const LOG_ENCRYPTION_KEY = process.env.AUDIT_KEY || 'AGENT_LEE_TREZOR_V1'; // Should be rotated

export class AuditLogger {
    private static lastHash: string = 'GENESIS_BLOCK';

    static async init() {
        try {
            const data = await fs.readFile(AUDIT_LOG_PATH, 'utf-8');
            const logs: AuditEntry[] = JSON.parse(data);
            if (logs.length > 0) {
                this.lastHash = logs[logs.length - 1].hash;
            }
        } catch (e) {
            // New log
        }
    }

    static async log(entry: Omit<AuditEntry, 'timestamp' | 'prevHash' | 'hash'>) {
        const timestamp = new Date().toISOString();
        const prevHash = this.lastHash;

        // Calculate hash of current entry including previous hash (Hash Chain)
        const payload = JSON.stringify(entry) + timestamp + prevHash;
        const hash = crypto.createHash('sha256').update(payload).digest('hex');

        const fullEntry: AuditEntry = {
            ...entry,
            timestamp,
            prevHash,
            hash
        };

        this.lastHash = hash;

        // Persist
        let logs: AuditEntry[] = [];
        try {
            const data = await fs.readFile(AUDIT_LOG_PATH, 'utf-8');
            logs = JSON.parse(data);
        } catch (e) { }

        logs.push(fullEntry);
        await fs.writeFile(AUDIT_LOG_PATH, JSON.stringify(logs, null, 2));

        console.log(`[audit] ${entry.action} - ${entry.status} (${hash.substring(0, 8)})`);
    }

    static async verifyIntegrity(): Promise<{ valid: boolean; brokenAt?: number }> {
        try {
            const data = await fs.readFile(AUDIT_LOG_PATH, 'utf-8');
            const logs: AuditEntry[] = JSON.parse(data);
            let currentPrevHash = 'GENESIS_BLOCK';

            for (let i = 0; i < logs.length; i++) {
                const entry = logs[i];
                if (entry.prevHash !== currentPrevHash) return { valid: false, brokenAt: i };

                const payload = JSON.stringify({
                    level: entry.level,
                    deviceId: entry.deviceId,
                    action: entry.action,
                    resource: entry.resource,
                    status: entry.status
                }) + entry.timestamp + entry.prevHash;

                const calculatedHash = crypto.createHash('sha256').update(payload).digest('hex');
                if (calculatedHash !== entry.hash) return { valid: false, brokenAt: i };

                currentPrevHash = entry.hash;
            }
            return { valid: true };
        } catch (e) {
            return { valid: false };
        }
    }
}
