import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
function worker(windows=[]) {
  const listeners={},show=vi.fn().mockResolvedValue(),open=vi.fn().mockResolvedValue();
  const self={location:{origin:'https://auradime.com'},addEventListener:(name,fn)=>{listeners[name]=fn},registration:{showNotification:show},clients:{},skipWaiting:vi.fn()};
  const clients={matchAll:vi.fn().mockResolvedValue(windows),openWindow:open,claim:vi.fn()};
  const context={self,clients,URL,console,caches:{},fetch:vi.fn(),setTimeout,clearTimeout,Request,Response};vm.createContext(context);vm.runInContext(readFileSync('public/sw.js','utf8'),context);
  const push=async payload=>{let pending;listeners.push({data:{json:()=>payload},waitUntil:p=>{pending=p}});await pending};
  return {listeners,show,open,push};
}
describe('PWA notification delivery',()=>{
  it('shows an OS alert in the background with the order deep link',async()=>{const w=worker();await w.push({title:'Order updated',body:'Shipped',data:{url:'/orders/one'}});expect(w.show).toHaveBeenCalledOnce();expect(w.show.mock.calls[0][1].data.url).toBe('/orders/one')});
  // Every Web Push must show a notification (userVisibleOnly): browsers revoke push for sites that stay silent.
  it('forwards foreground updates to the open tab and still shows the OS alert',async()=>{const postMessage=vi.fn();const w=worker([{visibilityState:'visible',postMessage}]);await w.push({title:'Order updated',data:{url:'/orders/one'}});expect(postMessage).toHaveBeenCalledWith({type:'push-received',payload:{title:'Order updated',data:{url:'/orders/one'}}});expect(w.show).toHaveBeenCalledOnce()});
  it('shows message pushes as chat alerts, even while that conversation is open',async()=>{const w=worker([{visibilityState:'visible',postMessage:vi.fn()}]);w.listeners.message({data:{type:'set-active-chat',partnerId:'sender'}});await w.push({tag:'msg-sender',title:'New message'});expect(w.show).toHaveBeenCalledOnce();expect(w.show.mock.calls[0][1]).toMatchObject({tag:'msg-sender',actions:[{action:'open',title:'Reply'},{action:'close',title:'Dismiss'}]})});
  it('keeps notification click navigation inside the app',async()=>{const w=worker();let pending;w.listeners.notificationclick({notification:{close:vi.fn(),data:{url:'javascript:alert(1)'}},waitUntil:p=>{pending=p}});await pending;expect(w.open).toHaveBeenCalledWith('https://auradime.com/notifications')});
});
