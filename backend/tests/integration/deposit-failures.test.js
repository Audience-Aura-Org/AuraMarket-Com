'use strict'
const request=require('supertest'),axios=require('axios'),crypto=require('crypto')
const {buildApp}=require('../setup/app'),{createUser}=require('../factories'),{asUser}=require('../helpers/auth')
const Settings=require('../../models/PlatformSettings.model'),Transaction=require('../../models/Transaction.model'),User=require('../../models/User.model'),Notification=require('../../models/Notification.model')
const pawapay=require('../../services/payment/gateways/pawapay.gateway')
let app,user,emit
beforeAll(()=>{app=buildApp()})
beforeEach(async()=>{
 user=await createUser({wallet_balance:0});await Settings.create({subscription_required_roles:{vendor:false,logistics:false,customer:false}})
 vi.stubEnv('PAWAPAY_SANDBOX_MODE','false');emit=vi.fn();app.set('io',{to:()=>({emit})})
})
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()})
const failure={status:'FAILED',failureReason:{failureCode:'PAYER_INSUFFICIENT_BALANCE',failureMessage:'Payer balance insufficient'}}
it('reports a rejected deposit immediately with insufficient funds and no wallet credit',async()=>{
 vi.spyOn(axios,'post').mockResolvedValue({data:{...failure,status:'REJECTED'}})
 const response=await request(app).post('/api/v1/payments/pawapay/initialize').set(asUser(user)).send({amount:1000,currency:'XAF',phone:'+237670000001'})
 expect(response.status).toBe(422);expect(response.body.status).toBe('FAILED');expect(response.body.code).toBe('INSUFFICIENT_FUNDS')
 expect((await User.findById(user._id)).wallet_balance).toBe(0);expect((await Transaction.findOne({user_id:user._id})).status).toBe('failed')
 expect(emit.mock.calls.some(call=>call[0]==='payment_status'&&call[1].code==='INSUFFICIENT_FUNDS')).toBe(true)
})
it('preserves the failure reason from a signed callback and returns it from verification without provider polling',async()=>{
 const depositId=crypto.randomUUID(),reference='AURA-PP-'+depositId
 await Transaction.create({user_id:user._id,type:'deposit',amount:1000,status:'pending',gateway:'pawapay',reference,gateway_transaction_id:depositId,description:'Deposit'})
 vi.spyOn(pawapay,'verifyWebhookSignature').mockReturnValue(true);vi.spyOn(pawapay,'checkCallerIp').mockReturnValue({allowed:true})
 await request(app).post('/api/v1/payments/pawapay/webhook/deposit').send({...failure,depositId}).expect(200)
 const provider=vi.spyOn(pawapay,'getDepositStatus').mockRejectedValue(new Error('Must not poll failed deposits'))
 for(const action of ['verify','recheck']){
  const response=await request(app).get('/api/v1/payments/pawapay/'+action+'/'+reference).set(asUser(user))
  expect(response.body.status).toBe('FAILED');expect(response.body.reason).toContain('insufficient funds')
 }
 expect(provider).not.toHaveBeenCalled();expect((await User.findById(user._id)).wallet_balance).toBe(0)
 expect(await Notification.countDocuments({recipient:user._id,title:'Insufficient mobile-money funds'})).toBe(1)
})
it('does not reveal another account deposit or downgrade a completed payment',async()=>{
 const other=await createUser(),depositId=crypto.randomUUID(),reference='AURA-PP-'+depositId
 await Transaction.create({user_id:user._id,type:'deposit',amount:1000,status:'completed',gateway:'pawapay',reference,description:'Deposit'})
 await request(app).get('/api/v1/payments/pawapay/verify/'+reference).set(asUser(other)).expect(404)
 vi.spyOn(pawapay,'verifyWebhookSignature').mockReturnValue(true);vi.spyOn(pawapay,'checkCallerIp').mockReturnValue({allowed:true})
 await request(app).post('/api/v1/payments/pawapay/webhook/deposit').send({...failure,depositId}).expect(200)
 expect((await Transaction.findOne({reference})).status).toBe('completed')
})
