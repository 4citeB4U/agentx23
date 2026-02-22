import path from 'path';

/**
 * SOVEREIGN EXECUTION SANDBOX
 * Prevents AI from executing unsafe shell commands.
 */

const ALLOWED_COMMANDS = [
    'npm run',
    'npm install',
    'git status',
    'git commit',
    'git push',
    'git add',
    'git log',
    'tsx',
    'node',
    'python',
    'ls',
    'dir',
    'cat',
    'type',
    'echo'
];

const BLOCKED_STRINGS = [
    'rm -rf',
    'del /s',
    'format c:',
    'reg delete',
    '> /dev/null',
    'chmod 777',
    'sudo',
    'net user',
    '>> /etc/',
    'powershell -e'
];

const WORKSPACE_ROOT = path.resolve('c:\\Tools\\Portable-VSCode-MCP-Kit');

export class ExecutionValidator {
    static validateCommand(command: string): { safe: boolean; reason?: string } {
        const lowerCmd = command.toLowerCase();

        // 1. Block known dangerous strings
        for (const blocked of BLOCKED_STRINGS) {
            if (lowerCmd.includes(blocked.toLowerCase())) {
                return { safe: false, reason: `DANGEROUS_COMMAND_DETECTED: "${blocked}"` };
            }
        }

        // 2. Ensure command starts with an allowed base
        const isAllowedBase = ALLOWED_COMMANDS.some(allowed => lowerCmd.startsWith(allowed.toLowerCase()));
        if (!isAllowedBase) {
            // We allow some flexibility but broadly check for common utilities
            // If it's a direct path execution, we must ensure it's within the jail
            if (command.includes('/') || command.includes('\\\\')) {
                const resolvedPart = path.resolve(command.split(' ')[0]);
                if (!resolvedPart.startsWith(WORKSPACE_ROOT)) {
                    return { safe: false, reason: 'PATH_OUTSIDE_JAIL' };
                }
            } else {
                return { safe: false, reason: 'COMMAND_NOT_IN_ALLOWLIST' };
            }
        }

        return { safe: true };
    }
}
