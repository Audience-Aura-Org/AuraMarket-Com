/**
 * utils/claim.js
 * Auradime — Generic atomic state-transition helper.
 *
 * "Claiming" a record means atomically transitioning it from a known status
 * to an in-progress status in a single findOneAndUpdate, so that concurrent
 * workers or webhooks cannot process the same record twice.
 *
 * Usage:
 *   const claimed = await claim(Escrow, { _id: escrow._id }, 'held', 'releasing', session);
 *   if (!claimed) return; // another process claimed it first
 *   // ... safe to proceed with payout
 *
 * Returns: the updated document (with toStatus applied), or null if not claimed.
 */

/**
 * @param {import('mongoose').Model} Model
 * @param {object}  filter      - Additional query fields (e.g. { _id: id })
 * @param {string}  fromStatus  - The status the record must currently have
 * @param {string}  toStatus    - The status to transition to atomically
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<object|null>}
 */
const claim = async (Model, filter, fromStatus, toStatus, session) => {
  const options = { new: true };
  if (session) options.session = session;

  return Model.findOneAndUpdate(
    { ...filter, status: fromStatus },
    { $set: { status: toStatus, claimed_at: new Date() } },
    options,
  );
};

module.exports = { claim };
