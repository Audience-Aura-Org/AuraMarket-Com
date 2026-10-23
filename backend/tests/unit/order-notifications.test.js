'use strict'
const Vendor = require('../../models/Vendor.model')
const notifier = require('../../utils/notifier')
afterEach(()=>vi.restoreAllMocks())
it('sends order updates to buyer and vendor with their order links and shared target', async () => {
  const send=vi.spyOn(notifier,'sendNotification').mockResolvedValue({})
  vi.spyOn(Vendor,'findById').mockReturnValue({select:()=>Promise.resolve({user_id:'vendor-owner'})})
  const order={_id:'123456789012345678901234',customer_id:'buyer',vendor_id:'vendor'}
  require('../../services/orderSync.service').notifyOrderStatusChange({},order,'shipped')
  await vi.waitFor(()=>expect(send).toHaveBeenCalledTimes(2))
  const buyer=send.mock.calls.find(call=>call[1]==='buyer')[2]
  const vendor=send.mock.calls.find(call=>call[1]==='vendor-owner')[2]
  expect(buyer.type).toBe('order_status');expect(buyer.metadata.target_id).toBe(order._id)
  expect(buyer.metadata.link).toBe('/orders/'+order._id)
  expect(vendor.metadata.link).toBe('/vendor/orders?orderId='+order._id)
})
