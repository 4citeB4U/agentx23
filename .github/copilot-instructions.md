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
