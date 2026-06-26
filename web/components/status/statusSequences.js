"use client";

const getCreatedAtMs = (status) => new Date(status?.createdAt || 0).getTime();

export const getStatusVendorId = (status) => (status?.vendor_id?._id || status?.vendor_id)?.toString();

export const sortStatusesOldestFirst = (statuses = []) => (
  [...statuses].sort((a, b) => {
    const timeDiff = getCreatedAtMs(a) - getCreatedAtMs(b);
    if (timeDiff !== 0) return timeDiff;
    return String(a?._id || '').localeCompare(String(b?._id || ''));
  })
);

export const buildStatusSequences = (statuses = []) => {
  const grouped = new Map();

  for (const status of statuses) {
    const vendorId = getStatusVendorId(status);
    if (!vendorId) continue;

    if (!grouped.has(vendorId)) {
      grouped.set(vendorId, {
        vendorId,
        vendor: status.vendor_id,
        rawItems: [],
      });
    }

    grouped.get(vendorId).rawItems.push(status);
  }

  return Array.from(grouped.values())
    .map((group) => {
      const items = sortStatusesOldestFirst(group.rawItems);
      const latestStory = items[items.length - 1] || null;
      const firstUnviewed = items.find((item) => !item.isViewed) || null;
      const unviewedCount = items.filter((item) => !item.isViewed).length;

      return {
        vendorId: group.vendorId,
        vendor: group.vendor,
        items,
        latestStory,
        firstUnviewed,
        hasUnviewed: unviewedCount > 0,
        unviewedCount,
        latestActivityAt: latestStory?.createdAt || null,
      };
    })
    .sort((a, b) => getCreatedAtMs(b.latestStory) - getCreatedAtMs(a.latestStory));
};

export const markStatusViewed = (statuses = [], storyId) => {
  if (!storyId) return statuses;
  return statuses.map((status) => (
    status._id === storyId ? { ...status, isViewed: true } : status
  ));
};
