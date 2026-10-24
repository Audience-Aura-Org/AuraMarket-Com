// Cameroon uses UTC+1 year round. Keep calculations independent of the host timezone.
function computeOpenStatus(hours = [], now = new Date()) {
  if (!hours?.length) return { open_status: 'open', next_status_change_at: null };
  const local = new Date(now.getTime() + 3600000);
  const day = local.getUTCDay();
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 3600000;
  const parseTime = value => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  };
  const intervals = [];
  let invalid = false;
  for (let offset = -1; offset <= 7; offset++) {
    const row = hours.find(row => row.day === (day + offset + 7) % 7);
    if (!row || row.is_closed) continue;
    const opens = parseTime(row.opens), closes = parseTime(row.closes);
    if (opens === null || closes === null) { invalid = true; continue; }
    const start = midnight + offset * 86400000 + opens * 60000;
    const end = midnight + offset * 86400000 + closes * 60000 + (closes <= opens ? 86400000 : 0);
    intervals.push({ start, end });
  }
  // Merge touching shifts so the next change is a real open/closed transition.
  intervals.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const interval of intervals) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  const timestamp = now.getTime();
  const current = merged.find(interval => interval.start <= timestamp && timestamp < interval.end);
  if (current) return { open_status: 'open', next_status_change_at: new Date(current.end) };
  const next = merged.find(interval => interval.start > timestamp);
  return { open_status: !next && invalid ? 'unknown' : 'closed', next_status_change_at: next ? new Date(next.start) : null };
}
module.exports = { computeOpenStatus };
