const {notificationChannels}=require('../../utils/notificationPolicy')
it('honours message and order preferences while retaining in-app records',()=>{
 expect(notificationChannels({notification_preferences:{push_orders:false}},'order_status')).toEqual({push:false,email:true})
 expect(notificationChannels({},'message')).toEqual({push:true,email:false})
 expect(notificationChannels({},'promo')).toEqual({push:false,email:false})
 expect(notificationChannels({role:'manager',manager_settings:{notify_push:false}},'security').push).toBe(false)
})
