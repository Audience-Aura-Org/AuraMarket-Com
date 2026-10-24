const { computeOpenStatus } = require('../../services/restaurant-hours.service');
const friday = [{ day: 5, opens: '22:00', closes: '02:00', is_closed: false }];
it('keeps a Friday overnight shift open after midnight on Saturday', () => {
 const result = computeOpenStatus(friday, new Date('2026-10-24T00:30:00Z'));
 expect(result.open_status).toBe('open'); expect(result.next_status_change_at.toISOString()).toBe('2026-10-24T01:00:00.000Z');
});
it('closes at the exact end and finds the next actual working day', () => {
 const result = computeOpenStatus(friday, new Date('2026-10-24T01:00:00Z'));
 expect(result.open_status).toBe('closed'); expect(result.next_status_change_at.toISOString()).toBe('2026-10-30T21:00:00.000Z');
});
it('reports opening time as a UTC instant independent of the host timezone', () => {
 const result = computeOpenStatus([{ day: 5, opens: '08:00', closes: '22:00' }], new Date('2026-10-23T06:00:00Z'));
 expect(result.open_status).toBe('closed'); expect(result.next_status_change_at.toISOString()).toBe('2026-10-23T07:00:00.000Z');
});
it('merges touching shifts rather than announcing a false closing', () => {
 const result = computeOpenStatus([...friday, { day: 6, opens: '02:00', closes: '04:00' }], new Date('2026-10-24T00:30:00Z'));
 expect(result.next_status_change_at.toISOString()).toBe('2026-10-24T03:00:00.000Z');
});
it('respects closed days and handles missing or invalid schedules', () => {
 expect(computeOpenStatus([], new Date()).open_status).toBe('open');
 expect(computeOpenStatus([{ ...friday[0], is_closed: true }], new Date('2026-10-23T22:00:00Z')).open_status).toBe('closed');
 expect(computeOpenStatus([{ ...friday[0], opens: 'bad' }], new Date('2026-10-23T22:00:00Z')).open_status).toBe('unknown');
});
