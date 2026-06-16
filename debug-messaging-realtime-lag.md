# Debug Session: messaging-realtime-lag
- **Status**: [OPEN]
- **Issue**: Chat is still not instant; investigate the full messaging flow and fix realtime bugs.
- **Debug Server**: Pending startup
- **Log File**: .dbg/trae-debug-log-messaging-realtime-lag.ndjson

## Reproduction Steps
1. Open chat in two sessions/devices.
2. Send messages in both directions.
3. Observe whether messages, delivery state, unread state, and inbox preview update instantly.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Socket listeners are not attached or reattached correctly on the client. | High | Med | Pending |
| B | Server emits to the wrong room or with inconsistent IDs. | High | Med | Pending |
| C | Realtime events arrive but client state reconciliation drops or delays them. | High | Med | Pending |
| D | Socket connectivity is unstable and the UI is falling back to delayed fetch refreshes. | Med | Med | Pending |
| E | Another cache or stale-state path still masks fresh conversation data. | Med | Low | Pending |

## Log Evidence
- Pending instrumentation

## Verification Conclusion
- Pending pre-fix evidence
