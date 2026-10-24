const { isViewingConversation, updateChatView } = require('../../utils/chatPushPolicy');
const mongoose = require('mongoose');
it('suppresses only a fresh matching account and conversation', async () => {
  const view = { accountId: 'account', partnerId: 'sender', at: Date.now() };
  const io = { in: () => ({ fetchSockets: async () => [{ data: { chatView: view } }] }) };
  expect(await isViewingConversation(io, 'manager', { managed_account_id: 'account', sender_id: 'sender' })).toBe(true);
  expect(await isViewingConversation(io, 'manager', { managed_account_id: 'other', sender_id: 'sender' })).toBe(false);
  expect(await isViewingConversation(io, 'manager', { managed_account_id: 'account', sender_id: 'other' })).toBe(false);
  view.at -= 21000;
  expect(await isViewingConversation(io, 'manager', { managed_account_id: 'account', sender_id: 'sender' })).toBe(false);
});
it('fails open when socket presence cannot be confirmed', async () => {
  expect(await isViewingConversation(null, 'account', { sender_id: 'sender' })).toBe(false);
  expect(await isViewingConversation({ in: () => ({ fetchSockets: async () => { throw Error('down'); } }) }, 'account', { sender_id: 'sender' })).toBe(false);
});
it('clears foreground suppression immediately when hidden', async () => {
  const id = String(new mongoose.Types.ObjectId());
  const socket = { userId: id, data: {} };
  await updateChatView(socket, { accountId: id, partnerId: id, visible: true });
  expect(socket.data.chatView.accountId).toBe(id);
  await updateChatView(socket, { visible: false });
  expect(socket.data.chatView).toBeNull();
});
