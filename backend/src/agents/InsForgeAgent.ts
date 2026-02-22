/**
 * InsForgeAgent — Agent Lee's backend code-generation sub-agent
 *
 * When Agent Lee needs backend services, APIs, or infrastructure created
 * (for an app or for himself), he dispatches tasks to this agent.
 *
 * Capabilities:
 *  - scaffold_api       Generate a REST API scaffold (Express/FastAPI)
 *  - generate_route     Add a new route to an existing codebase
 *  - generate_schema    Generate DB schema / migration
 *  - generate_service   Generate a service layer file
 *  - review_code        Analyze code and return improvement suggestions
 *  - custom             Free-form backend code generation task
 */

import { aiService } from '../services/ai.js';

export interface InsForgeTask {
    task:    'scaffold_api' | 'generate_route' | 'generate_schema' | 'generate_service' | 'review_code' | 'custom';
    input:   string;          // free-text description / code snippet
    context?: string;         // optional extra context
    lang?:   'typescript' | 'python' | 'javascript';  // default: typescript
    name?:   string;          // optional artifact name
}

export interface AgentResult {
    agent:   string;
    task:    string;
    output:  string;
    code?:   string;
    files?:  { path: string; content: string }[];
    meta?:   Record<string, unknown>;
    ok:      boolean;
    error?:  string;
}

const INSFORGE_SYSTEM = `You are InsForge, Agent Lee's backend engineering sub-agent.
You specialize in TypeScript, Python, Node.js, REST APIs, database schemas, and service architecture.
When given a task, output production-quality code with clear file paths and concise explanations.
Format code output as:
===FILE: <relative/path/to/file>===
<code here>
===END===
Use multiple FILE blocks for multiple files. Always be direct and technical.`;

async function callLLM(prompt: string, systemHint?: string): Promise<string> {
    try {
        const fullPrompt = `${systemHint || INSFORGE_SYSTEM}\n\n${prompt}`;
        return await aiService.process(fullPrompt);
    } catch (err: any) {
        throw new Error(`LLM call failed: ${err.message}`);
    }
}

function parseCodeBlocks(raw: string): { path: string; content: string }[] {
    const files: { path: string; content: string }[] = [];
    const re = /===FILE:\s*(.+?)===\s*([\s\S]*?)===END===/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
        files.push({ path: m[1].trim(), content: m[2].trim() });
    }
    return files;
}

export class InsForgeAgent {
    readonly name = 'insforge';

    async run(task: InsForgeTask): Promise<AgentResult> {
        const lang = task.lang || 'typescript';
        let prompt = '';

        switch (task.task) {
            case 'scaffold_api':
                prompt = `Scaffold a complete ${lang} API for: "${task.input}".
Include: index file, router, controller, service layer, and basic types.
${task.context ? `Context: ${task.context}` : ''}
Output all files using ===FILE: path=== blocks.`;
                break;

            case 'generate_route':
                prompt = `Generate a new ${lang} Express route for: "${task.input}".
Include validation, error handling, and service call.
${task.context ? `Existing context:\n${task.context}` : ''}`;
                break;

            case 'generate_schema':
                prompt = `Generate a database schema/migration for: "${task.input}".
Include TypeScript types and SQL/Prisma/Drizzle schema.
${task.context ? `Context: ${task.context}` : ''}`;
                break;

            case 'generate_service':
                prompt = `Generate a ${lang} service file for: "${task.input}".
Name: ${task.name || 'generated'}.service.ts
Include interface, implementation, and error handling.
${task.context ? `Context: ${task.context}` : ''}`;
                break;

            case 'review_code':
                prompt = `Review this code and provide improvement suggestions, security issues, and refactoring advice:
\`\`\`${lang}
${task.input}
\`\`\``;
                break;

            case 'custom':
            default:
                prompt = `Backend engineering task: "${task.input}"
${task.context ? `Context: ${task.context}` : ''}
Language preference: ${lang}
Output code using ===FILE: path=== blocks where applicable.`;
        }

        try {
            const raw = await callLLM(prompt);
            const files = parseCodeBlocks(raw);
            return {
                agent:  this.name,
                task:   task.task,
                output: raw,
                code:   files.length === 1 ? files[0].content : undefined,
                files:  files.length > 0 ? files : undefined,
                ok:     true,
            };
        } catch (err: any) {
            return {
                agent:  this.name,
                task:   task.task,
                output: '',
                ok:     false,
                error:  err.message,
            };
        }
    }
}

export const insForgAgent = new InsForgeAgent();
