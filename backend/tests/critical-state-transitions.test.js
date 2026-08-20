const mongoose = require('mongoose');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const Escrow = require('../models/Escrow.model');
const Dispute = require('../models/Dispute.model');
const Order = require('../models/Order.model');
const Vendor = require('../models/Vendor.model');
const AuditLog = require('../models/AuditLog.model');
const { adjustBalance } = require('../services/wallet.service');
const { createDispute } = require('../controllers/dispute.controller');

const session = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  endSession: vi.fn(),
  inTransaction: vi.fn(() => true),
};

const query = (value) => ({
  session: vi.fn().mockResolvedValue(value),
  lean: vi.fn().mockResolvedValue(value),
});

describe('critical cross-role state transitions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({});
    session.startTransaction.mockClear();
    session.commitTransaction.mockClear();
    session.abortTransaction.mockClear();
    session.endSession.mockClear();
    session.inTransaction.mockReturnValue(true);
  });

  it('claims a retry key in the ledger before changing a wallet balance', async () => {
    const ledgerEntry = { _id: 'ledger-1', status: 'pending', save: vi.fn() };
    vi.spyOn(Transaction, 'findOne').mockReturnValue(query(null));
    const create = vi.spyOn(Transaction, 'create').mockResolvedValue([ledgerEntry]);
    const update = vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ _id: 'user-1', wallet_balance: 90 });

    await adjustBalance('user-1', -10, session, {
      type: 'payment',
      reference: 'wallet-retry-1',
      idempotency_key: 'retry-key-1',
      description: 'Retry-safe payment',
    });

    expect(create).toHaveBeenCalledBefore(update);
    expect(create).toHaveBeenCalledWith(
      [expect.objectContaining({ idempotency_key: 'retry-key-1', status: 'pending' })],
      { session },
    );
    expect(update).toHaveBeenCalledWith(
      { _id: 'user-1', wallet_balance: { $gte: 10 } },
      { $inc: { wallet_balance: -10 } },
      { session, new: true },
    );
    expect(ledgerEntry.status).toBe('completed');
    expect(ledgerEntry.save).toHaveBeenCalledWith({ session });
  });

  it('claims held escrow as disputed before creating the dispute record', async () => {
    const order = {
      _id: 'order-1',
      customer_id: { toString: () => 'customer-1' },
      order_status: 'delivered',
      save: vi.fn(),
    };
    const escrow = { _id: 'escrow-1', status: 'held' };
    const dispute = { _id: 'dispute-1' };
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    vi.spyOn(Order, 'findById').mockReturnValue(query(order));
    vi.spyOn(Dispute, 'findOne').mockReturnValue(query(null));
    vi.spyOn(Escrow, 'findOne').mockReturnValue(query(escrow));
    const claim = vi.spyOn(Escrow, 'findOneAndUpdate').mockResolvedValue({ ...escrow, status: 'disputed' });
    const create = vi.spyOn(Dispute, 'create').mockResolvedValue([dispute]);
    vi.spyOn(Vendor, 'findById').mockResolvedValue(null);

    await createDispute({
      body: { order_id: 'order-1', reason: 'item_not_received', description: 'No package', evidence_urls: [] },
      user: { _id: 'customer-1', name: 'Customer' },
      app: null,
    }, response, vi.fn());

    expect(claim).toHaveBeenCalledWith(
      { _id: 'escrow-1', status: { $in: ['held', 'pending_release'] } },
      { $set: { status: 'disputed' } },
      { new: true, session },
    );
    expect(create).toHaveBeenCalledAfter(claim);
    expect(order.order_status).toBe('refund_pending');
    expect(response.status).toHaveBeenCalledWith(201);
  });
});
