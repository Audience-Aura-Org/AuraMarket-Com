const request = require('supertest');
const mongoose = require('mongoose');
const { buildApp } = require('../setup/app');
const { createVendorUser, createAdmin } = require('../factories');
const { asUser } = require('../helpers/auth');
const User = require('../../models/User.model');
const Settings = require('../../models/PlatformSettings.model');
const Plan = require('../../models/SubscriptionPlan.model');
const Sub = require('../../models/UserSubscription.model');
const Tx = require('../../models/Transaction.model');
const pawapay = require('../../services/payment/gateways/pawapay.gateway');
const payunit = require('../../services/payunit.service');
const service = require('../../services/subscription.service');
let app, user, admin, plan;
beforeAll(() => { app = buildApp(); }, 120000);
beforeEach(async () => {
  await Settings.create({ subscription_required_roles: { vendor: true, logistics: false, customer: false } });
  user = await createVendorUser({ wallet_balance: 20000 }); admin = await createAdmin();
  plan = await Plan.create({ name: 'Audit plan', slug: 'audit-plan', roles: ['vendor'], price: 3000, currency: 'XAF', duration_days: 30 });
});
afterEach(() => vi.restoreAllMocks());
const buy = (body = {}) => request(app).post('/api/v1/subscriptions/initialize').set(asUser(user)).send({ plan_id: plan._id, payment_method: 'wallet', ...body });
const act = body => request(app).post('/api/v1/subscriptions/admin/subscriptions/activate').set(asUser(admin)).send({ user_id: user._id, plan_id: plan._id, ...body });
it('does not overwrite role requirements while loading plans', async () => {
  await request(app).get('/api/v1/subscriptions/me').set(asUser(user)).expect(200);
  expect((await Settings.findOne()).subscription_required_roles.logistics).toBe(false);
});
it('charges once when identical wallet purchases race', async () => {
  const results = await Promise.all([buy(), buy()]);
  expect(results.map(result => result.status)).toEqual([200, 200]);
  expect((await User.findById(user._id)).wallet_balance).toBe(17000);
  expect(await Tx.countDocuments({ user_id: user._id, type: 'subscription' })).toBe(1);
  expect(await Sub.countDocuments({ user_id: user._id, status: 'active' })).toBe(1);
});
it('resumes one provider request with the original return reference under concurrent checkout', async () => {
  const provider = vi.spyOn(pawapay, 'createDeposit').mockResolvedValue({ status: 'ACCEPTED' });
  const body = { payment_method: 'pawapay', phone: '237670000001', redirect_url: 'https://attacker.test/steal' };
  const results = await Promise.all([buy(body), buy(body)]);
  expect(results.map(result => result.status)).toEqual([200, 200]);
  expect(provider).toHaveBeenCalledTimes(1);
  expect(results[0].body.data.reference).toBe(results[1].body.data.reference);
  for (const result of results) {
    const url = new URL(result.body.data.checkout_url);
    expect(url.hostname).toBe('auradime.com');
    expect(url.searchParams.get('ref')).toBe(result.body.data.reference);
  }
});
it('keeps rate-limited or uncertain PawaPay requests pending', async () => {
  vi.spyOn(pawapay, 'createDeposit').mockRejectedValue({ response: { status: 429 }, message: 'Rate limited' });
  const response = await buy({ payment_method: 'pawapay', phone: '237670000001' }).expect(202);
  expect((await Tx.findOne({ reference: response.body.data.reference })).status).toBe('pending');
  expect(await Sub.countDocuments({ user_id: user._id })).toBe(0);
});
it('reports a definite insufficient-funds subscription decline without activation', async () => {
  vi.spyOn(pawapay, 'createDeposit').mockResolvedValue({ status: 'REJECTED', rejectionReason: { rejectionCode: 'INSUFFICIENT_FUNDS' } });
  const response = await buy({ payment_method: 'pawapay', phone: '237670000001' }).expect(422);
  expect(response.body.code).toBe('INSUFFICIENT_FUNDS');
  expect(await Sub.countDocuments({ user_id: user._id })).toBe(0);
});
it('retains a PayUnit decline in the transaction history', async () => {
  vi.spyOn(payunit, 'initializePayment').mockRejectedValue({ response: { status: 400 }, message: 'Declined' });
  await buy({ payment_method: 'payunit', phone: '237670000001' }).expect(400);
  expect(await Tx.countDocuments({ user_id: user._id, status: 'failed', gateway: 'payunit' })).toBe(1);
});
it('does not grant a future subscription early and expires old records accurately', async () => {
  await act({ started_at: '2035-01-01T00:00:00Z' }).expect(200);
  const current = await service.getSubscriptionStatus(user, 'vendor');
  expect(current.access_allowed).toBe(false);
  await Sub.updateMany({ user_id: user._id }, { started_at: new Date('2020-01-01'), expires_at: new Date('2020-02-01') });
  const overview = await request(app).get('/api/v1/subscriptions/admin/overview').set(asUser(admin)).expect(200);
  expect(overview.body.data.stats.active).toBe(0);
  expect((await Sub.findOne({ user_id: user._id })).status).toBe('expired');
});
it.each([{ started_at: 'invalid' }, { expires_at: 'invalid' }, { started_at: '2030-01-02', expires_at: '2030-01-01' }])('rejects invalid activation dates %j', async body => {
  await act(body).expect(400);
  expect(await Sub.countDocuments({ user_id: user._id })).toBe(0);
});
it('activates free plans without fabricating a paid transaction', async () => {
  await Plan.updateOne({ _id: plan._id }, { price: 0 });
  await buy().expect(200);
  expect((await User.findById(user._id)).wallet_balance).toBe(20000);
  expect(await Tx.countDocuments({ user_id: user._id })).toBe(0);
  expect((await Sub.findOne({ user_id: user._id })).amount_paid).toBe(0);
});
it('refunds the original payment to the wallet exactly once and nets revenue', async () => {
  const purchase = await buy().expect(200), id = purchase.body.data.subscription._id;
  for (let i = 0; i < 2; i++) await request(app).patch('/api/v1/subscriptions/admin/subscriptions/' + id).set(asUser(admin)).send({ action: 'refund' }).expect(200);
  expect((await User.findById(user._id)).wallet_balance).toBe(20000);
  expect(await Tx.countDocuments({ user_id: user._id, type: 'refund', status: 'completed' })).toBe(1);
  const overview = await request(app).get('/api/v1/subscriptions/admin/overview').set(asUser(admin)).expect(200);
  expect(overview.body.data.stats.revenue).toBe(0);
  await request(app).patch('/api/v1/subscriptions/admin/subscriptions/' + id).set(asUser(admin)).send({ action: 'activate' }).expect(409);
});
it('retains plans and paid subscription history used by financial records', async () => {
  const purchase = await buy().expect(200);
  await request(app).delete('/api/v1/subscriptions/admin/plans/' + plan._id).set(asUser(admin)).expect(409);
  await request(app).delete('/api/v1/subscriptions/admin/subscriptions/' + purchase.body.data.subscription._id).set(asUser(admin)).expect(409);
  expect(await Plan.findById(plan._id)).toBeTruthy();
});
it('honours purchased duration after a plan edit and never reapplies the same payment', async () => {
  vi.spyOn(pawapay, 'createDeposit').mockResolvedValue({ status: 'ACCEPTED' });
  const response = await buy({ payment_method: 'pawapay', phone: '237670000001' }).expect(200);
  const transaction = await Tx.findOneAndUpdate({ reference: response.body.data.reference }, { status: 'completed' }, { returnDocument: 'after' });
  await Plan.updateOne({ _id: plan._id }, { duration_days: 365 });
  const first = await service.activateSubscription({ userId: user._id, planId: plan._id, role: 'vendor', transaction, source: 'pawapay' });
  const days = (first.expires_at - first.started_at) / 86400000;
  expect(days).toBeCloseTo(30, 3);
  const replay = await service.activateSubscription({ userId: user._id, planId: plan._id, role: 'vendor', transaction, source: 'pawapay' });
  expect(String(replay._id)).toBe(String(first._id));
  expect(await Sub.countDocuments({ user_id: user._id })).toBe(1);
});
it('resumes the original provider when the user switches gateways during a pending payment', async () => {
  const firstProvider = vi.spyOn(pawapay, 'createDeposit').mockResolvedValue({ status: 'ACCEPTED' });
  const otherProvider = vi.spyOn(payunit, 'initializePayment');
  const first = await buy({ payment_method: 'pawapay', phone: '237670000001' }).expect(200);
  const resumed = await buy({ payment_method: 'payunit', phone: '237670000001' }).expect(200);
  expect(resumed.body.data.reference).toBe(first.body.data.reference);
  expect(resumed.body.data.gateway).toBe('pawapay');
  expect(new URL(resumed.body.data.checkout_url).searchParams.get('gateway')).toBe('pawapay');
  expect(firstProvider).toHaveBeenCalledTimes(1); expect(otherProvider).not.toHaveBeenCalled();
});
it('applies distinct confirmed payments to a same-plan extension without duplicate active records', async () => {
  const payments = await Tx.create([0, 1].map(index => ({ user_id: user._id, type: 'subscription', amount: 3000, currency: 'XAF', status: 'completed',
    reference: 'RENEW-' + index, gateway: 'wallet', description: 'Confirmed renewal', metadata: { plan_id: plan._id, role: 'vendor' } })));
  await Promise.all(payments.map(transaction => service.activateSubscription({ userId: user._id, planId: plan._id, role: 'vendor', transaction, source: 'wallet' })));
  const active = await Sub.findOne({ user_id: user._id, status: 'active' });
  expect((active.expires_at - new Date()) / 86400000).toBeGreaterThan(59.9);
  expect(await Sub.countDocuments({ user_id: user._id, status: 'active' })).toBe(1);
});
it('honours partial requirement updates and rejects invalid requirement values', async () => {
  await request(app).patch('/api/v1/subscriptions/admin/requirements').set(asUser(admin)).send({ requirements: { customer: true }, grace_days: { vendor: 5 } }).expect(200);
  const settings = await Settings.findOne();
  expect(settings.subscription_required_roles.logistics).toBe(false);
  expect((await service.getRoleRequirements()).grace_days.vendor).toBe(5);
  await request(app).patch('/api/v1/subscriptions/admin/requirements').set(asUser(admin)).send({ requirements: { vendor: 'false' } }).expect(400);
});
it('records manual admin activations as complimentary rather than fabricating payment', async () => {
  const response = await act({}).expect(200);
  expect(response.body.data.subscription.amount_paid).toBe(0);
  expect(await Tx.countDocuments({ user_id: user._id })).toBe(0);
});
it('does not grant access through an orphaned plan reference', async () => {
  await Sub.create({ user_id: user._id, plan_id: new mongoose.Types.ObjectId(), role: 'vendor', status: 'active', expires_at: new Date(Date.now() + 86400000) });
  expect((await service.getSubscriptionStatus(user, 'vendor')).access_allowed).toBe(false);
});
it('blocks simulated transactions from granting production access', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await expect(service.activateSubscription({ userId: user._id, planId: plan._id, role: 'vendor', transaction: {
      _id: new mongoose.Types.ObjectId(), user_id: user._id, status: 'completed', amount: 3000, currency: 'XAF', metadata: { is_sandbox: true },
    } })).rejects.toThrow(/Simulated payments/);
  } finally { process.env.NODE_ENV = previous; }
  expect(await Sub.countDocuments({ user_id: user._id })).toBe(0);
});
it('rejects fractional XAF prices before a rounded debit can differ from the ledger', async () => {
  await request(app).patch('/api/v1/subscriptions/admin/plans/' + plan._id).set(asUser(admin)).send({ price: 3000.5 }).expect(400);
  expect((await Plan.findById(plan._id)).price).toBe(3000);
  expect((await User.findById(user._id)).wallet_balance).toBe(20000);
});
it('cannot reuse a payment owned by another account to obtain its subscription', async () => {
  const purchase = await buy().expect(200);
  const transaction = await Tx.findById(purchase.body.data.transaction._id);
  const other = await createVendorUser();
  await expect(service.activateSubscription({ userId: other._id, planId: plan._id, role: 'vendor', transaction, source: 'wallet' })).rejects.toThrow(/matching completed payment/);
  expect(await Sub.countDocuments({ user_id: other._id })).toBe(0);
});
