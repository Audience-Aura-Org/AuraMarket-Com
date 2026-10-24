function dayKey(value) { return value instanceof Date ? value.toISOString().slice(0,10) : String(value || '').slice(0,10); }
function scheduleError(message) { const error = new Error(message); error.statusCode = 400; error.status = 400; return error; }
function validateMealSchedule(product, type = 'delivery', value, now = new Date()) {
  if (!product?.is_meal) return null;
  const meal = product.meal || {};
  const options = meal.booking_options || [];
  if (options.length && !options.some(option => (option.type || option) === type)) throw scheduleError('This meal does not support the selected order mode.');
  const exact = dayKey(meal.available_date);
  const today = new Date(now.getTime() + 3600000).toISOString().slice(0,10);
  if (type !== 'pre_order') {
    if (exact && exact !== today) throw scheduleError('This meal is only available on ' + exact + '. Please select preorder.');
    if (meal.is_available_today === false) throw scheduleError('This meal is not available today.');
    return null;
  }
  const key = dayKey(value);
  const date = new Date(key + 'T12:00:00+01:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== key || key <= today) throw scheduleError('Choose a valid future preorder date.');
  const option = options.find(option => option.type === 'pre_order') || {};
  if (exact && key !== exact) throw scheduleError('This meal is only available on ' + exact + '.');
  if (option.available_from && key < dayKey(option.available_from) || option.available_until && key > dayKey(option.available_until)) throw scheduleError('That date is outside the preorder availability window.');
  if (option.available_dates?.length && !option.available_dates.some(value => dayKey(value) === key)) throw scheduleError('This meal is not available on the selected date.');
  if (option.available_weekdays?.length && !option.available_weekdays.includes(date.getUTCDay())) throw scheduleError('This meal is not available on that weekday.');
  if (date.getTime() < now.getTime() + Math.max(0, Number(option.lead_time_minutes) || 0) * 60000) throw scheduleError('Please choose a later date to allow preparation time.');
  return date;
}
module.exports = { validateMealSchedule, dayKey };
