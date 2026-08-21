# Gaps

### [M] Role walkthrough is not executable end-to-end in the repository
- The repository has one placeholder auth test and no seeded disposable environment, cross-role API harness, payment-webhook simulator, socket test client, or state-table reporter. Importing `backend/server.js` also starts MongoDB, SMTP, sockets, workers, and an HTTP listener, which makes isolated test execution depend on live operational configuration.
- Recommendation: add a `createApp()` factory with explicit production-only startup, a replica-set-backed integration environment, role fixtures, gateway fakes, and deterministic worker triggers. This enables the J1-J10 state assertions without using real customer/payment data.
