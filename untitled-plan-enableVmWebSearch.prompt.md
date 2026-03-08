## Plan: Enable VM Web Search for Agent Lee

TL;DR - Make Agent Lee's VM browser reliably perform web searches by ensuring the frontend uses the VM-authenticated fetch flow and by validating backend guardian/policy outbound access. Preferred minimal first step: update the VMBrowser to use the existing `vmFetch` helper so `/api/search` gets the `x-neural-handshake` header; then verify Guardian/network policy and backend middleware behavior.

**Steps**

1. Update VMBrowser to call `vmFetch('/api/search?...')` instead of `fetch('/api/search?...')` (_depends on step 2 for validation_).
2. Audit `securityMiddleware` to confirm `/api/search` requires handshake and log the rejection codes (401/403/429) to provide clear error messages for the frontend. If `securityMiddleware` is blocking unauthenticated calls, update its docs or recovery path.
3. Check `guardian/policy.json` and runtime guardian enforcer to determine whether the backend is permitted to fetch chosen search engine hosts (DuckDuckGo, Searx, Wikipedia, Bing, Google, Whoogle). If hosts are blocked, add allowed hosts or configure a permitted proxy (or use Searx instances already allowed).
4. Add explicit frontend error handling for search failures: surface backend response (401/403/429/502) and an actionable remediation hint (e.g., "Provide handshake header", "Enable DEV_ALLOW_UNAUTH for local dev", or "Allow host in guardian policy").
5. Add an automated unit/integration test for the VM browser search flow: mock the backend search route and assert that the request contains `x-neural-handshake` (or required crypto headers) and that the UI handles success and failure states.
6. Manual verification steps: use the VM UI, perform a search, and confirm backend logs record an authenticated `/api/search` request and external fetches succeed (or fail with a clear guardian reason). Validate flow across both local dev and deployed modes.

**Relevant files**

- `.Agent_Lee_OS/components/LeeVM.tsx` — Update `VMBrowser.search()` to call `vmFetch(...)` or add handshake header.
- `backend/src/routes/search.ts` — Review search proxy behavior, timeouts, and error messages.
- `backend/src/services/security.ts` — Confirm handshake requirements and the middleware's failure codes; log details for `missing handshake` and `external host blocked` cases.
- `guardian/policy.json` — Verify `network.external.allowedHosts` contains the search hosts required; update if needed.
- `.env.local` and `.Agent_Lee_OS/.env.local` — Confirm handshake token values and dev overrides (DEV_ALLOW_UNAUTH) for testing.
- `backend/src/index.ts` — Confirm mounting order of `securityMiddleware` and route registration.

**Verification**

1. Unit Test: Mock `vmFetch` and assert `x-neural-handshake` header present when VMBrowser performs search.
2. Integration: Run the app locally, open the VM UI, run a search; backend logs should show `/api/search` accepted (200) and an outbound fetch to the chosen search host (200).
3. End-to-End: With guardian enforcer enabled, attempt search to an allowed host and to a blocked host to verify guardian rejection is surfaced clearly in the UI.

**Decisions / Assumptions**

- Assume `vmFetch` exists and already adds the `x-neural-handshake`; using it is the least invasive fix.
- If the guardian enforcer actively blocks external hosts, policy updates will be required — this is an ops change and needs approval.
- For fast local dev testing, `DEV_ALLOW_UNAUTH=true` can be used temporarily if policy changes are not immediately possible.

**Further Considerations**

1. Option A (Quick): Patch `VMBrowser.search()` to use `vmFetch` and ship a micro-release so the VM can search immediately. Option B (Comprehensive): Also adjust `securityMiddleware` logging + UI error messages and review guardian policies for a robust long-term fix.
2. Should I prepare the code patch for `.Agent_Lee_OS/components/LeeVM.tsx` (1-line change) and the test skeleton? If yes, I will draft the patch and run the repo search to show exact line numbers to modify.
