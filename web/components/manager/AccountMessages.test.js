import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
const mocks=vi.hoisted(()=>({user:{_id:'managed-owner',name:'Managed Shop'},get:vi.fn(),patch:vi.fn(),post:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuthStore:selector=>selector({user:mocks.user})}));
vi.mock('@/services/api',()=>({default:{get:mocks.get,patch:mocks.patch,post:mocks.post}}));
import AccountMessages from './AccountMessages';
afterEach(cleanup);
beforeEach(()=>{
 vi.clearAllMocks();mocks.patch.mockResolvedValue({data:{success:true}});mocks.post.mockResolvedValue({data:{success:true}});
 mocks.get.mockImplementation(async path=>({data:{success:true,data:path==='/chat'?{activeChats:[{partner:{_id:'buyer',name:'Buyer'},partnerName:'Buyer',snippet:'Hello',unread_count:1}]}:path.includes('threads')?{threads:[]}:{messages:[{_id:'message',text:'Hello from buyer',sender_id:{_id:'buyer',name:'Buyer'},createdAt:'2026-10-23T10:00:00Z'}],total:1}}}));
});
describe('managed account messages',()=>{
 it('binds requests to the managed account and keeps drafts and idempotency keys on failed sends',async()=>{
  render(<AccountMessages/>);fireEvent.click(await screen.findByRole('button',{name:/Buyer.*Hello/}));
  await screen.findByText('Hello from buyer');
  const draft=screen.getByRole('textbox',{name:'Message as managed account'});fireEvent.change(draft,{target:{value:'Managed reply'}});
  mocks.post.mockRejectedValueOnce({response:{data:{message:'Network unavailable'}}});fireEvent.click(screen.getByRole('button',{name:'Send',exact:true}));
  await screen.findByText('Network unavailable');expect(draft.value).toBe('Managed reply');
  fireEvent.click(screen.getByRole('button',{name:'Send',exact:true}));await waitFor(()=>expect(draft.value).toBe(''));
  expect(mocks.post.mock.calls[0][1].client_id).toBe(mocks.post.mock.calls[1][1].client_id);
  expect(mocks.post.mock.calls[0][1].receiver_id).toBe('buyer');
  for(const [,config] of mocks.get.mock.calls){expect(config.headers['X-Act-As']).toBe('managed-owner');expect(config.__noActAs).toBe(true)}
 });
 it('shows access errors without substituting the manager personal inbox',async()=>{
  mocks.get.mockRejectedValue({response:{data:{message:'You do not have messages access for this account.'}}});render(<AccountMessages/>);
  await screen.findByRole('alert');expect(screen.queryByRole('textbox',{name:'Message as managed account'})).toBeNull();
  expect(mocks.get.mock.calls[0][1].headers['X-Act-As']).toBe('managed-owner');
 });
 it('exposes order and delivery conversations in the managed workspace',async()=>{
  render(<AccountMessages/>);await screen.findByRole('button',{name:/Buyer.*Hello/});
  fireEvent.click(screen.getByRole('button',{name:'Order chats',exact:true}));await waitFor(()=>expect(mocks.get).toHaveBeenCalledWith('/messages/order-threads/mine',expect.any(Object)));
  fireEvent.click(screen.getByRole('button',{name:'Delivery chats',exact:true}));await waitFor(()=>expect(mocks.get).toHaveBeenCalledWith('/messages/shipment-threads/mine',expect.any(Object)));
 });
});
