#!/usr/bin/env node
/**
 * Spline MCP Server
 * Helps create 3D objects and scenes using Spline's AI and runtime API.
 * - Generate reference images via InsForge AI for use with Spline Image-to-3D
 * - Create embed HTML pages with @splinetool/runtime
 * - Generate interaction code for Spline scenes
 * - Provide prompting guides and workflow instructions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@insforge/sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Config ──────────────────────────────────────────────────────────────────
const INSFORGE_URL     = process.env.INSFORGE_PROJECT_URL || 'https://3c4cp27v.us-west.insforge.app';
const INSFORGE_ANON    = process.env.INSFORGE_API_KEY     || '';
const DEFAULT_IMG_DIR  = path.join(os.homedir(), 'SplineAssets');

const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON });

// ── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function text(str) {
  return { type: 'text', text: str };
}

// ── Tool Handlers ─────────────────────────────────────────────────────────────

// 1. Prompt Guide
function splinePromptGuide() {
  return `# Spline AI 3D Generation — Prompt Guide

## Where to Use These Prompts
1. Go to https://spline.design → Dashboard → "Generate" tab (AI 3D generation)
2. OR open any Spline file → click the "AI" button in the toolbar → "AI Generate"

## Text-to-3D Tips
- **Focus on a single object**: "a ceramic coffee mug" not "a coffee shop scene"
- **Close-ups give more detail**: "a close-up of an astronaut helmet visor" vs "astronaut"
- **Organic shapes work better**: rocks, plants, animals, food > mechanical parts with sharp edges
- **Specify material/texture**: "a polished marble sphere", "a rough stone gargoyle"
- **Keep it simple first**: generate a clean base mesh, then texture in the editor

## Image-to-3D Tips
- Use a **front-facing, isolated object** on a clean/white background
- Single object per image — no busy scenes
- Square images (1:1 ratio) work best
- High contrast between object and background helps depth estimation
- Avoid extreme lighting (harsh shadows confuse the depth model)

## Text + Image Prompts (Combined)
- Upload a reference image AND add text to guide style:
  - Image: photo of a sneaker | Prompt: "low-poly cartoon style sneaker"
  - Image: sketch of a dragon | Prompt: "detailed scales, emerald green color"

## Recommended Prompt Patterns
| Goal               | Prompt Example                                           |
|--------------------|----------------------------------------------------------|
| Product / object   | "a minimalist white wireless headphone, studio lighting" |
| Character          | "close-up of a cute robot head with glowing blue eyes"   |
| Nature             | "a detailed oak leaf with veins, macro photography"      |
| Food               | "a glazed donut with pink frosting and sprinkles"        |
| Architecture       | "a miniature lighthouse model, clean surfaces"           |
| Sci-fi prop        | "a futuristic energy core cylinder, glowing purple"      |
| Organic shape      | "a smooth river pebble with subtle surface variation"    |

## After Generation
1. Select the best preview from the 4 image options Spline shows
2. Spline generates the 3D mesh — wait ~30-60 seconds
3. Import into your scene or edit mesh in the Spline editor
4. Apply materials (color layers, noise, gradient, fresnel) in the right panel
5. Export as GLB/GLTF, USDZ, STL, or embed via Code API
`;
}

// 2. Generate Image via InsForge AI
async function splineGenerateImage(args) {
  const {
    prompt,
    style = 'photorealistic',
    width = 1024,
    height = 1024,
    outputDir = DEFAULT_IMG_DIR,
    filename,
  } = args;

  const styleHints = {
    photorealistic: 'photorealistic, studio lighting, white background, single object, front-facing, high detail',
    illustration:   'clean illustration, flat white background, single object centered, bold colors',
    '3d_render':    '3D render, clay material, soft studio lighting, white background, single hero object',
    sketch:         'pencil sketch, clean lines, white background, single object, concept art style',
  };

  const enhancedPrompt = `${prompt}, ${styleHints[style] || styleHints.photorealistic}`;

  let response;
  try {
    response = await insforge.ai.images.generate({
      model: 'google/gemini-3-pro-image-preview',
      prompt: enhancedPrompt,
      width,
      height,
    });
  } catch (err) {
    // Fallback to a more widely available model
    try {
      response = await insforge.ai.images.generate({
        model: 'openai/dall-e-3',
        prompt: enhancedPrompt,
        size: '1024x1024',
      });
    } catch (err2) {
      return `Failed to generate image.\nPrimary error: ${err.message}\nFallback error: ${err2.message}`;
    }
  }

  const imageData = response?.data?.[0];
  if (!imageData?.b64_json) {
    return `Image generated but no base64 data returned. Response: ${JSON.stringify(response)}`;
  }

  ensureDir(outputDir);
  const ts = Date.now();
  const safeName = filename || `spline-ref-${ts}.png`;
  const filePath = path.join(outputDir, safeName);
  fs.writeFileSync(filePath, Buffer.from(imageData.b64_json, 'base64'));

  return `✅ Image generated and saved!

**File path**: ${filePath}
**Prompt used**: "${enhancedPrompt}"
**Style**: ${style}
**Dimensions**: ${width}×${height}

## Next Steps — Use in Spline Image-to-3D
1. Open https://spline.design → Dashboard → "Generate" tab
   OR: Open Spline editor → AI button → "AI Generate"
2. Click "Upload Image" and select the file above
3. Optionally add a text prompt to guide the 3D style
4. Click Generate → pick the best preview → let Spline build the 3D mesh
5. Import the mesh into your scene and apply materials

## Quick Tips for Best Results
- The image has a clean background which is ideal for depth estimation
- If the result isn't great, try cropping to focus on the main object
- For finer details, add a text prompt alongside: e.g. "ceramic texture, glossy"
`;
}

// 3. Workflow Guide
function splineWorkflowGuide(args) {
  const { method = 'text' } = args; // 'text' | 'image' | 'combined'

  const guides = {
    text: `# Spline Text-to-3D Workflow

## Step 1 — Access AI Generation
- **Dashboard**: spline.design → Sign in → "Generate" tab (left sidebar)
- **In editor**: Open/create a file → Toolbar AI button → "AI Generate"

## Step 2 — Write Your Prompt
- Describe a SINGLE object with material and style
- Example: "a polished chrome robot head with glowing eyes"
- Keep it short and specific — 5-15 words is usually ideal

## Step 3 — Generate Previews
- Click "Generate" — Spline shows 4 image previews
- Select the one that best represents your desired shape
- Spline then generates the full 3D mesh (~30-60 seconds)

## Step 4 — Edit in Spline
- The mesh is added to your scene
- Use the Properties panel (right) to add materials:
  - Color layer, Noise, Gradient, Fresnel for surface style
  - Lighting layer (Phong, Physical, Toon) for shading
- Adjust position/scale/rotation as needed

## Step 5 — Export
- **GLB/GLTF**: For web or game engines
- **USDZ**: For AR on iOS
- **STL**: For 3D printing
- **Code embed**: For interactive web experiences (see spline_create_embed)
`,

    image: `# Spline Image-to-3D Workflow

## Step 1 — Prepare Your Reference Image
- Best: front-facing, isolated object, clean/white background
- Format: PNG or JPG, ideally square (1:1)
- Use \`spline_generate_image\` to create an AI-optimized reference image

## Step 2 — Access AI Generation
- **Dashboard**: spline.design → "Generate" tab → "Upload Image"
- **In editor**: AI button → "AI Generate" → upload icon

## Step 3 — Upload + Generate
- Upload your image
- Optionally add a text prompt to guide material/style
- Click Generate → Spline analyzes depth → shows 4 previews
- Select the best result → mesh is generated

## Step 4 — Refine
- The raw mesh may have artifacts — use Spline's sculpt/edit tools
- Apply materials via the Properties panel (right sidebar)

## Step 5 — Export as needed
`,

    combined: `# Spline Text + Image to 3D Workflow

## Best of Both Worlds
Combine a reference image (for shape) with a text prompt (for style/details).

## Step 1 — Prepare Reference
- Use \`spline_generate_image\` to create a clean reference image
- Or use any photo with a clear, isolated subject

## Step 2 — Write Your Text Companion Prompt
- Image gives the shape; text guides: material, style, color, detail level
- Example:
  - Image: sneaker photo → Text: "low-poly cartoon sneaker, bright yellow"
  - Image: car sketch → Text: "futuristic concept car, metallic blue paint"

## Step 3 — Generate + Select
- Upload image + enter text prompt in Spline's AI Generate panel
- Choose from 4 previews → generate full 3D mesh

## Step 4 — Edit, Material, Export (same as above)
`,
  };

  return guides[method] || guides.text;
}

// 4. Create Scene Embed HTML
function splineCreateEmbed(args) {
  const {
    sceneUrl,
    title = 'Spline 3D Scene',
    width = '100%',
    height = '100vh',
    background = '#1a1a2e',
    outputPath,
  } = args;

  if (!sceneUrl) return 'Error: sceneUrl is required (e.g. https://prod.spline.design/XXXX/scene.splinecode)';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: ${background};
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #canvas3d {
      width: ${width};
      height: ${height};
      display: block;
    }
    #loading {
      position: fixed;
      inset: 0;
      background: ${background};
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
      gap: 16px;
      z-index: 10;
      transition: opacity 0.5s;
    }
    #loading.hidden { opacity: 0; pointer-events: none; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <span>Loading 3D Scene…</span>
  </div>
  <canvas id="canvas3d"></canvas>

  <script type="module">
    import { Application } from 'https://unpkg.com/@splinetool/runtime@latest/build/runtime.js';

    const canvas  = document.getElementById('canvas3d');
    const loading = document.getElementById('loading');

    const spline = new Application(canvas);

    spline
      .load('${sceneUrl}')
      .then(() => {
        loading.classList.add('hidden');
        console.log('[Spline] Scene loaded');
        console.log('[Spline] Objects:', spline.getAllObjects().map(o => o.name));
        console.log('[Spline] Variables:', spline.getVariables());
      })
      .catch(err => {
        loading.innerHTML = \`<p style="color:#f87171">Failed to load scene: \${err.message}</p>\`;
        console.error('[Spline] Load error:', err);
      });

    // ── Example: interact with objects ──────────────────────────────────────
    // const cube = spline.findObjectByName('Cube');
    // cube.position.x += 50;
    // cube.color = '#ff6b6b';

    // ── Example: listen to events ───────────────────────────────────────────
    // spline.addEventListener('mouseDown', (e) => {
    //   console.log('Clicked:', e.target.name);
    // });

    // ── Example: update variables ───────────────────────────────────────────
    // spline.setVariable('myColor', '#00ff88');

    // ── Example: trigger state transitions ─────────────────────────────────
    // const sphere = spline.findObjectByName('Sphere');
    // sphere.transition({ to: 'Hover', duration: 400 });

    // Expose spline instance globally for console debugging
    window.spline = spline;
  </script>
</body>
</html>`;

  if (outputPath) {
    try {
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, html, 'utf8');
      return `✅ HTML embed saved to: ${outputPath}\n\nOpen in a browser to preview your Spline scene.\nThe \`window.spline\` instance is available in the browser console for live debugging.`;
    } catch (err) {
      return `Error saving file: ${err.message}\n\n---\n${html}`;
    }
  }

  return `✅ Generated Spline embed HTML:\n\n\`\`\`html\n${html}\n\`\`\`\n\nSave this as an .html file and open in a browser to view your scene.\nThe \`window.spline\` instance is available in console for live debugging.`;
}

// 5. Generate Interaction Code
function splineGenerateInteractionCode(args) {
  const {
    sceneUrl,
    framework = 'vanilla',
    objectName,
    actions = [],
  } = args;

  if (!sceneUrl) return 'Error: sceneUrl is required';

  const actionComments = {
    move:       `// Move object\nobj.position.x += 50;\nobj.position.y -= 20;\nobj.position.z = 100;`,
    rotate:     `// Rotate object\nobj.rotation.y += Math.PI / 4;`,
    scale:      `// Scale object\nobj.scale.x = 2;\nobj.scale.y = 2;\nobj.scale.z = 2;`,
    color:      `// Change color\nobj.color = '#ff6b6b'; // CSS color`,
    hide:       `// Toggle visibility\nobj.hide();\n// obj.show();`,
    transition: `// State transition\nobj.transition({ to: 'HoverState', duration: 500, easing: 'easeInOut' });\n// Chain: obj.transition({ to: 'A' }).transition({ to: 'B' });`,
    variable:   `// Update scene variables\nspline.setVariable('myVar', 'hello');\nspline.setVariable('count', 42);\nconst vars = spline.getVariables();\nconsole.log(vars);`,
    event:      `// Listen for events\nspline.addEventListener('mouseDown', (e) => {\n  console.log('Clicked object:', e.target.name);\n});\nspline.addEventListener('mouseHover', (e) => {\n  e.target.color = '#ffffff';\n});`,
    emit:       `// Trigger Spline events programmatically\nspline.emitEvent('mouseHover', '${objectName || 'Cube'}');\nspline.emitEvent('mouseDown', '${objectName || 'Cube'}');`,
    list:       `// Discover all objects in scene\nconst all = spline.getAllObjects();\nconsole.table(all.map(o => ({ name: o.name, id: o.id })));\nconst events = spline.getSplineEvents();\nconsole.log('Events:', events);`,
  };

  const selectedActions = actions.length > 0
    ? actions.map(a => actionComments[a] || `// Unknown action: ${a}`).join('\n\n')
    : Object.values(actionComments).join('\n\n');

  if (framework === 'react') {
    return `\`\`\`tsx
import Spline from '@splinetool/react-spline';
import { useRef } from 'react';
import type { Application } from '@splinetool/runtime';

export default function Scene() {
  const splineRef = useRef<Application>(null);

  function onLoad(spline: Application) {
    splineRef.current = spline;

    ${objectName ? `const obj = spline.findObjectByName('${objectName}');` : `const obj = spline.findObjectByName('YourObjectName');`}
    if (!obj) { console.warn('Object not found'); return; }

    ${selectedActions.split('\n').join('\n    ')}
  }

  return (
    <Spline
      scene="${sceneUrl}"
      onLoad={onLoad}
      style={{ width: '100%', height: '100vh' }}
    />
  );
}
\`\`\`

**Install**: \`npm install @splinetool/react-spline @splinetool/runtime\`
`;
  }

  if (framework === 'nextjs') {
    return `\`\`\`tsx
'use client';
import Spline from '@splinetool/react-spline/next';
import { useRef } from 'react';
import type { Application } from '@splinetool/runtime';

export default function SplineScene() {
  const splineRef = useRef<Application>(null);

  function onLoad(spline: Application) {
    splineRef.current = spline;

    ${objectName ? `const obj = spline.findObjectByName('${objectName}');` : `const obj = spline.findObjectByName('YourObjectName');`}
    if (!obj) { console.warn('Object not found'); return; }

    ${selectedActions.split('\n').join('\n    ')}
  }

  return (
    <Spline
      scene="${sceneUrl}"
      onLoad={onLoad}
      style={{ width: '100%', height: '100vh' }}
    />
  );
}
\`\`\`

**Install**: \`npm install @splinetool/react-spline @splinetool/runtime\`
**Note**: This component must be a Client Component — the \`'use client'\` directive is required.
`;
  }

  // Vanilla JS (default)
  return `\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: #111; }
    canvas { width: 100vw; height: 100vh; display: block; }
  </style>
</head>
<body>
<canvas id="canvas3d"></canvas>
<script type="module">
  import { Application } from 'https://unpkg.com/@splinetool/runtime@latest/build/runtime.js';

  const canvas = document.getElementById('canvas3d');
  const spline = new Application(canvas);

  spline.load('${sceneUrl}').then(() => {
    ${objectName ? `const obj = spline.findObjectByName('${objectName}');` : `const obj = spline.findObjectByName('YourObjectName');`}
    if (!obj) { console.warn('Object not found'); return; }

    ${selectedActions.split('\n').join('\n    ')}
  });
</script>
</body>
</html>
\`\`\`

**Tip**: Get your object names from: \`spline.getAllObjects().map(o => o.name)\`
**Full runtime API**: https://www.npmjs.com/package/@splinetool/runtime
`;
}

// 6. Open Editor Info
function splineOpenEditor(args) {
  const { action = 'generate' } = args;

  const urls = {
    generate:  'https://app.spline.design/#/ai-generate',
    editor:    'https://app.spline.design/',
    dashboard: 'https://spline.design/',
    community: 'https://spline.design/community',
  };

  return `# Spline Editor Access

## 🔗 Direct URLs
| Action             | URL |
|--------------------|-----|
| 🤖 AI 3D Generate  | ${urls.generate} |
| ✏️  Editor          | ${urls.editor} |
| 🏠 Dashboard       | ${urls.dashboard} |
| 🌐 Community       | ${urls.community} |

## How to Use AI 3D Generation
1. Go to: **${urls.generate}**
2. Sign in to your Spline account (Professional or Team plan + AI Add-on required)
3. Choose **Text to 3D** or **Image to 3D**
4. Write your prompt (or upload image) → Generate previews → Select best → Build mesh

## Requirements
- Active Professional or Team subscription
- Spline AI Add-on subscription (additional cost)
- Any modern browser — no special hardware needed (runs in cloud)

## Tips
- Download the desktop app for better performance: https://spline.design/#download
- Use \`spline_generate_image\` to create optimized reference images for Image-to-3D
- After generating, export via Editor → Export → GLB/Code/etc.
`;
}

// ── Tool Definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'spline_prompt_guide',
    description: 'Returns a comprehensive guide for writing effective prompts for Spline AI 3D generation (text-to-3D and image-to-3D best practices)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'spline_generate_image',
    description: 'Generates a high-quality reference image using InsForge AI that is optimized for use with Spline Image-to-3D. Saves the image to disk.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt:    { type: 'string', description: 'Object description to generate an image of (e.g. "a ceramic coffee mug")' },
        style:     { type: 'string', enum: ['photorealistic','illustration','3d_render','sketch'], description: 'Visual style of the generated image (default: photorealistic)' },
        width:     { type: 'number', description: 'Image width in pixels (default: 1024)' },
        height:    { type: 'number', description: 'Image height in pixels (default: 1024)' },
        outputDir: { type: 'string', description: 'Directory to save the image (default: ~/SplineAssets)' },
        filename:  { type: 'string', description: 'Output filename (default: spline-ref-<timestamp>.png)' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'spline_workflow_guide',
    description: 'Returns a step-by-step workflow guide for creating 3D objects in Spline from text or image prompts',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['text','image','combined'], description: 'Workflow type: text-to-3D, image-to-3D, or combined (default: text)' },
      },
      required: [],
    },
  },
  {
    name: 'spline_create_embed',
    description: 'Generates a complete, ready-to-use HTML page that embeds a Spline 3D scene using @splinetool/runtime with a loading screen and debug utilities',
    inputSchema: {
      type: 'object',
      properties: {
        sceneUrl:   { type: 'string', description: 'Spline scene .splinecode URL (from Spline editor → Export → Code → Vanilla JS)' },
        title:      { type: 'string', description: 'HTML page title (default: "Spline 3D Scene")' },
        width:      { type: 'string', description: 'Canvas width CSS value (default: "100%")' },
        height:     { type: 'string', description: 'Canvas height CSS value (default: "100vh")' },
        background: { type: 'string', description: 'Background color CSS value (default: "#1a1a2e")' },
        outputPath: { type: 'string', description: 'File path to save the HTML (optional — if omitted, returns HTML as text)' },
      },
      required: ['sceneUrl'],
    },
  },
  {
    name: 'spline_generate_interaction_code',
    description: 'Generates JavaScript/TypeScript code to interact with Spline scene objects: move, rotate, scale, color change, state transitions, variable updates, and event listeners',
    inputSchema: {
      type: 'object',
      properties: {
        sceneUrl:   { type: 'string', description: 'Spline scene .splinecode URL' },
        framework:  { type: 'string', enum: ['vanilla','react','nextjs'], description: 'Target framework (default: vanilla)' },
        objectName: { type: 'string', description: 'Name of the primary Spline object to interact with (optional)' },
        actions:    { type: 'array', items: { type: 'string', enum: ['move','rotate','scale','color','hide','transition','variable','event','emit','list'] }, description: 'Which interaction types to include (default: all)' },
      },
      required: ['sceneUrl'],
    },
  },
  {
    name: 'spline_open_editor',
    description: 'Returns Spline editor and AI generation URLs and usage instructions. Use this to guide the user to the right Spline tool.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['generate','editor','dashboard','community'], description: 'Which Spline URL/info to focus on (default: generate)' },
      },
      required: [],
    },
  },
];

// ── MCP Server Setup ──────────────────────────────────────────────────────────
const server = new Server(
  { name: 'spline-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result;
    switch (name) {
      case 'spline_prompt_guide':
        result = splinePromptGuide();
        break;
      case 'spline_generate_image':
        result = await splineGenerateImage(args);
        break;
      case 'spline_workflow_guide':
        result = splineWorkflowGuide(args);
        break;
      case 'spline_create_embed':
        result = splineCreateEmbed(args);
        break;
      case 'spline_generate_interaction_code':
        result = splineGenerateInteractionCode(args);
        break;
      case 'spline_open_editor':
        result = splineOpenEditor(args);
        break;
      default:
        result = `Unknown tool: ${name}`;
    }
    return { content: [text(result)] };
  } catch (err) {
    return { content: [text(`Error in ${name}: ${err.message}`)], isError: true };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[spline-mcp] Server started — 6 tools registered');
console.error('[spline-mcp] InsForge AI endpoint:', INSFORGE_URL);
