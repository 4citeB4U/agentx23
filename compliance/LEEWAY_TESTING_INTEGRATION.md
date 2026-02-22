# LEEWAY Testing Integration Guide

## Objectives

- Standardize all test outputs using `LEEWAY_CTRF_v1`.
- Enforce machine validation in CI before merge.
- Support agentic test generation with auditability.

## Artifacts

- Schema: `compliance/schemas/leeway-test-report.schema.json`
- Prompt template: `compliance/prompts/gemini-structured-testcases.prompt.md`
- Tools comparison: `compliance/reports/ai-testing-tools-2026.md`
- Validator script: `scripts/validate_test_report.js`

## CI Gate Pattern

1. Execute tests (unit/integration/E2E/agentic).
2. Export structured report JSON.
3. Validate report JSON against schema.
4. Fail pipeline if schema validation fails.

## Suggested Policy Thresholds

- `reportFormat` must equal `LEEWAY_CTRF_v1`.
- `metadata.coverage` >= 80 for non-experimental branches.
- All `priority=high` tests must pass.

## Example Commands

```bash
npm run validate:test-report -- compliance/examples/sample-test-report.json
```

## Agentic Workflow Controls

- Require notebook entry for each auto-generated or auto-healed test change.
- Include diff summary and reason code in notebook metadata.
- Route critical-path changes through manual approval.
