export const QUICK_REPLIES = [
  "Is this still available?",
  "What's your best price?",
  "Can you deliver to me?",
];

export const fmtDate = (d) => {
  const date = new Date(d), now = new Date();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yest.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

export const sameDay = (a, b) => {
  const d1 = new Date(a), d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
};

export const sameGroup = (m1, m2) => {
  if (!m1 || !m2) return false;
  const s1 = (m1.sender_id?._id || m1.sender_id)?.toString();
  const s2 = (m2.sender_id?._id || m2.sender_id)?.toString();
  if (s1 !== s2) return false;
  return Math.abs(new Date(m2.createdAt) - new Date(m1.createdAt)) < 120000;
};

export const bubbleRounding = (isOwn, withPrev, withNext) => {
  if (isOwn) {
    if (!withPrev && !withNext) return 'rounded-2xl rounded-tr-sm';
    if (!withPrev) return 'rounded-2xl rounded-tr-sm rounded-br-sm';
    if (!withNext) return 'rounded-2xl rounded-br-sm';
    return 'rounded-l-2xl rounded-r-sm';
  }
  if (!withPrev && !withNext) return 'rounded-2xl rounded-tl-sm';
  if (!withPrev) return 'rounded-2xl rounded-tl-sm rounded-bl-sm';
  if (!withNext) return 'rounded-2xl rounded-bl-sm';
  return 'rounded-r-2xl rounded-l-sm';
};
