/**
 * AGENT LEE — CODE INSPECTOR
 * Pre-Execution Code Risk Scanner | LEEWAY-CORE-2026
 *
 * Every piece of code Agent Lee generates must be scanned
 * before execution. HIGH risk = requires creator authorization.
 */

import { createHash } from 'crypto';

// Patterns that indicate high-risk system operations
const DANGEROUS_PATTERNS: { pattern: RegExp; label: string; severity: 'HIGH' | 'CRITICAL' }[] = [
  // Process execution
  { pattern: /require\(['"]child_process['"]\)/g, label: 'child_process import', severity: 'CRITICAL' },
  { pattern: /\.exec\s*\(/g, label: 'exec() call', severity: 'CRITICAL' },
  { pattern: /\.spawn\s*\(/g, label: 'spawn() call', severity: 'CRITICAL' },
  { pattern: /\.execSync\s*\(/g, label: 'execSync() call', severity: 'CRITICAL' },
  { pattern: /new\s+Function\s*\(/g, label: 'new Function() eval', severity: 'CRITICAL' },
  { pattern: /\beval\s*\(/g, label: 'eval() call', severity: 'CRITICAL' },

  // Filesystem danger
  { pattern: /fs\.unlink\s*\(/g, label: 'fs.unlink (file delete)', severity: 'CRITICAL' },
  { pattern: /fs\.rm\s*\(/g, label: 'fs.rm (recursive delete)', severity: 'CRITICAL' },
  { pattern: /fs\.writeFile\s*\(/g, label: 'fs.writeFile', severity: 'HIGH' },
  { pattern: /fs\.appendFile\s*\(/g, label: 'fs.appendFile', severity: 'HIGH' },
  { pattern: /fs\.rename\s*\(/g, label: 'fs.rename', severity: 'HIGH' },
  { pattern: /rmdir|rimraf/g, label: 'directory removal', severity: 'CRITICAL' },

  // Network
  { pattern: /net\.createConnection\s*\(/g, label: 'raw TCP connection', severity: 'HIGH' },
  { pattern: /dgram\.createSocket\s*\(/g, label: 'UDP socket', severity: 'HIGH' },
  { pattern: /new\s+WebSocket\s*\(/g, label: 'WebSocket creation', severity: 'HIGH' },

  // Docker & containers
  { pattern: /docker\s+(exec|run|rm|pull|push)/gi, label: 'Docker exec/run', severity: 'CRITICAL' },

  // PowerShell & system commands
  { pattern: /Remove-Item|rm\s+-rf|del\s+\/f/gi, label: 'destructive shell command', severity: 'CRITICAL' },
  { pattern: /Start-Process|Invoke-Expression|IEX\s*\(/gi, label: 'PowerShell execution', severity: 'CRITICAL' },
  { pattern: /Invoke-WebRequest|curl\s+http/gi, label: 'outbound download', severity: 'HIGH' },

  // Registry
  { pattern: /HKEY_|regedit|reg\s+add|reg\s+delete/gi, label: 'registry operation', severity: 'CRITICAL' },

  // Package management
  { pattern: /npm\s+install|pip\s+install|yarn\s+add/g, label: 'package install', severity: 'HIGH' },

  // Crypto key exposure
  { pattern: /private\.pem|\.key\b|BEGIN\s+(RSA\s+)?PRIVATE/gi, label: 'private key exposure', severity: 'CRITICAL' },

  // Exfil patterns
  { pattern: /process\.env\b/g, label: 'env var access', severity: 'HIGH' },
];

export interface CodeAnalysis {
  hash: string;
  riskLevel: 'LOW' | 'HIGH' | 'CRITICAL';
  findings: { label: string; severity: string; match: string }[];
  lineCount: number;
  requiresCreatorSignature: boolean;
  securityDeclarationPresent: boolean;
  summary: string;
}

export function analyzeCode(code: string): CodeAnalysis {
  const hash = createHash('sha256').update(code).digest('hex');
  const findings: { label: string; severity: string; match: string }[] = [];

  for (const { pattern, label, severity } of DANGEROUS_PATTERNS) {
    const matches = code.match(pattern);
    if (matches) {
      findings.push({ label, severity, match: matches[0] });
    }
  }

  const hasCritical = findings.some(f => f.severity === 'CRITICAL');
  const hasHigh = findings.some(f => f.severity === 'HIGH');
  const riskLevel = hasCritical ? 'CRITICAL' : hasHigh ? 'HIGH' : 'LOW';

  const securityDeclarationPresent = /AGENT LEE SECURITY DECLARATION/i.test(code);

  const summary = findings.length === 0
    ? 'Code appears safe. No dangerous patterns detected.'
    : `${findings.length} risk pattern(s) found: ${findings.map(f => f.label).join(', ')}.`;

  return {
    hash,
    riskLevel,
    findings,
    lineCount: code.split('\n').length,
    requiresCreatorSignature: hasCritical,
    securityDeclarationPresent,
    summary
  };
}

// Generate the security declaration block for Agent Lee to prepend to generated code
export function generateSecurityDeclaration(
  permissions: string[],
  riskLevel: 'LOW' | 'HIGH' | 'CRITICAL',
  reviewed = false
): string {
  return `/*
AGENT LEE SECURITY DECLARATION
Generated: ${new Date().toISOString()}
Standard: LEEWAY-CORE-2026

Permissions Required:
${permissions.map(p => `- ${p}`).join('\n')}

Risk Level: ${riskLevel}
Reviewed: ${reviewed}
Guardian Authorized: false (pending)
*/
`;
}

export default { analyzeCode, generateSecurityDeclaration };
