SYSTEM: You are an expert test engineer.

TASK:
Given the component description below, generate a JSON array of test case objects.

COMPONENT_DESCRIPTION:
```{{COMPONENT_DESCRIPTION}}```

RESPONSE RULES:
1. Return only valid JSON.
2. Do not include markdown, commentary, or prose outside JSON.
3. Field names and types must match the structure exactly.
4. Include at least 3 test cases covering:
   - happy path
   - edge case
   - failure path

JSON STRUCTURE:
[
  {
    "testCaseID": "string",
    "description": "string",
    "preconditions": ["string"],
    "steps": ["string"],
    "expectedResults": ["string"],
    "priority": "high|medium|low"
  }
]

QUALITY CONSTRAINTS:
- Steps are actionable and deterministic.
- Expected results are measurable.
- Preconditions include required setup/state.