import fs from 'fs';
import path from 'path';

export interface EnforcementLog {
    timestamp: string;
    type: 'command' | 'export' | 'desktop' | 'deployment';
    action: string;
    details: any;
}

class LoggerService {
    private logDir = path.join(process.cwd(), 'logs');
    private logFile = path.join(this.logDir, 'enforcement.log');

    constructor() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    async log(type: EnforcementLog['type'], action: string, details: any = {}) {
        const entry: EnforcementLog = {
            timestamp: new Date().toISOString(),
            type,
            action,
            details
        };

        const logString = JSON.stringify(entry) + '\n';

        console.log(`[enforcement] Logging ${type}: ${action}`);
        fs.appendFileSync(this.logFile, logString);

        // FUTURE: If InsForge is active, sink logs there too
    }
}

export const loggerService = new LoggerService();
