---
description: >
  Audits guardian/policy.json to ensure all search engine hosts (DuckDuckGo,
  Wikipedia, Bing, Brave, Google, Whoogle, SearXNG) are present in
  network.external.allowedHosts. Adds missing entries and verifies that the
  guardian runtime enforcer (if active) will permit outbound backend fetches
  from search.ts.
tools:
  - read_file
  - replace_string_in_file
  - grep_search
  - file_search
  - run_in_terminal
  - get_errors
---

# Guardian Policy Auditor — VM Web Search

## Goal

Ensure that `guardian/policy.json` allows every external host that `backend/src/routes/search.ts`
may contact, so that the in-VM browser search never silently fails due to a blocked outbound host.

## Steps

1. **Read** `guardian/policy.json` and extract the current `network.external.allowedHosts` list.

2. **Compare** against the required host list:
   - `api.duckduckgo.com`
   - `html.duckduckgo.com`
   - `duckduckgo.com`
   - `en.wikipedia.org`
   - `search.brave.com`
   - `www.bing.com`
   - `www.google.com`
   - `whoogle.io`
   - `searx.be`
   - `search.mdosch.de`
   - `searxng.site`

3. **Add** any missing hosts to `network.external.allowedHosts` using `replace_string_in_file`.

4. **Search** for any guardian runtime enforcer (`guardian/` directory, `guardianEnforcer`, `policyEnforcer`,
   or `checkAllowedHost`) that may actively gate outbound `fetch()` calls at runtime. If found,
   verify it reads from the same `policy.json` file (not a stale in-memory copy).

5. **Verify** no TypeScript or lint errors were introduced: run `tsc --noEmit` in `backend/`.

6. **Report** a summary: hosts added, enforcer status (active / not found), and verification result.

## Constraints

- Only modify `guardian/policy.json` and, if necessary, comments/docs inside the enforcer.
- Do NOT alter security middleware logic or rate-limit values.
- If the policy file uses a schema that validates `allowedHosts` format, preserve that exact format.
