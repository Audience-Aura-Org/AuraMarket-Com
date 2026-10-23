'use strict'
const mongoose=require('mongoose'),request=require('supertest')
const {buildApp}=require('../setup/app'),{createUser,createAdmin,createVendorUser,createOrder}=require('../factories'),{asUser}=require('../helpers/auth')
const Escrow=require('../../models/Escrow.model'),Vendor=require('../../models/Vendor.model'),Transaction=require('../../models/Transaction.model'),User=require('../../models/User.model')
const {archiveOrphanEscrow}=require('../../services/escrowReconciliation.service')
let app,buyer,orderId,vendorId,escrow
beforeAll(()=>{app=buildApp()})
beforeEach(async()=>{
 buyer=await createUser({wallet_balance:500});orderId=new mongoose.Types.ObjectId();vendorId=new mongoose.Types.ObjectId()
 escrow=await Escrow.create({order_id:orderId,vendor_id:vendorId,buyer_id:buyer._id,amount:100})
 await Transaction.create([{user_id:buyer._id,order_id:orderId,type:'payment',status:'completed',amount:100,gateway:'escrow',reference:'ORIGINAL-'+escrow._id,description:'Original debit'},{user_id:new mongoose.Types.ObjectId(),order_id:orderId,type:'payout',status:'pending',amount:100,gateway:'escrow',reference:'PENDING-'+escrow._id,description:'Held payout',metadata:null}])
})
const archive=async()=>{const session=await mongoose.startSession();try{let result;await session.withTransaction(async()=>{result=await archiveOrphanEscrow(mongoose.connection.db,escrow._id,session)});return result}finally{await session.endSession()}}
it('archives the orphan, cancels its pending payout, preserves the charge and does not move wallet funds',async()=>{
 expect((await archive()).archived).toBe(true);expect(await Escrow.findById(escrow._id)).toBeNull()
 expect((await archive()).alreadyArchived).toBe(true)
 const record=await mongoose.connection.db.collection('escrowarchives').findOne({_id:escrow._id});expect(record.transactions).toHaveLength(2)
 expect((await Transaction.findOne({order_id:orderId,type:'payout'})).status).toBe('failed')
 expect((await Transaction.findOne({order_id:orderId,type:'payment'})).status).toBe('completed')
 expect((await User.findById(buyer._id)).wallet_balance).toBe(500)
})
it('refuses removal if the original order exists',async()=>{
 await createOrder({customerId:buyer._id,vendorId},{_id:orderId})
 await expect(archive()).rejects.toThrow('original records');expect(await Escrow.findById(escrow._id)).not.toBeNull()
})
it('blocks self-deletion before removing financial references or disabling the account',async()=>{
 const response=await request(app).post('/api/v1/auth/delete-account').set(asUser(buyer)).send({confirmText:'DELETE'})
 expect(response.status).toBe(409);expect((await User.findById(buyer._id)).is_active).toBe(true)
 expect(await Escrow.findById(escrow._id)).not.toBeNull()
})
it('blocks administrative and bulk deletion of an escrow vendor',async()=>{
 const owner=await createVendorUser(),admin=await createAdmin();await Vendor.create({_id:vendorId,user_id:owner._id,store_name:'Escrow vendor',phone:'+237670000001'})
 await expect(require('../../utils/accountDeletionGuard')([owner._id,buyer._id])).rejects.toMatchObject({statusCode:409})
 const response=await request(app).delete('/api/v1/admin/users/'+owner._id).set(asUser(admin))
 expect(response.status).toBe(409);expect(await Vendor.findById(vendorId)).not.toBeNull()
})
