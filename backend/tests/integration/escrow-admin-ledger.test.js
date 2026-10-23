'use strict'
const request=require('supertest')
const mongoose=require('mongoose')
const {buildApp}=require('../setup/app')
const {createUser,createAdmin,createVendorUser,createOrder}=require('../factories')
const {asUser}=require('../helpers/auth')
const Escrow=require('../../models/Escrow.model')
const Vendor=require('../../models/Vendor.model')
const User=require('../../models/User.model')
const Dispute=require('../../models/Dispute.model')
const PlatformSettings=require('../../models/PlatformSettings.model')
let app,admin,buyer,owner,vendor
beforeAll(()=>{app=buildApp()})
beforeEach(async()=>{
 await PlatformSettings.create({subscription_required_roles:{vendor:false,logistics:false,customer:false}})
 admin=await createAdmin();buyer=await createUser();owner=await createVendorUser()
 vendor=await Vendor.create({user_id:owner._id,store_name:'Ledger Vendor',phone:'+237670000001'})
})
const list=query=>request(app).get('/api/v1/admin/escrow/logs').query(query||{}).set(asUser(admin))
const fixture=async()=>{
 const order=await createOrder({customerId:buyer._id,vendorId:vendor._id},{payment_status:'paid'})
 const escrow=await Escrow.create({order_id:order._id,buyer_id:buyer._id,vendor_id:vendor._id,amount:100})
 return {order,escrow}
}
it('preserves orphan references and reports why settlement is blocked',async()=>{
 const orderId=new mongoose.Types.ObjectId(),vendorId=new mongoose.Types.ObjectId()
 await Escrow.create({order_id:orderId,vendor_id:vendorId,buyer_id:buyer._id,amount:100})
 const res=await list({search:String(orderId).slice(-8)})
 expect(res.status).toBe(200);expect(res.body.total).toBe(1)
 const row=res.body.data.logs[0]
 expect(row.order_reference).toBe(String(orderId));expect(row.vendor_reference).toBe(String(vendorId))
 expect(row.settlement.blocked).toBe(true);expect(row.settlement.missing).toEqual(['order','vendor'])
 expect((await request(app).post('/api/v1/escrow/release/'+orderId).set(asUser(admin))).status).toBe(400)
 expect((await Escrow.findById(row._id)).status).toBe('held')
})
it('paginates before population and keeps global totals and stable date ties',async()=>{
 const date=new Date('2026-08-11T15:19:38Z')
 await Escrow.insertMany(Array.from({length:21},()=>({order_id:new mongoose.Types.ObjectId(),buyer_id:buyer._id,vendor_id:vendor._id,amount:100,createdAt:date})))
 const first=await list({limit:20}),second=await list({limit:20,page:2})
 expect(first.body.total).toBe(21);expect(first.body.pages).toBe(2);expect(first.body.data.logs).toHaveLength(20)
 expect(second.body.data.logs).toHaveLength(1);expect(first.body.data.logs.some(row=>row._id===second.body.data.logs[0]._id)).toBe(false)
 expect(first.body.data.stats[0].totalAmount).toBe(2100)
 expect((await list({search:'.*'})).body.total).toBe(0)
})
it.each(['vendor','wallet'])('rejects a missing %s without changing escrow or balances',async missing=>{
 const {order,escrow}=await fixture()
 if(missing==='vendor')await Vendor.deleteOne({_id:vendor._id});else await User.deleteOne({_id:owner._id})
 const before=(await User.findById(buyer._id)).wallet_balance
 const res=await request(app).post('/api/v1/escrow/release/'+order._id).set(asUser(admin))
 expect(res.status).toBe(400);expect(res.body.message).toContain('missing')
 expect((await Escrow.findById(escrow._id)).status).toBe('held');expect((await User.findById(buyer._id)).wallet_balance).toBe(before)
 expect((await list()).body.data.logs[0].settlement.blocked).toBe(true)
})
it('blocks release and refund while an active dispute exists even for legacy held escrow',async()=>{
 const {order,escrow}=await fixture()
 await Dispute.create({order_id:order._id,initiator_id:buyer._id,reason:'other',description:'Dispute requires review'})
 for(const action of ['release','refund']){
  const res=await request(app).post('/api/v1/escrow/'+action+'/'+order._id).set(asUser(admin)).send({reason:'Review'})
  expect(res.status).toBe(400);expect(res.body.message).toContain('dispute')
 }
 expect((await Escrow.findById(escrow._id)).status).toBe('held')
 expect((await list()).body.data.logs[0].settlement.reason).toContain('dispute')
})
