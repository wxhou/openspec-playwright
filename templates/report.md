# E2E Verify Report: <change-name>

**Change**: `<change-name>`
**Generated**: `<timestamp>`
**Auth**: `<required|none>`

## Summary

| Metric | Value |
|--------|-------|
| Tests Run | <N> |
| Passed | <X> |
| Failed | <Y> |
| App Bugs (skipped) | <A> |
| Test Bugs (healed) | <B> |
| Flaky/RAFT | <F> |
| Human Escalations | <H> |
| Final Status | <PASS|FAIL|SKIPPED> |

## Failure Classification

| Test | Failure Type | Action Taken | Healed? |
|------|-------------|------------|---------|
| <test> | App Bug | test.skip() | N/A |
| <test> | Selector Changed | Healed | Yes |
| <test> | RAFT | Skipped in suite | N/A |
| <test> | Human Escalation | Awaiting decision | N/A |

## Auto-Heal Log

<!-- If heals were performed, document each attempt:
- Test: <name>
- Assertion: "<what the test expected>"
- Actual: "<what the snapshot showed>"
- Fix applied: <selector/assertion change>
- Result: healed / still failing -->

## RAFT Summary

<!-- If any RAFTs detected:
- Test: <name>
- Behavior: fails in full suite, passes in isolation
- Root cause: infrastructure coupling (CPU/memory/I/O contention)
- Recommended action: investigate suite-wide resource usage -->

## Human Escalations

<!-- If any Phase 3 escalations:
- Test: <name>
- Assertion vs Actual: <comparison>
- Question asked: <4 options presented>
- User decision: <a/b/c/d> -->

## Recommendations

<!-- For failed/skipped tests: specific file:line references and recommended fixes -->
