'use strict';
async function archiveOrphanEscrow(db,id,session) {
  const options={session},escrows=db.collection('escrows'),archives=db.collection('escrowarchives');
  const escrow=await escrows.findOne({_id:id},options);
  if(!escrow){if(await archives.findOne({_id:id},options))return {alreadyArchived:true};throw new Error('Escrow not found.');}
  if(!['held','pending_release'].includes(escrow.status))throw new Error('Only unresolved orphaned escrow can be archived.');
  const [order,vendor,dispute]=await Promise.all([
    db.collection('orders').findOne({_id:escrow.order_id},options),
    db.collection('vendors').findOne({_id:escrow.vendor_id},options),
    db.collection('disputes').findOne({order_id:escrow.order_id,status:{$in:['pending','investigating']}},options),
  ]);
  if(order || vendor || dispute)throw new Error('Reconciliation blocked: original records or an active dispute exist.');
  const transactions=await db.collection('transactions').find({order_id:escrow.order_id},options).toArray();
  if(!transactions.some(tx=>tx.type==='payment'&&tx.status==='completed'&&String(tx.user_id)===String(escrow.buyer_id)&&tx.amount===escrow.amount&&tx.gateway==='escrow'))throw new Error('Matching original payment evidence is missing.');
  if(transactions.some(tx=>tx.type==='payout'&&tx.status==='completed'))throw new Error('A completed payout exists; reconcile it manually.');
  const archivedAt=new Date();
  await archives.insertOne({_id:id,escrow,transactions,resolution:'operator_requested_removal',reason:'Original order and vendor were deleted; operator explicitly requested removal from the active system.',archived_at:archivedAt,actor_type:'operator_request',wallet_transfer:0,original_amount:escrow.amount},options);
  for(const transaction of transactions.filter(tx=>tx.type==='payout'&&tx.status==='pending'))await db.collection('transactions').updateOne({_id:transaction._id,status:'pending'},{$set:{status:'failed',description:'Orphaned escrow payout cancelled during operator-requested reconciliation.',updatedAt:archivedAt,metadata:{...(transaction.metadata || {}),escrow_archive_id:id}}},options);
  const removed=await escrows.deleteOne({_id:id,status:escrow.status},options);
  if(removed.deletedCount!==1)throw new Error('Escrow changed during reconciliation.');
  return {archived:true,escrowId:String(id),amount:escrow.amount,walletTransfer:0};
}
module.exports={archiveOrphanEscrow};
