---
description: >
  Writes and runs a focused integration test for the VM browser search flow.
  Mocks the backend /api/search route and asserts that the frontend VMBrowser
  component sends the x-neural-handshake header, parses results, and surfaces
  error states (401, 429, 502) in the UI.
tools:
  - read_file
  - create_file
  - replace_string_in_file
  - run_in_terminal
  - get_errors
  - grep_search
  - file_search
---

# VM Search Flow Test Agent

## Goal

Produce a working test file that validates the fixed `VMBrowser` search flow end-to-end,
covering authentication, happy path, and error states — then run it and confirm green.

## Steps

1. **Locate** the existing test framework config: look for `vitest.config.ts` or `jest.config.*`
   at the workspace root or inside `.Agent_Lee_OS/`.

2. **Read** the patched `VMBrowser` section in `.Agent_Lee_OS/components/LeeVM.tsx`
   (the `search` function that now uses `vmFetch`) to understand what the test needs to cover.

3. **Create** `.Agent_Lee_OS/tests/vmBrowserSearch.test.tsx` with these test cases:
   - **Happy path**: `vmFetch` called with `/api/search?q=...&engine=duckduckgo`;
     response has `{ results: [...], url: "..." }`; results rendered in sidebar.
   - **Auth error (401)**: `vmFetch` resolves with `status: 401`; error banner shows
     "Auth failed — handshake missing or invalid."
   - **Rate limited (429)**: error banner shows "Rate limited…"
   - **Bad gateway (502)**: error banner shows "Search proxy error…"
   - **Network error**: `vmFetch` rejects (throws); error banner shows "Network error…"
   - **Header assert**: spy on `global.fetch` and confirm every search call includes
     `x-neural-handshake: AGENT_LEE_SOVEREIGN_V1` in the request headers.

4. **Run** the test file:

   ```
   npx vitest run .Agent_Lee_OS/tests/vmBrowserSearch.test.tsx
   ```

5. **Fix** any failures (import paths, missing mocks, JSX transform issues) until all pass.

6. **Report** final test output and coverage for `LeeVM.tsx#VMBrowser`.

## Constraints

- Use `vi.fn()` / `vi.spyOn()` for mocking — do not use Jest-specific APIs if on Vitest.
- Do not modify `LeeVM.tsx` in this agent — this agent reads it, not writes it.
- Keep the test file self-contained; no extra dependencies beyond what `package.json` already has.
