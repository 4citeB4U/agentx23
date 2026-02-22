/**
 * SplineAgent — Agent Lee's 3D design & WebGL sub-agent
 *
 * When Agent Lee needs 3D scenes, interactive WebGL experiences,
 * or Spline design assets, he dispatches to this agent.
 *
 * Spline Design: https://spline.design
 * Team invite:   https://app.spline.design/team-invitation/e6646575-c700-467b-8304-579fdebc4c28
 *
 * Capabilities:
 *  - embed_scene        Generate React embed code for a Spline scene URL
 *  - generate_animation Generate Spline-compatible animation config JSON
 *  - scaffold_3d_page   Scaffold a full React page with Spline background
 *  - design_brief       Generate a design brief for a Spline scene
 *  - orb_component      Generate Agent Lee's signature CSS/Spline orb component
 *  - status             Check Spline API connectivity
 */

import { aiService } from '../services/ai.js';

export interface SplineTask {
    task:   'embed_scene' | 'generate_animation' | 'scaffold_3d_page' | 'design_brief' | 'orb_component' | 'status';
    input:  string;          // scene URL, description, or query
    sceneUrl?: string;       // Spline public scene URL
    context?:  string;
}

export interface AgentResult {
    agent:   string;
    task:    string;
    output:  string;
    code?:   string;
    files?:  { path: string; content: string }[];
    ok:      boolean;
    error?:  string;
}

const SPLINE_SYSTEM = `You are Spline, Agent Lee's 3D design and WebGL sub-agent.
You specialize in Spline Design (spline.design), @splinetool/react-spline, Three.js, and interactive 3D web experiences.
Generate production-ready React components that embed Spline scenes.
Use the @splinetool/react-spline npm package for React embeds.
Agent Lee OS aesthetic: dark, cyberpunk, iridescent 3D orbs, flowing liquid metal, deep space backgrounds.
Format code output as:
===FILE: <relative/path/to/file>===
<code here>
===END===`;

// Spline public API base (for scene metadata — unauthenticated read)
const SPLINE_API = 'https://prod.spline.design';

async function callLLM(prompt: string): Promise<string> {
    try {
        const fullPrompt = `${SPLINE_SYSTEM}\n\n${prompt}`;
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

async function checkSplineApi(): Promise<boolean> {
    try {
        const r = await fetch(`${SPLINE_API}/`, { signal: AbortSignal.timeout(5000) });
        return r.status < 500;
    } catch { return false; }
}

export class SplineAgent {
    readonly name = 'spline';

    /** Team invitation URL for Agent Lee's Spline workspace */
    readonly teamInviteUrl = 'https://app.spline.design/team-invitation/e6646575-c700-467b-8304-579fdebc4c28';

    async run(task: SplineTask): Promise<AgentResult> {
        if (task.task === 'status') {
            const apiOk = await checkSplineApi();
            return {
                agent:  this.name,
                task:   'status',
                output: JSON.stringify({
                    api_reachable: apiOk,
                    team_invite:   this.teamInviteUrl,
                    package:       '@splinetool/react-spline',
                    install_cmd:   'npm install @splinetool/react-spline @splinetool/runtime',
                }, null, 2),
                ok: true,
            };
        }

        let prompt = '';
        switch (task.task) {
            case 'embed_scene':
                prompt = `Generate a React TypeScript component that embeds this Spline scene:
URL: "${task.sceneUrl || task.input}"
Use @splinetool/react-spline.
Include: loading state, error boundary, responsive container, onLoad handler.
The component should feel like part of Agent Lee OS (dark bg, hidden until loaded).
${task.context ? `Context: ${task.context}` : ''}
Output using ===FILE: path=== blocks.`;
                break;

            case 'generate_animation':
                prompt = `Generate Spline-compatible animation configuration or Three.js animation code for: "${task.input}".
Include: timeline, easing, trigger events (onLoad, onClick, onHover).
${task.context ? `Context: ${task.context}` : ''}`;
                break;

            case 'scaffold_3d_page':
                prompt = `Scaffold a complete React page with a Spline 3D background for: "${task.input}".
Spline scene URL: "${task.sceneUrl || 'https://prod.spline.design/YOUR_SCENE/scene.splinecode'}"
Include: SplineScene background, overlay content, responsive layout.
Use @splinetool/react-spline and Tailwind CSS.
Agent Lee OS cyberpunk dark theme.
${task.context ? `Context: ${task.context}` : ''}
Output all files using ===FILE: path=== blocks.`;
                break;

            case 'design_brief':
                prompt = `Write a Spline 3D design brief for: "${task.input}".
Include: scene concept, color palette, lighting setup, animations, interactivity, and export format.
Agent Lee OS aesthetic: iridescent orbs, liquid metal, deep space, cyan accents.`;
                break;

            case 'orb_component':
                prompt = `Create Agent Lee's signature 3D orb component using Spline + React.
Description: "${task.input}"
Requirements:
- Use @splinetool/react-spline if a scene URL is provided, else CSS + WebGL fallback
- Orb should pulse, breathe, and react to hover
- Colors: cyan-400 to purple-600 gradient, iridescent sheen
- Include CssOrb fallback for environments without WebGL
${task.sceneUrl ? `Spline scene: ${task.sceneUrl}` : ''}
${task.context ? `Context: ${task.context}` : ''}
Output using ===FILE: path=== blocks.`;
                break;

            default:
                prompt = `3D/Spline design task: "${task.input}"
${task.context ? `Context: ${task.context}` : ''}
Use @splinetool/react-spline where applicable.`;
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

export const splineAgent = new SplineAgent();
