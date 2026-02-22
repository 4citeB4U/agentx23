/**
 * StitchAgent — Agent Lee's frontend / UI design sub-agent
 *
 * When Agent Lee needs frontend components, UI layouts, or design systems,
 * he dispatches tasks to this agent. Stitch wraps the Stitch MCP preview
 * server (port 8015) and uses the LLM for React/CSS/Tailwind generation.
 *
 * Capabilities:
 *  - scaffold_component   Generate a React/TSX component
 *  - generate_page        Generate a full page layout
 *  - generate_styles      Generate CSS / Tailwind classes
 *  - generate_hook        Generate a React custom hook
 *  - design_system        Generate a design system token file
 *  - preview_url          Return the Stitch preview server URL
 *  - custom               Free-form frontend generation task
 */

import { aiService } from '../services/ai.js';

export interface StitchTask {
    task:    'scaffold_component' | 'generate_page' | 'generate_styles' | 'generate_hook' | 'design_system' | 'preview_url' | 'custom';
    input:   string;
    context?: string;
    framework?: 'react' | 'next' | 'vue';
    styling?:  'tailwind' | 'css-modules' | 'styled-components';
    name?:    string;
}

export interface AgentResult {
    agent:   string;
    task:    string;
    output:  string;
    code?:   string;
    files?:  { path: string; content: string }[];
    preview?: string;
    ok:      boolean;
    error?:  string;
}

const STITCH_SYSTEM = `You are Stitch, Agent Lee's frontend UI design sub-agent.
You specialize in React, TypeScript, Tailwind CSS, and modern UI/UX design patterns.
Generate clean, accessible, production-ready components.
Format code output as:
===FILE: <relative/path/to/file>===
<code here>
===END===
Use the Agent Lee OS dark theme: bg-zinc-900, text-white, accent cyan-400.
Components should feel futuristic, sovereign, and on-brand with Agent Lee OS.`;

const STITCH_PREVIEW_PORT = Number(process.env.STITCH_PORT || 8015);

async function callLLM(prompt: string, systemHint?: string): Promise<string> {
    try {
        const fullPrompt = `${systemHint || STITCH_SYSTEM}\n\n${prompt}`;
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

async function getPreviewUrl(): Promise<string | null> {
    try {
        const r = await fetch(`http://127.0.0.1:${STITCH_PREVIEW_PORT}/health`);
        if (r.ok) return `http://127.0.0.1:${STITCH_PREVIEW_PORT}`;
    } catch { /* not running */ }
    return null;
}

export class StitchAgent {
    readonly name = 'stitch';

    async run(task: StitchTask): Promise<AgentResult> {
        const fw = task.framework || 'react';
        const css = task.styling || 'tailwind';

        if (task.task === 'preview_url') {
            const url = await getPreviewUrl();
            return {
                agent:   this.name,
                task:    'preview_url',
                output:  url || 'Stitch preview server not running',
                preview: url || undefined,
                ok:      !!url,
            };
        }

        let prompt = '';
        switch (task.task) {
            case 'scaffold_component':
                prompt = `Create a ${fw} + ${css} component named "${task.name || 'Component'}" for: "${task.input}".
Include TypeScript props interface, JSX, and styles.
Follow Agent Lee OS dark theme (zinc-900 bg, cyan-400 accents).
${task.context ? `Context: ${task.context}` : ''}
Output using ===FILE: path=== blocks.`;
                break;

            case 'generate_page':
                prompt = `Design a complete ${fw} page for: "${task.input}".
Include layout, responsive design, and all sub-components.
Use ${css} for styling. Agent Lee OS dark futuristic theme.
${task.context ? `Context: ${task.context}` : ''}
Output all files using ===FILE: path=== blocks.`;
                break;

            case 'generate_styles':
                prompt = `Generate ${css} styles/classes for: "${task.input}".
Include responsive variants, hover states, and dark mode.
${task.context ? `Context: ${task.context}` : ''}`;
                break;

            case 'generate_hook':
                prompt = `Create a React custom hook named "${task.name || 'useCustom'}" for: "${task.input}".
Include TypeScript types, error handling, and loading state.
${task.context ? `Context: ${task.context}` : ''}`;
                break;

            case 'design_system':
                prompt = `Create a design system token file for Agent Lee OS.
Theme: "${task.input}".
Include colors, typography, spacing, shadows, and animation tokens.
Output as both CSS custom properties and TypeScript constants.`;
                break;

            case 'custom':
            default:
                prompt = `Frontend task: "${task.input}"
Framework: ${fw}, Styling: ${css}
${task.context ? `Context: ${task.context}` : ''}
Output code using ===FILE: path=== blocks where applicable.`;
        }

        try {
            const raw = await callLLM(prompt);
            const files = parseCodeBlocks(raw);
            const preview = await getPreviewUrl();
            return {
                agent:   this.name,
                task:    task.task,
                output:  raw,
                code:    files.length === 1 ? files[0].content : undefined,
                files:   files.length > 0 ? files : undefined,
                preview: preview || undefined,
                ok:      true,
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

export const stitchAgent = new StitchAgent();
