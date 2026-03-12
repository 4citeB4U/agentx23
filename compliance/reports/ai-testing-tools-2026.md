<!-- LEEWAY HEADER BLOCK -->
<!-- File: ai-testing-tools-2026.md -->
<!-- Purpose: Agent Lee OS AI testing tools report -->
<!-- Security: LEEWAY-CORE-2026 compliant -->
<!-- Performance: Optimized for sovereign agentic compliance -->
<!-- Discovery: Part of Agent Lee OS compliance pipeline -->

# AI Testing Tools Comparison (2026) — LEEWAY Tailored

## Scope

This comparison is optimized for the current stack in this workspace:

- Frontend: React + Vite
- Backend: Node.js/TypeScript + Python services
- Automation: Playwright-style flows + agentic orchestration

## Tool Classes

### 1) AI-Augmented Platforms

- Best for accelerating authoring, maintenance, and prioritization.
- Common strengths: natural-language test authoring, flaky-test reduction, CI integrations.
- Tradeoff: reduced low-level control for custom edge behaviors.

### 2) Hybrid Code-First Frameworks

- Best for deterministic, version-controlled suites.
- Common strengths: full scripting control, strong ecosystem support, deep debugging.
- Tradeoff: higher maintenance burden without AI assist layers.

### 3) Autonomous / Agentic Testing

- Best for self-healing and dynamic test generation from changing runtime behavior.
- Common strengths: adaptive test orchestration and reduced manual triage.
- Tradeoff: requires governance gates (schema checks, traceability, approval flows).

## LEEWAY Decision Matrix

| Criterion          |            AI-Augmented |          Hybrid Code-First |             Autonomous/Agentic |
| :----------------- | ----------------------: | -------------------------: | -----------------------------: |
| Authoring speed    |                    High |                     Medium |                           High |
| Determinism        |                  Medium |                       High |                         Medium |
| Explainability     |                  Medium |                       High |                         Medium |
| CI/CD fit          |                    High |                       High |                    Medium-High |
| Governance effort  |                  Medium |                     Medium |                           High |
| Best use in LEEWAY | Regression acceleration | Core safety/contract tests | Adaptive exploratory + healing |

## Recommended Blend for This Repo

1. Keep core contract/security flows in code-first tests (deterministic).
2. Use AI-augmented tooling to propose and maintain broader regression cases.
3. Run autonomous/agentic testing in a gated lane with schema + policy checks.

## Minimum Governance Controls

- Structured output contract for every run (`LEEWAY_CTRF_v1`).
- Merge gates on schema validity + critical-priority pass rate.
- Notebook/audit trail entries for generated/modified tests.
- Human review for self-healed test mutations affecting critical paths.
