'use strict';
function paymentFailure(payload={}) {
  payload=payload || {};
  const detail=payload.failureReason || payload.rejectionReason || payload.error || payload;
  const code=detail.failureCode || detail.rejectionCode || detail.code || detail.errorCode || payload.errorCode || '';
  const text=detail.failureMessage || detail.rejectionMessage || detail.message || detail.errorMessage || payload.message || '';
  const insufficient=/insufficient.*(?:fund|balance)|(?:fund|balance).*insufficient/i.test(code+' '+text);
  const message=insufficient?'Your mobile-money account has insufficient funds. Top up your mobile-money balance and try the deposit again. Your Auradime wallet has not been credited.':text || 'The mobile-money provider declined this payment. Your Auradime wallet has not been credited.';
  return {code:insufficient?'INSUFFICIENT_FUNDS':code || 'PAYMENT_DECLINED',message,reason:message};
}
async function notifyDepositFailure(app,transaction,payload) {
  const failure=paymentFailure(payload);
  app?.get?.('io')?.to(String(transaction.user_id)).emit('payment_status',{gateway:'pawapay',reference:transaction.reference,status:'FAILED',...failure});
  await require('./notifier').sendNotification(app,transaction.user_id,{title:failure.code==='INSUFFICIENT_FUNDS'?'Insufficient mobile-money funds':'Deposit declined',message:failure.message,type:'wallet_update',metadata:{reference:transaction.reference,code:failure.code,link:'/wallet'}}).catch(()=>{});
}
module.exports={paymentFailure,notifyDepositFailure};
