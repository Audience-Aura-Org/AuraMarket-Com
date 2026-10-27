'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');
const Withdrawal = require('../models/WithdrawalRequest.model');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const Settings = require('../models/PlatformSettings.model');
const AuditLog = require('../models/AuditLog.model');
const pawapay = require('./payment/gateways/pawapay.gateway');
const { creditBalance } = require('./wallet.service');
const {isAutoEligible,supportedPawaPayoutPhone} = require('../utils/withdrawalAutomation');
const { sendNotification } = require('../utils/notifier');
const error = (statusCode,message) => Object.assign(new Error(message),{statusCode});

async function settleResult(id, payoutId, result, app) {
  const raw=String(result?.status || '').toUpperCase();
  const normalized=pawapay.normalizePawaPayoutStatus(raw);
  const terminal=raw==='REJECTED'||normalized==='FAILED'?'failed':normalized==='SUCCESSFUL'?'completed':null;
  if(!terminal){
    return Withdrawal.findOneAndUpdate({_id:id,status:'approved',eversend_transaction_id:payoutId},{$set:{eversend_status:raw || 'UNKNOWN'}},{returnDocument:'after'});
  }
  const session=await mongoose.startSession();let changed;
  try {
    await session.withTransaction(async()=>{
      changed=await Withdrawal.findOneAndUpdate({_id:id,status:'approved',eversend_transaction_id:payoutId},{$set:{status:terminal,eversend_status:raw,...(terminal==='failed'?{balance_deducted:false,failure_reason:result.failureReason?.failureMessage || 'PawaPay payout rejected.'}:{failure_reason:null})}},{session,returnDocument:'before'});
      if(!changed)return;
      if(terminal==='failed'&&changed.balance_deducted)await creditBalance(changed.requested_by,changed.amount,session);
      await Transaction.updateOne({'metadata.withdrawal_request_id':changed._id},{$set:{status:terminal,gateway_response:result}},{session});
      await AuditLog.create([{user_id:changed.reviewed_by || changed.requested_by,action:'withdrawal_pawapay_'+terminal,target_type:'WithdrawalRequest',target_id:changed._id,changes:{old:{status:'approved'},new:{status:terminal}},metadata:{details:{payoutId,automatic:changed.auto_approved}}}],{session});
    });
  }finally{await session.endSession();}
  if(changed){
    await sendNotification(app,changed.requested_by,{title:terminal==='completed'?'Withdrawal completed':'Payout failed',message:terminal==='completed'?`${changed.amount.toLocaleString()} ${changed.currency} was paid via PawaPay.`:'PawaPay rejected the payout. The reserved amount has been restored to your wallet.',type:'wallet_update',metadata:{withdrawal_id:id,link:'/wallet'}}).catch(()=>{});
    if(terminal==='failed')await require('../utils/walletSocket').emitWalletUpdate(app?.get?.('io'),changed.requested_by,{type:'withdrawal_reversal',reference:id}).catch(()=>{});
  }
  return Withdrawal.findById(id);
}

