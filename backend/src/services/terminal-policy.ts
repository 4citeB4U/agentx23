/**
 * Agent Lee — Terminal Policy Engine
 * LEEWAY-CORE-2026 | Non-negotiable command governance
 *
 * Three policy modes:
 *   safe   — read + git + node/py toolchain (default)
 *   build  — adds docker, vite, tsc, eslint
 *   admin  — all of the above + high-risk logging (explicit enable only)
 */

export type PolicyMode = 'safe' | 'build' | 'admin';

export interface PolicyVerdict {
  allowed:    boolean;
  mode:       PolicyMode;
  risk:       'none' | 'low' | 'high' | 'blocked';
  reason?:    string;
  command:    string;
}

// ── Safe-Mode Allowlist (prefix matches) ─────────────────────────────────
const SAFE_COMMANDS = new Set([
  // inquiries
  'ls', 'dir', 'pwd', 'echo', 'cat', 'type', 'Get-Content',
  'Get-Location', 'Set-Location', 'cd',
  // git
  'git',
  // node ecosystem
  'node', 'npm', 'npx', 'pnpm', 'yarn',
  // python
  'python', 'python3', 'pip', 'pip3', 'pytest', 'poetry',
  // build / runtime
  'pm2', 'tsx', 'ts-node',
  // generic network / info
  'curl', 'wget', 'Invoke-WebRequest', 'Invoke-RestMethod',
  'ping', 'nslookup', 'ipconfig', 'ifconfig', 'hostname',
  // process / env info (read-only)
  'Get-Process', 'Get-Service', 'Get-Command', 'Get-Variable',
  'Get-ChildItem', 'Get-Item', 'Test-Path', 'Resolve-Path',
  // editors
  'code',
  // other dev
  'cargo', 'go', 'dotnet', 'java', 'mvn', 'gradle',
  // DB CLI (safe)
  'sqlite3', 'psql',
]);

// Build-mode additions
const BUILD_COMMANDS = new Set([
  'docker', 'docker-compose', 'podman',
  'vite', 'tsc', 'eslint', 'prettier',
  'make', 'cmake',
  'pwsh', 'bash', 'sh',
]);

// ── Hard-Deny Patterns (regex — checked first, always blocked) ────────────
const DENY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Destructive filesystem
  { pattern: /rm\s+-rf?\s+\/([^/]|$)/i,          reason: 'Destructive rm -rf /' },
  { pattern: /rm\s+--force/i,                      reason: 'Forced rm' },
  { pattern: /del\s+\/[sf]/i,                      reason: 'Destructive del /S or /F' },
  { pattern: /\bformat\b.*[a-z]:/i,                reason: 'Disk format attempt' },
  { pattern: /\bdiskpart\b/i,                       reason: 'diskpart (disk partitioning)' },
  { pattern: /\brd\s+\/[sq]/i,                     reason: 'Recursive directory delete (rd /S)' },
  // Credential / registry attacks (Windows)
  { pattern: /reg\s+(export|save|load|import).*(SAM|SYSTEM|SECURITY|NTDS)/i, reason: 'Registry credential dump' },
  { pattern: /mimikatz/i,                           reason: 'Mimikatz credential tool' },
  { pattern: /sekurlsa/i,                           reason: 'Mimikatz LSA dump' },
  // Privilege escalation
  { pattern: /Start-Process.*-Verb\s+RunAs/i,       reason: 'UAC elevation attempt' },
  { pattern: /sudo\s+su\b/i,                        reason: 'Privilege escalation (sudo su)' },
  // Persistence attacks
  { pattern: /schtasks.*\/create/i,                 reason: 'Scheduled task creation (use Admin Mode)' },
  { pattern: /sc\s+create\b/i,                      reason: 'Service creation (use Admin Mode)' },
  { pattern: /New-ScheduledTask/i,                  reason: 'Scheduled task creation' },
  { pattern: /New-Service/i,                        reason: 'Service creation' },
  // Exfiltration
  { pattern: /Compress-Archive.*password/i,          reason: 'Password archive exfil pattern' },
  { pattern: /curl.*\|.*sh/i,                       reason: 'Curl-pipe-shell (code execution from URL)' },
  { pattern: /wget.*-O.*\|.*sh/i,                   reason: 'Wget-pipe-shell' },
  // Keylogger / screen capture abuse
  { pattern: /Get-Clipboard.*loop/i,                reason: 'Clipboard harvesting loop' },
];

// ── Admin High-Risk Commands (allowed but every call gets an ALERT) ───────
const ADMIN_HIGH_RISK: RegExp[] = [
  /shutdown/i, /reboot/i, /Restart-Computer/i,
  /netsh.*firewall/i,
  /iptables/i,
  /chattr\s+\+i/i,
  /passwd\b/i, /useradd/i, /adduser/i,
];

// ── Policy Evaluator ──────────────────────────────────────────────────────
export function evaluateCommand(
  rawCommand: string,
  mode: PolicyMode = 'safe',
): PolicyVerdict {
  const cmd = rawCommand.trim();

  // 1. Hard deny — always blocked regardless of mode
  for (const { pattern, reason } of DENY_PATTERNS) {
    if (pattern.test(cmd)) {
      return { allowed: false, mode, risk: 'blocked', reason, command: cmd };
    }
  }

  // 2. Admin mode — allow everything except hard deny, log high-risk
  if (mode === 'admin') {
    const isHighRisk = ADMIN_HIGH_RISK.some(p => p.test(cmd));
    return {
      allowed: true,
      mode,
      risk:   isHighRisk ? 'high' : 'low',
      reason: isHighRisk ? 'ADMIN-MODE high-risk command — logged' : undefined,
      command: cmd,
    };
  }

  // 3. Extract base command (first token)
  const base = cmd.split(/[\s|;&]+/)[0]?.toLowerCase() || '';

  if (SAFE_COMMANDS.has(base)) {
    return { allowed: true, mode, risk: 'none', command: cmd };
  }

  if (mode === 'build' && BUILD_COMMANDS.has(base)) {
    return { allowed: true, mode, risk: 'low', command: cmd };
  }

  // 4. Not in allowlist for current mode
  return {
    allowed: false,
    mode,
    risk:    'blocked',
    reason:  `Command "${base}" not in ${mode}-mode allowlist. Switch to build/admin mode or use an approved command.`,
    command: cmd,
  };
}

// ── Sanitise command for safe logging (strip secrets) ────────────────────
export function sanitiseForLog(cmd: string): string {
  return cmd
    .replace(/--password[=\s]\S+/gi, '--password=***')
    .replace(/--token[=\s]\S+/gi, '--token=***')
    .replace(/(-p|--pass)\s+\S+/gi, '$1 ***')
    .replace(/ik_[a-zA-Z0-9]+/g, 'ik_***')
    .replace(/postgresql:\/\/[^@]+@/g, 'postgresql://***@');
}
