## Persistent MCP/InsForge Usage Prompt

At all times, use InsForge and all MCP tools for every operation. Do not use CLI for any task except Desktop Commander or similar agent tools. This prompt is persistent and applies to all agent operations and outputs.

## LEEWAY Standards Enforcement

At all times, all code and documentation written or generated must strictly follow LEEWAY standards:

- Include LEEWAY header blocks in all supported file types.
- For unsupported file types (e.g., .json, model, binary), document compliance externally.
- No code or content may be written outside LEEWAY standards.
- This enforcement is persistent and applies to all agent operations and outputs.

# Copilot Instructions (Persistent PSI)

## Hard boundaries

- Do not claim we are "in VS Code" unless the user is actually using VS Code (Desktop/Web via Remote Tunnels/Codespaces/code-server).
- Do not add extra UI pages/modals/filters/animations beyond the explicit spec.
- LIVE = remote desktop feed + input. CODE = editor/preview UX only.

## Security

- Treat filesystem and device-control as privileged operations.
- Enforce allowlisted roots, block path traversal, and keep audit logs for filesystem mutations.

## Code changes

- Prefer minimal, surgical changes.
- Keep existing public APIs stable unless the spec requires change.
- When adding endpoints: validate inputs, return clear errors, and avoid leaking secrets.

## Verification

- If you change backend or frontend: run the nearest build/test commands and confirm the app starts.

## Agent Lee VM-First Policy (Persistent — applies to all tasks)

Agent Lee has his own computer: **LEE VM-01**, backed by `POST /api/vm/*` endpoints and the `LeeVM` component (Tab.VM).
The following rules are **mandatory** and override all other defaults:

### For all CREATE / EDIT / BUILD tasks:

1. **Copy** the target project/directory into the VM first: `POST /api/vm/sandbox/copy { realPath, name }`
2. **Edit** files only inside the VM (`POST /api/vm/vfs/write { path, content }`)
3. **Build & test** inside the VM: `POST /api/vm/sandbox/exec { cmd, cwd }`
4. **Monitor** job output: `GET /api/vm/sandbox/jobs/:id`
5. **Present** the result to the user: `GET /api/vm/sandbox/present?project=name`
6. **Apply** to real files only after explicit user approval: `POST /api/vm/sandbox/apply { vmPath, realPath }` — requires `x-neural-handshake` header

### For all SEARCH tasks:

- Use the VM browser via `GET /api/search?q=<query>&engine=<engine>`
- Available engines: `duckduckgo`, `wikipedia`, `brave`, `whoogle`, `bing`, `searxng`, `google`
- Default engine: `duckduckgo`

### Absolute rules:

- **Never edit real host files directly** without completing the full VM lifecycle above
- **Never skip the present-and-approve step** before applying
- All mutating requests use the `x-neural-handshake` header (`AGENT_LEE_SOVEREIGN_V1`)
- If the VM backend is offline, say so and wait — do NOT fall back to editing real files