async function approvePawaWithdrawal({id, actorId, automaticEpoch=null, app}) {
  const session=await mongoose.startSession();let claimed;
  try {
    await session.withTransaction(async()=>{
      const wr=await Withdrawal.findById(id).session(session);
      if(!wr)throw error(404,'Withdrawal request not found.');
      if(wr.status!=='pending')throw error(409,'Withdrawal has already been reviewed or claimed.');
      const settings=await Settings.getSettings(session);
      if(settings.withdrawals_maintenance_mode)throw error(409,'Withdrawals are paused.');
      if(automaticEpoch && (settings.withdrawal_automation.epoch!==automaticEpoch || !isAutoEligible(wr,settings.withdrawal_automation)))throw error(409,'Request is outside the current automatic approval window.');
      const owner=await User.findById(wr.requested_by).session(session);
      if(!owner?.is_active)throw error(409,'Withdrawal owner is missing or inactive. No payout was sent.');
      if(!wr.balance_deducted)throw error(409,'Withdrawal balance has not been reserved. Review it manually.');
      if(wr.withdrawal_method!=='momo' || wr.currency!=='XAF' || String(wr.recipient_details?.country).toUpperCase()!=='CM' || !supportedPawaPayoutPhone(wr.recipient_details?.phone_number))throw error(400,pawapay.isOrangeEnabled()?'PawaPay payouts support validated MTN and Orange Cameroon numbers only. Unknown numbers require manual review.':'PawaPay payouts support validated MTN Cameroon numbers only. Orange and unknown numbers require manual review.');
      if(wr.amount<100)throw error(400,'PawaPay payouts require at least 100 XAF.');
      const payoutId=crypto.randomUUID();
      claimed=await Withdrawal.findOneAndUpdate({_id:id,status:'pending'},{$set:{status:'approved',payout_gateway:'pawapay',eversend_transaction_id:payoutId,eversend_status:'SUBMITTING',reviewed_by:actorId,reviewed_at:new Date(),auto_approved:Boolean(automaticEpoch),failure_reason:null}},{session,returnDocument:'after'});
      if(!claimed)throw error(409,'Withdrawal has already been claimed.');
      const tx=await Transaction.updateOne({'metadata.withdrawal_request_id':wr._id,user_id:wr.requested_by,amount:wr.amount,currency:wr.currency,status:'pending'},{$set:{gateway:'pawapay',gateway_transaction_id:payoutId,description:'Withdrawal via PawaPay to '+pawapay.normalizePhone(wr.recipient_details.phone_number),'metadata.auto_approved':Boolean(automaticEpoch)}},{session});
      if(tx.matchedCount!==1)throw error(409,'Pending withdrawal ledger entry is missing. Review it manually.');
      await AuditLog.create([{user_id:actorId,action:automaticEpoch?'withdrawal_auto_approved':'withdrawal_approved',target_type:'WithdrawalRequest',target_id:wr._id,changes:{old:{status:'pending'},new:{status:'approved'}},metadata:{details:{payoutId,epoch:automaticEpoch}}}],{session});
    });
  }finally{await session.endSession();}
  // The intent and stable provider reference are committed BEFORE any external call.
  let result;
  try {
    result=await pawapay.createPayout({payoutId:claimed.eversend_transaction_id,amount:claimed.amount,currency:claimed.currency,correspondent:pawapay.detectProvider(claimed.recipient_details.phone_number),phone:claimed.recipient_details.phone_number,description:'Auradime withdrawal',clientRef:String(claimed._id)});
  }catch(failure){
    // A timeout/5xx can follow provider acceptance: retain the reservation and
    // reconcile the same payout ID, never pay twice or refund an uncertain payout.
    if(failure.response?.status>=400 && failure.response.status<500 && ![408,409,429].includes(failure.response.status)){
      return settleResult(id,claimed.eversend_transaction_id,{status:'REJECTED',failureReason:{failureMessage:failure.response?.data?.message || failure.message}},app);
    }
    await Withdrawal.updateOne({_id:id,status:'approved',eversend_status:'SUBMITTING'},{$set:{eversend_status:'UNKNOWN',failure_reason:'Provider confirmation pending. Recheck this payout; do not submit a second payout.'}});
    return Withdrawal.findById(id);
  }
  const final=await settleResult(id,claimed.eversend_transaction_id,result,app) || await Withdrawal.findById(id);
  if(final?.status==='approved')await sendNotification(app,claimed.requested_by,{title:'Withdrawal approved',message:`Your ${claimed.amount.toLocaleString()} ${claimed.currency} withdrawal is processing via PawaPay.`,type:'wallet_update',metadata:{withdrawal_id:id,link:'/wallet'}}).catch(()=>{});
  return final || Withdrawal.findById(id);
}

let timer, running=false;
async function processAutomaticWithdrawals(app) {
  if(running)return;running=true;
  try {
    const settings=await Settings.findOne().lean(),policy=settings?.withdrawal_automation;
    if(policy?.enabled && !settings.withdrawals_maintenance_mode){
      const pending=await Withdrawal.find({status:'pending',auto_approval_epoch:policy.epoch,createdAt:{$gt:policy.activated_at}}).sort({createdAt:1,_id:1}).limit(25);
      for(const wr of pending){
        if(!isAutoEligible(wr,policy))continue;
        try{await approvePawaWithdrawal({id:wr._id,actorId:policy.activated_by,automaticEpoch:policy.epoch,app});}
        catch(failure){
          // Invalid or no-longer-eligible requests return to manual review;
          // they cannot block later eligible requests in the durable queue.
          if(failure.statusCode && failure.statusCode<500)await Withdrawal.updateOne({_id:wr._id,status:'pending',auto_approval_epoch:policy.epoch},{$set:{auto_approval_epoch:null,failure_reason:'Automatic approval requires manual review: '+failure.message}});
          else console.error('[withdrawalAutomation]',failure.message);
        }
      }
    }
    // Confirmation of already-submitted payouts continues even if disabled.
    const processing=await Withdrawal.find({status:'approved',auto_approved:true,payout_gateway:'pawapay',eversend_transaction_id:{$ne:null}}).sort({payout_checked_at:1,reviewed_at:1}).limit(10).lean();
    for(const wr of processing){
      try{
        let response=await pawapay.getPayoutStatus(wr.eversend_transaction_id);
        if(response?.status==='NOT_FOUND' && Date.now()-new Date(wr.reviewed_at).getTime()>=60000)response={status:'FAILED',failureReason:{failureMessage:'The payout did not reach PawaPay. The reserved balance has been restored.'}};
        await settleResult(wr._id,wr.eversend_transaction_id,response,app);
      }catch(failure){console.warn('[withdrawalAutomation] confirmation deferred:',failure.message);}
      finally{await Withdrawal.updateOne({_id:wr._id},{$set:{payout_checked_at:new Date()}});}
    }
  }finally{running=false;}
}
function startAutomaticWithdrawalWorker(app){
  if(timer)return;const run=()=>processAutomaticWithdrawals(app).catch(error=>console.error('[withdrawalAutomation]',error.message));
  timer=setInterval(run,15000);timer.unref();run();
}
module.exports={approvePawaWithdrawal,processAutomaticWithdrawals,startAutomaticWithdrawalWorker,settleResult};
