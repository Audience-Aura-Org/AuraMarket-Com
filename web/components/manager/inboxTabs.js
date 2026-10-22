/** Inbox tabs → backend task types (manager.controller collectTasks). */
export const INBOX_TABS = [
  { value: 'all', label: 'All', types: null },
  { value: 'orders', label: 'Orders', types: ['order'] },
  { value: 'deliveries', label: 'Deliveries', types: ['shipment'] },
  { value: 'messages', label: 'Messages', types: ['message'] },
  { value: 'issues', label: 'Issues', types: ['kyc', 'dispute'] },
];

const tabFor = (value) => INBOX_TABS.find((t) => t.value === value) || INBOX_TABS[0];

export function tasksForTab(tasks = [], tab = 'all') {
  const { types } = tabFor(tab);
  return types ? tasks.filter((t) => types.includes(t.type)) : tasks;
}

export function tabCounts(tasks = []) {
  return Object.fromEntries(INBOX_TABS.map((t) => [t.value, tasksForTab(tasks, t.value).length]));
}

const HOUR = 3600e3;

/** How late a waiting item is: amber after a day, red after three. */
export function ageTone(at, now = Date.now()) {
  const age = now - new Date(at).getTime();
  if (age > 72 * HOUR) return 'bad';
  if (age > 24 * HOUR) return 'warn';
  return 'neutral';
}

export const TASK_TYPE_LABEL = {
  order: 'Order',
  shipment: 'Delivery',
  message: 'Message',
  kyc: 'Verification',
  dispute: 'Dispute',
};
