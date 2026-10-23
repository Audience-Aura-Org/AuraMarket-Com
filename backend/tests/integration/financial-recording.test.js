'use strict'
const request = require('supertest')
const mongoose = require('mongoose')
const axios = require('axios')
const { buildApp } = require('../setup/app')
const { createUser, createVendorUser } = require('../factories')
const { asUser } = require('../helpers/auth')
const User = require('../../models/User.model')
const Transaction = require('../../models/Transaction.model')
const AuditLog = require('../../models/AuditLog.model')
const Plan = require('../../models/SubscriptionPlan.model')
const Settings = require('../../models/PlatformSettings.model')
const wallet = require('../../services/wallet.service')
const payunit = require('../../services/payunit.service')
const eversend = require('../../services/eversend.service')
const pawapay = require('../../services/payment/gateways/pawapay.gateway')
let app
beforeAll(async () => { app = buildApp(); await Promise.all([AuditLog.init(), Transaction.init()]) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
const payment = (user, gateway) => request(app).post('/api/v1/payments/' + gateway + '/initialize').set(asUser(user)).send({amount:5000,currency:'XAF',phone:'237670000001',country:'CM',provider:'CM_MTNMOMO'})
it('records the actor and before/after wallet amounts using the actual audit schema', async () => {
 const user=await createUser({wallet_balance:1000})
 await wallet.adjustBalance(user._id,500,null,{reference:'AUDIT-CREDIT',idempotency_key:'audit-credit'})
 await wallet.adjustBalance(user._id,500,null,{reference:'AUDIT-CREDIT',idempotency_key:'audit-credit'})
 const logs=await AuditLog.find({target_id:user._id,action:'wallet_credit'}).lean()
 expect(logs).toHaveLength(1);expect(String(logs[0].user_id)).toBe(String(user._id));expect(logs[0].changes.old.wallet_balance).toBe(1000);expect(logs[0].changes.new.wallet_balance).toBe(1500);expect(logs[0].metadata.details.reference).toBe('AUDIT-CREDIT')
})
it('rolls wallet audit records back with the financial transaction', async () => {
 const user=await createUser({wallet_balance:1000});const session=await mongoose.startSession();session.startTransaction()
 try { await wallet.creditBalance(user._id,500,session);await session.abortTransaction() } finally { await session.endSession() }
 expect((await User.findById(user._id)).wallet_balance).toBe(1000);expect(await AuditLog.countDocuments({target_id:user._id})).toBe(0)
})
it('stores PawaPay net credit and fees before the provider can send a callback', async () => {
 vi.stubEnv('PAWAPAY_SANDBOX_MODE','false');const user=await createUser()
 const spy=vi.spyOn(axios,'post').mockImplementation(async (url,body)=>{
  expect(url).toContain('/v2/deposits');const tx=await Transaction.findOne({gateway_transaction_id:body.depositId}).lean()
  expect(tx).toBeTruthy();expect(tx.amount).toBe(5000);expect(tx.metadata.net_amount).toBe(5000);expect(Number(body.amount)).toBe(tx.metadata.gross_amount)
  return {data:{status:'ACCEPTED'}}
 })
 const res=await payment(user,'pawapay');expect(res.status).toBe(200);expect(spy).toHaveBeenCalledOnce()
})
it('retains the PawaPay ledger reference after a transport timeout', async () => {
 vi.stubEnv('PAWAPAY_SANDBOX_MODE','false');const user=await createUser();vi.spyOn(axios,'post').mockRejectedValue(Object.assign(new Error('Gateway timeout'),{code:'ETIMEDOUT'}))
 await payment(user,'pawapay');const tx=await Transaction.findOne({user_id:user._id,gateway:'pawapay'}).lean()
 expect(tx.status).toBe('pending');expect(tx.gateway_transaction_id).toBeTruthy();expect(tx.amount).toBe(5000)
})
it('records PayUnit before calling the provider', async () => {
 const user=await createUser();vi.spyOn(payunit,'initializePayment').mockImplementation(async opts=>{const tx=await Transaction.findOne({reference:opts.transactionId});expect(tx?.amount).toBe(5000);return {data:{transaction_id:opts.transactionId}}})
 vi.spyOn(payunit,'makeMobilePayment').mockResolvedValue({data:{payment_status:'PENDING'}})
 expect((await payment(user,'payunit')).status).toBe(200)
})
it('records Eversend before calling the provider', async () => {
 vi.stubEnv('EVERSEND_SANDBOX_MODE','false');const user=await createUser();const spy=vi.spyOn(eversend,'initiateCollection').mockImplementation(async opts=>{expect(opts.phone).toBe('+237670000001');const tx=await Transaction.findOne({reference:opts.transactionRef});expect(tx?.amount).toBe(5000);return {success:true,data:{transactionId:'eversend-test'}}})
 expect((await payment(user,'eversend')).status).toBe(200);expect(spy).toHaveBeenCalledOnce()
})
it('retains pending subscription payments when the provider response is lost', async () => {
 const user=await createVendorUser();await Settings.create({subscription_required_roles:{vendor:true}})
 const plan=await Plan.create({name:'Audit plan',slug:'audit-plan',price:5000,currency:'XAF',roles:['vendor'],is_active:true})
 vi.spyOn(pawapay,'createDeposit').mockRejectedValue(Object.assign(new Error('Gateway timeout'),{code:'ETIMEDOUT'}))
 const res=await request(app).post('/api/v1/subscriptions/initialize').set(asUser(user)).send({plan_id:plan._id,role:'vendor',payment_method:'pawapay',currency:'XAF',phone:'237670000001',country:'CM'})
 expect(res.status).toBe(202);expect(res.body.status).toBe('PENDING')
 const tx=await Transaction.findOne({reference:res.body.data.reference});expect(tx.status).toBe('pending');expect(tx.gateway_transaction_id).toBe(tx.metadata.depositId)
})
it('rejects a deposit currency that cannot be credited to the XAF wallet', async () => {
 const user=await createUser();const spy=vi.spyOn(eversend,'initiateCollection')
 const res=await request(app).post('/api/v1/payments/eversend/initialize').set(asUser(user)).send({amount:5000,currency:'NGN',phone:'237670000001',country:'CM'})
 expect(res.status).toBe(400);expect(spy).not.toHaveBeenCalled();expect(await Transaction.countDocuments({user_id:user._id})).toBe(0)
})
it('records hosted PawaPay before requesting the payment page', async () => {
 vi.stubEnv('PAWAPAY_SANDBOX_MODE','false');const user=await createUser()
 const spy=vi.spyOn(pawapay,'createCheckout').mockImplementation(async opts=>{const tx=await Transaction.findOne({gateway_transaction_id:opts.checkoutId});expect(tx?.amount).toBe(5000);return {redirectUrl:'https://checkout.test/page'}})
 const res=await request(app).post('/api/v1/payments/pawapay/checkout/initialize').set(asUser(user)).send({amount:5000,currency:'XAF'})
 expect(res.status).toBe(200);expect(spy).toHaveBeenCalledOnce()
})
it('rejects subscription currency manipulation before any debit or provider call', async () => {
 const user=await createVendorUser({wallet_balance:20000});const plan=await Plan.create({name:'Currency plan',slug:'currency-plan',price:5000,currency:'XAF',roles:['vendor'],is_active:true})
 const res=await request(app).post('/api/v1/subscriptions/initialize').set(asUser(user)).send({plan_id:plan._id,role:'vendor',payment_method:'wallet',currency:'NGN'})
 expect(res.status).toBe(400);expect((await User.findById(user._id)).wallet_balance).toBe(20000)
})

it('settles concurrent Eversend rechecks once and denies another account access', async () => {
 const owner=await createUser({wallet_balance:0}),stranger=await createUser()
 const tx=await Transaction.create({description:'Audit regression payment',user_id:owner._id,type:'deposit',amount:5000,currency:'XAF',status:'pending',gateway:'eversend',gateway_transaction_id:'ev-concurrent',reference:'EV-CONCURRENT',createdAt:new Date(Date.now()-120000)})
 const spy=vi.spyOn(eversend,'getTransactionStatus').mockResolvedValue({data:{status:'SUCCESSFUL'}})
 const path='/api/v1/payments/eversend/recheck/'+tx.reference
 expect((await request(app).get(path).set(asUser(stranger))).status).toBe(404)
 expect(spy).not.toHaveBeenCalled()
 await Promise.all([request(app).get(path).set(asUser(owner)),request(app).get(path).set(asUser(owner))])
 expect((await request(app).get(path).set(asUser(owner))).body.status).toBe('SUCCESSFUL')
 expect((await User.findById(owner._id)).wallet_balance).toBe(5000)
})
it('does not turn an Eversend withdrawal confirmation into a wallet deposit', async () => {
 const owner=await createUser({wallet_balance:0})
 const tx=await Transaction.create({description:'Audit regression payment',user_id:owner._id,type:'withdrawal',amount:5000,status:'pending',gateway:'eversend',reference:'EV-WITHDRAWAL'})
 const spy=vi.spyOn(eversend,'getTransactionStatus')
 const result=await request(app).get('/api/v1/payments/eversend/recheck/'+tx.reference).set(asUser(owner))
 expect(result.status).toBe(404);expect(spy).not.toHaveBeenCalled();expect((await User.findById(owner._id)).wallet_balance).toBe(0)
})
it('cannot reset a completed transaction to enable a second credit', async () => {
 const {createAdmin}=require('../factories');const admin=await createAdmin(),owner=await createUser({wallet_balance:5000})
 const tx=await Transaction.create({description:'Audit regression payment',user_id:owner._id,type:'deposit',amount:5000,status:'completed',gateway:'eversend',reference:'COMPLETED-NO-RESET'})
 const result=await request(app).patch('/api/v1/admin/transactions/'+tx._id).set(asUser(admin)).send({status:'pending'})
 expect(result.status).toBe(409);expect((await Transaction.findById(tx._id)).status).toBe('completed');expect((await User.findById(owner._id)).wallet_balance).toBe(5000)
})
it.each(['payunit','eversend','pawapay'])('persists P2P intent and shipment metadata before %s can callback', async gateway => {
 const {initiateP2PGatewayPayment}=require('../../controllers/p2p.controller')
 const owner=await createUser(),shipment={_id:new mongoose.Types.ObjectId()}
 const assertIntent=async()=>{const tx=await Transaction.findOne({user_id:owner._id,gateway});expect(tx?.metadata.type).toBe('p2p');expect(String(tx.metadata.shipment_id)).toBe(String(shipment._id));expect(tx.amount).toBe(5000);expect(tx.type).toBe('payment')}
 vi.stubEnv('EVERSEND_SANDBOX_MODE','false');vi.stubEnv('PAWAPAY_SANDBOX_MODE','false')
 if(gateway==='payunit'){vi.spyOn(payunit,'initializePayment').mockImplementation(async()=>{await assertIntent();return {data:{}}});vi.spyOn(payunit,'makeMobilePayment').mockResolvedValue({data:{}})}
 if(gateway==='eversend')vi.spyOn(eversend,'initiateCollection').mockImplementation(async()=>{await assertIntent();return {success:true,data:{transactionId:'P2P-EV'}}})
 if(gateway==='pawapay')vi.spyOn(axios,'post').mockImplementation(async()=>{await assertIntent();return {data:{status:'ACCEPTED'}}})
 const result=await initiateP2PGatewayPayment({gateway,phone:'237670000001',amount:5000,platformFee:100,user:owner,shipment,trackingCode:'TRACK-TEST',req:{protocol:'https',hostname:'api.test'}})
 expect(result.reference).toBeTruthy()
})
it('atomically records an admin-confirmed wallet collection and rejects replay', async () => {
 const {createAdmin}=require('../factories');const admin=await createAdmin(),owner=await createUser({wallet_balance:0})
 const tx=await Transaction.create({description:'Audit regression payment',user_id:owner._id,type:'deposit',amount:5000,status:'pending',gateway:'eversend',reference:'ADMIN-CONFIRM-ONCE'})
 const path='/api/v1/admin/transactions/'+tx._id
 expect((await request(app).patch(path).set(asUser(admin)).send({status:'completed',admin_note:'Receipt checked'})).status).toBe(200)
 expect((await User.findById(owner._id)).wallet_balance).toBe(5000)
 expect((await request(app).patch(path).set(asUser(admin)).send({status:'completed'})).status).toBe(409)
 expect((await User.findById(owner._id)).wallet_balance).toBe(5000)
 expect(await AuditLog.countDocuments({target_id:tx._id,action:'payment_settled'})).toBe(1)
})
