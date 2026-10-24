'use strict'
const webPush = require('web-push')
const User = require('../../models/User.model')
const Notification = require('../../models/Notification.model')
const PushSubscription = require('../../models/PushSubscription.model')
const queue = require('../../services/jobQueue.service')
const fcm = require('../../services/fcm.service')
const env = require('../../config/env')
let jobs, send, remove, android, oldKeys
beforeEach(() => {
  oldKeys = [env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY]
  const keys = webPush.generateVAPIDKeys(); env.VAPID_PUBLIC_KEY=keys.publicKey; env.VAPID_PRIVATE_KEY=keys.privateKey
  jobs=[];vi.spyOn(queue,'enqueueJob').mockImplementation((name,handler)=>{if(name==='push')jobs.push(handler);return 'job'})
  vi.spyOn(Notification,'create').mockResolvedValue({_id:'notification-1'})
  vi.spyOn(User,'findById').mockReturnValue({select:()=>({lean:()=>Promise.resolve({preferred_language:'en'})})})
  send=vi.spyOn(webPush,'sendNotification').mockResolvedValue({statusCode:201})
  remove=vi.spyOn(PushSubscription,'deleteOne').mockResolvedValue({deletedCount:1})
  android=vi.spyOn(fcm,'sendAndroidPush').mockResolvedValue({sent:1,failed:0,invalidTokens:[],deliveredTokens:['android-token']})
})
afterEach(()=>{[env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY]=oldKeys;vi.restoreAllMocks();delete require.cache[require.resolve('../../utils/notifier')]})
const webSub = endpoint => ({_id:endpoint,user_id:'owner',channel:'web',subscription:{endpoint,keys:{auth:'test',p256dh:'test'}}})
const notify = async subscriptions => {
  vi.spyOn(PushSubscription,'find').mockReturnValue({lean:()=>Promise.resolve(subscriptions)})
  delete require.cache[require.resolve('../../utils/notifier')]
  await require('../../utils/notifier').sendNotification(null,'owner',{title:'Order updated',message:'Your order has shipped',type:'order_status',metadata:{link:'/orders/one'}})
  expect(jobs).toHaveLength(1)
}
it('keeps Android delivery independent of browser VAPID configuration', async()=>{
  env.VAPID_PUBLIC_KEY='';env.VAPID_PRIVATE_KEY=''
  await notify([{channel:'android',fcm_token:'android-token'}]);await jobs[0]()
  expect(android).toHaveBeenCalledOnce();expect(send).not.toHaveBeenCalled()
})
it('retries transient failures without resending to successful devices',async()=>{
  send.mockImplementation(async sub=>{if(sub.endpoint==='https://push.test/b'&&send.mock.calls.length===2)throw {statusCode:503};return {statusCode:201}})
  await notify([webSub('https://push.test/a'),webSub('https://push.test/b')])
  await expect(jobs[0]()).rejects.toThrow(/Transient/);await jobs[0]()
  expect(send.mock.calls.filter(([sub])=>sub.endpoint.endsWith('/a'))).toHaveLength(1)
  expect(send.mock.calls.filter(([sub])=>sub.endpoint.endsWith('/b'))).toHaveLength(2)
  const payloads=send.mock.calls.map(([,payload])=>JSON.parse(payload));expect(new Set(payloads.map(p=>p.tag)).size).toBe(1)
})
it('does not delete valid browser registrations on a VAPID authorization failure',async()=>{
  send.mockRejectedValue({statusCode:401});await notify([webSub('https://push.test/a')]);await jobs[0]();expect(remove).not.toHaveBeenCalled()
})
it('removes expired browser registrations',async()=>{
  send.mockRejectedValue({statusCode:410});await notify([webSub('https://push.test/a')]);await jobs[0]();expect(remove).toHaveBeenCalledOnce()
})
it('routes managed message alerts to the authorized manager with the receiving account identity', async()=>{
  const Assignment = require('../../models/ManagerAssignment.model');
  vi.spyOn(Assignment,'find').mockReturnValue({lean:async()=>[{manager_id:'manager-a'},{manager_id:'actor-manager'}]});
  vi.spyOn(Assignment,'findOne').mockReturnValue({lean:async()=>({permissions:{messages:true}})});
  const managers = vi.spyOn(User,'find').mockReturnValue({select:()=>({lean:async()=>[{_id:'manager-a'}]})});
  vi.spyOn(PushSubscription,'find').mockReturnValue({lean:async()=>[webSub('https://push.test/device')]});
  delete require.cache[require.resolve('../../utils/notifier')];
  const emit=vi.fn();
  await require('../../utils/notifier').sendNotification({get:()=>({to:()=>({emit})})},'owner',{
    title:'Buyer',message:'Hello',type:'message',metadata:{sender_id:'buyer',actor_id:'actor-manager'},
  });
  expect(managers.mock.calls[0][0]._id.$in).toEqual(['manager-a']);
  expect(emit).toHaveBeenCalledWith('managed_message',{accountId:'owner',senderId:'buyer'});
  expect(jobs).toHaveLength(2);
  await jobs[1]();
  const payload=JSON.parse(send.mock.calls[0][1]);
  expect(payload.title).toBe('Managed account - Buyer');
  expect(payload.data.url).toBe('/manager/as/owner/messages?partnerId=buyer');
  expect(payload.tag).toBe('msg-owner-buyer');
});
