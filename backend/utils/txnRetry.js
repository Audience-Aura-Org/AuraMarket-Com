/**
 * utils/txnRetry.js
 * Re-run a request handler whose MongoDB transaction aborted with a
 * TransientTransactionError (e.g. a WriteConflict when two buyers decrement
 * the same product's stock, or a credit lands on the same wallet).
 *
 * Such a transaction was fully rolled back, so the whole attempt is safe to
 * re-run. Commit-uncertain errors (UnknownTransactionCommitResult) are NOT
 * retried. The attempt must not send a response or fire side effects before
 * its commit — it returns RETRY_TXN from its catch block instead.
 */
'use strict';

const RETRY_TXN = Symbol('retry-transaction');
const MAX_TXN_ATTEMPTS = 3;

const isTransientTxnError = (err) =>
  Boolean(err?.hasErrorLabel?.('TransientTransactionError') || err?.errorLabelSet?.has?.('TransientTransactionError'));

/** True when the attempt should hand back RETRY_TXN instead of failing the request. */
const shouldRetryTxn = (err, res, isLastAttempt) =>
  isTransientTxnError(err) && !isLastAttempt && !res.headersSent;

/**
 * Wrap `attempt(req, res, next, isLastAttempt)` into an Express handler that
 * re-runs it while it returns RETRY_TXN.
 */
const withTxnRetry = (attempt, label = attempt.name) => async (req, res, next) => {
  for (let n = 1; n <= MAX_TXN_ATTEMPTS; n += 1) {
    const outcome = await attempt(req, res, next, n === MAX_TXN_ATTEMPTS);
    if (outcome !== RETRY_TXN) return outcome;
    console.warn(`[${label}] transient transaction error, retrying (${n}/${MAX_TXN_ATTEMPTS - 1})`);
  }
  return undefined;
};

module.exports = { RETRY_TXN, MAX_TXN_ATTEMPTS, isTransientTxnError, shouldRetryTxn, withTxnRetry };
