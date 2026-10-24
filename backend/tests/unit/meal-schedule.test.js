const { validateMealSchedule } = require('../../services/meal-schedule.service');
const now = new Date('2026-10-22T12:00:00Z');
const product = { is_meal: true, meal: { booking_options: [{ type: 'pre_order', available_weekdays: [5, 6] }] } };
it('allows Friday and Saturday and preserves the selected date', () => {
 expect(validateMealSchedule(product, 'pre_order', '2026-10-23', now).toISOString().slice(0,10)).toBe('2026-10-23');
 expect(validateMealSchedule(product, 'pre_order', '2026-10-24', now).toISOString().slice(0,10)).toBe('2026-10-24');
});
it('rejects other weekdays, invalid dates and past dates', () => {
 for (const date of ['2026-10-25', '2026-02-30', '2026-10-22', 'invalid', null]) expect(() => validateMealSchedule(product, 'pre_order', date, now)).toThrow();
});
it('requires the requested mode to be configured', () => { expect(() => validateMealSchedule(product, 'delivery', null, now)).toThrow(/mode/); });
it('combines exact dates, weekdays and windows', () => {
 const p = { is_meal: true, meal: { booking_options: [{ type: 'pre_order', available_dates: [new Date('2026-10-24')], available_weekdays: [6], available_until: new Date('2026-10-24') }] } };
 expect(validateMealSchedule(p, 'pre_order', '2026-10-24', now)).toBeInstanceOf(Date);
 expect(() => validateMealSchedule(p, 'pre_order', '2026-10-31', now)).toThrow();
});
it('does not block future preorders because today is unavailable', () => { expect(validateMealSchedule({ ...product, meal: { ...product.meal, is_available_today: false } }, 'pre_order', '2026-10-24', now)).toBeInstanceOf(Date); });
it('leaves retail scheduling unchanged', () => { expect(validateMealSchedule({ is_meal: false }, 'delivery', null, now)).toBeNull(); });
