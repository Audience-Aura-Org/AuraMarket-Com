const mongoose = require('mongoose');
const ManagerAssignment = require('../models/ManagerAssignment.model');
const User = require('../models/User.model');

async function updateChatView(socket, input = {}) {
  // Clear first: an invalid or revoked workspace cannot retain suppression.
  socket.data.chatView = null;
  const version = (socket.data.chatViewVersion || 0) + 1;
  socket.data.chatViewVersion = version;
  if (!input.visible || !mongoose.isValidObjectId(input.partnerId)) return;
  const accountId = String(input.accountId || socket.userId);
  if (!mongoose.isValidObjectId(accountId)) return;
  if (accountId !== String(socket.userId)) {
    const [manager, target, link] = await Promise.all([
      User.findById(socket.userId).select('role is_active').lean(),
      User.findById(accountId).select('role is_active').lean(),
      ManagerAssignment.findOne({ manager_id: socket.userId, user_id: accountId, status: 'active',
        'permissions.messages': true, $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }] }).lean(),
    ]);
    if (manager?.role !== 'manager' || manager.is_active === false || !target || target.is_active === false || ['admin', 'manager'].includes(target.role) || !link) return;
  }
  if (socket.data.chatViewVersion !== version) return;
  socket.data.chatView = { accountId, partnerId: String(input.partnerId), at: Date.now() };
}

async function isViewingConversation(io, recipientId, metadata = {}) {
  const senderId = metadata.sender_id || metadata.senderId;
  if (!io?.in || !senderId) return false;
  let timeout;
  try {
    const sockets = await Promise.race([
      io.in(String(recipientId)).fetchSockets(),
      new Promise(resolve => { timeout = setTimeout(() => resolve([]), 200); }),
    ]);
    const accountId = String(metadata.managed_account_id || recipientId);
    return sockets.some(socket => {
      const view = socket.data?.chatView;
      return view && view.accountId === accountId && view.partnerId === String(senderId) && Date.now() - view.at < 20000;
    });
  } catch { return false; }
  finally { clearTimeout(timeout); }
}
module.exports = { updateChatView, isViewingConversation };
