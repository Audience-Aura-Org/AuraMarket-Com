import { it, expect, vi } from 'vitest';
vi.mock('./api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
import api from './api';
import personal from './personalMessagingApi';
it('binds reads, sends, retries and deletions to the signed-in identity', () => {
  personal.get('/chat', { timeout: 100 });
  personal.post('/chat', { text: 'hello' }, { __skipRetry: true });
  personal.patch('/chat/read/partner');
  personal.delete('/chat/message/id', { data: { type: 'everyone' } });
  expect(api.get).toHaveBeenCalledWith('/chat', { timeout: 100, __noActAs: true });
  expect(api.post).toHaveBeenCalledWith('/chat', { text: 'hello' }, { __skipRetry: true, __noActAs: true });
  expect(api.patch).toHaveBeenCalledWith('/chat/read/partner', undefined, { __noActAs: true });
  expect(api.delete).toHaveBeenCalledWith('/chat/message/id', { data: { type: 'everyone' }, __noActAs: true });
});
