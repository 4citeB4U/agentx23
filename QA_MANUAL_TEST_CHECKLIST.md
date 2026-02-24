# QA Manual Test Checklist for agentx23

## 1. API & Localhost

- [ ] Ping all API endpoints and verify response
- [ ] Measure latency and log results
- [ ] Test malformed requests and authentication failures

## 2. Sovereign Handshake & Security

- [ ] Test handshake with valid/invalid credentials
- [ ] Attempt session hijacking and replay attacks
- [ ] Review logs for unauthorized access

## 3. Corruption & Recovery

- [ ] Inject corrupted files and database entries
- [ ] Verify detection, quarantine, and recovery
- [ ] Check logs and alerts for corruption events

## 4. Failure & Availability

- [ ] Simulate MCP/server failures and network outages
- [ ] Monitor auto-restart and failover
- [ ] Validate full recovery and uptime

## 5. Bug Prevention & Self-Healing

- [ ] Run mutation tests and invalid parameter checks
- [ ] Review logs for bug detection and self-healing
- [ ] Test patching and rollback

## 6. Integration & Regression

- [ ] Run notebook integration tests
- [ ] Test edge cases and error scenarios
- [ ] Verify backward compatibility

## 7. Scaling & Performance

- [ ] Simulate scaling scenarios and monitor resources
- [ ] Identify bottlenecks and leaks
- [ ] Validate scaling strategies

## 8. Monitoring & Reporting

- [ ] Validate log generation and alerting
- [ ] Review QA_FINAL_REPORT.md for completeness
- [ ] Ensure test results are visible and actionable

## 9. Test Coverage

- [ ] Use coverage tools for 95%+ code path coverage
- [ ] Review files for untested logic
- [ ] Add tests for critical flows

## 10. Continuous Testing & Maintenance

- [ ] Schedule daily/weekly test runs
- [ ] Flag outdated code for review
- [ ] Refactor flagged code
