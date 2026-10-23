'use strict'
const request=require('supertest'),mongoose=require('mongoose')
const {buildApp}=require('../setup/app'),{createUser,createAdmin}=require('../factories'),{asUser}=require('../helpers/auth')
const Settings=require('../../models/PlatformSettings.model'),Withdrawal=require('../../models/WithdrawalRequest.model'),Transaction=require('../../models/Transaction.model'),User=require('../../models/User.model')
const pawapay=require('../../services/payment/gateways/pawapay.gateway'),service=require('../../services/pawaWithdrawalApproval.service')
const {isAutoEligible,supportedMtnPhone}=require('../../utils/withdrawalAutomation')
const processQueue=service.processAutomaticWithdrawals
let app,admin,user,settings,provider
beforeAll(()=>{app=buildApp()})
beforeEach(async()=>{
 settings=await Settings.create({subscription_required_roles:{vendor:false,logistics:false,customer:false}})
 admin=await createAdmin();user=await createUser({wallet_balance:5000})
 provider=vi.spyOn(pawapay,'createPayout').mockResolvedValue({status:'ACCEPTED'})
 vi.spyOn(pawapay,'getPayoutStatus').mockResolvedValue({status:'SUBMITTED'})
 vi.spyOn(service,'processAutomaticWithdrawals').mockResolvedValue()
})
afterEach(()=>vi.restoreAllMocks())
const toggle=enabled=>request(app).patch('/api/v1/withdrawals/admin/automation').set(asUser(admin)).send({enabled})
const seed=async(policy,overrides={})=>{
 const wr=await Withdrawal.create({requested_by:user._id,role:'user',amount:1000,currency:'XAF',withdrawal_method:'momo',recipient_details:{phone_number:'+237670000001',first_name:'Buyer',last_name:'One',country:'CM'},status:'pending',balance_deducted:true,auto_approval_epoch:policy?.epoch || null,createdAt:new Date(Date.now()+100),...overrides})
 await Transaction.create({user_id:user._id,type:'withdrawal',amount:1000,currency:'XAF',status:'pending',gateway:'manual',reference:'WD-'+wr._id,description:'Reserved withdrawal',metadata:{withdrawal_request_id:wr._id}})
 return wr
}
it('starts disabled, restricts the toggle to admins, and preserves the activation on repeated enables',async()=>{
 expect((await request(app).get('/api/v1/withdrawals/admin/automation').set(asUser(admin))).body.data.enabled).toBe(false)
 expect((await request(app).patch('/api/v1/withdrawals/admin/automation').set(asUser(user)).send({enabled:true})).status).toBe(403)
 const first=await toggle(true),again=await toggle(true)
 expect(first.status).toBe(200);expect(again.body.data.epoch).toBe(first.body.data.epoch);expect(again.body.data.activated_at).toBe(first.body.data.activated_at)
})
it('excludes the historical queue and requests from a previous activation',async()=>{
 const old=await seed(null),policy=(await toggle(true)).body.data,newer=await seed(policy)
 await toggle(false);const next=(await toggle(true)).body.data
 expect(isAutoEligible(old,next)).toBe(false);expect(isAutoEligible(newer,next)).toBe(false)
 await expect(service.approvePawaWithdrawal({id:old._id,actorId:admin._id,automaticEpoch:next.epoch,app})).rejects.toMatchObject({statusCode:409})
 expect(provider).not.toHaveBeenCalled()
})
it('persists the provider reference before calling PawaPay and prevents concurrent approval',async()=>{
 const policy=(await toggle(true)).body.data,wr=await seed(policy)
 provider.mockImplementation(async payload=>{
  const stored=await Withdrawal.findById(wr._id),tx=await Transaction.findOne({'metadata.withdrawal_request_id':wr._id})
  expect(stored.status).toBe('approved');expect(stored.eversend_transaction_id).toBe(payload.payoutId);expect(tx.gateway_transaction_id).toBe(payload.payoutId)
  return {status:'ACCEPTED'}
 })
 const results=await Promise.allSettled([service.approvePawaWithdrawal({id:wr._id,actorId:admin._id,automaticEpoch:policy.epoch,app}),service.approvePawaWithdrawal({id:wr._id,actorId:admin._id,app})])
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(provider).toHaveBeenCalledTimes(1)
 expect((await Withdrawal.findById(wr._id)).status).toBe('approved');expect((await User.findById(user._id)).wallet_balance).toBe(5000)
})
it.each(['+237655000001','+237659000001','+237690000001','+237620000001','+237600000001','+234670000001'])('keeps Orange, unknown and foreign number %s manual',async phone=>{
 const policy=(await toggle(true)).body.data,wr=await seed(policy,{recipient_details:{phone_number:phone,first_name:'Buyer',last_name:'One',country:'CM'}})
 expect(isAutoEligible(wr,policy)).toBe(false)
 await expect(service.approvePawaWithdrawal({id:wr._id,actorId:admin._id,app})).rejects.toMatchObject({statusCode:400});expect(provider).not.toHaveBeenCalled()
})
it('recognizes the MTN prefix boundary without treating Orange 655-659 as MTN',()=>{
 expect(supportedMtnPhone('+237654000001')).toBe(true);expect(supportedMtnPhone('+237680000001')).toBe(true)
 expect(pawapay.detectProvider('+237655000001')).toBe('ORANGE_MONEY_CMR')
})
it('retains uncertain payouts and reconciles completion without refund or a second submission',async()=>{
 const wr=await seed(null);provider.mockRejectedValue(Object.assign(new Error('timeout'),{code:'ETIMEDOUT'}))
 const result=await service.approvePawaWithdrawal({id:wr._id,actorId:admin._id,app})
 expect(result.status).toBe('approved');expect(result.eversend_status).toBe('UNKNOWN')
 await service.settleResult(wr._id,result.eversend_transaction_id,{status:'COMPLETED'},app)
 await service.settleResult(wr._id,result.eversend_transaction_id,{status:'FAILED'},app)
 expect((await Withdrawal.findById(wr._id)).status).toBe('completed');expect((await User.findById(user._id)).wallet_balance).toBe(5000);expect(provider).toHaveBeenCalledTimes(1)
})
it('restores a definitively rejected payout exactly once',async()=>{
 const wr=await seed(null);provider.mockResolvedValue({status:'REJECTED',failureReason:{failureMessage:'Rejected'}})
 const result=await service.approvePawaWithdrawal({id:wr._id,actorId:admin._id,app})
 await service.settleResult(wr._id,result.eversend_transaction_id,{status:'FAILED'},app)
 expect(result.status).toBe('failed');expect((await User.findById(user._id)).wallet_balance).toBe(6000)
})
it('stamps only newly submitted requests with the active epoch',async()=>{
 const policy=(await toggle(true)).body.data
 const result=await request(app).post('/api/v1/withdrawals').set(asUser(user)).send({amount:1000,currency:'XAF',withdrawal_method:'momo',recipient_details:{phone_number:'+237670000001',first_name:'Buyer',last_name:'One',country:'CM'}})
 expect(result.status).toBe(201);expect(result.body.data.withdrawal.auto_approval_epoch).toBe(policy.epoch)
})
it('recovers a durable queued request and restores a payout confirmed not found after a crash',async()=>{
 const policy=(await toggle(true)).body.data,wr=await seed(policy)
 await processQueue(app);expect(provider).toHaveBeenCalledTimes(1)
 await Withdrawal.updateOne({_id:wr._id},{$set:{reviewed_at:new Date(Date.now()-120000)}})
 vi.mocked(pawapay.getPayoutStatus).mockResolvedValue({status:'NOT_FOUND'})
 await toggle(false);await processQueue(app)
 expect((await Withdrawal.findById(wr._id)).status).toBe('failed')
 expect((await User.findById(user._id)).wallet_balance).toBe(6000)
})
it('serializes an admin choosing another gateway against automatic PawaPay approval',async()=>{
 const eversend=require('../../services/eversend.service')
 const quote=vi.spyOn(eversend,'getPayoutQuotation').mockResolvedValue({data:{token:'quote',quotation:{sourceCurrencyBalanceAfter:10000}}})
 const payout=vi.spyOn(eversend,'executeMomoPayout').mockResolvedValue({data:{transaction:{id:'eversend-payout',status:'pending'}}})
 const policy=(await toggle(true)).body.data,wr=await seed(policy)
 await Promise.allSettled([
  service.approvePawaWithdrawal({id:wr._id,actorId:admin._id,automaticEpoch:policy.epoch,app}),
  request(app).post('/api/v1/withdrawals/admin/'+wr._id+'/approve').set(asUser(admin)).send({payout_gateway:'eversend'}),
 ])
 expect(provider.mock.calls.length+payout.mock.calls.length).toBe(1)
 expect((await Withdrawal.findById(wr._id)).status).toBe('approved')
})
it('rejects a mismatched reserved ledger amount before any provider call',async()=>{
 const wr=await seed(null)
 await Transaction.updateOne({'metadata.withdrawal_request_id':wr._id},{$set:{amount:500}})
 await expect(service.approvePawaWithdrawal({id:wr._id,actorId:admin._id,app})).rejects.toMatchObject({statusCode:409})
 expect(provider).not.toHaveBeenCalled();expect((await Withdrawal.findById(wr._id)).status).toBe('pending')
})
