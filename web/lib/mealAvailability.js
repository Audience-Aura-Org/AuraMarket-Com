/**
 * One availability rule for meals (mirrors the backend dine queries in
 * restaurant.controller: `meal.is_available_today: { $ne: false }` OR a
 * `pre_order` booking option). A meal switched off for today can still be
 * pre-ordered; how it is fulfilled (delivery / pickup / dine-in) is chosen in
 * the meal sheet, so delivery availability never makes a meal unavailable.
 */
export const offersPreorder = (meal = {}) =>
  (meal?.meal?.booking_options || []).some((option) => option?.type === 'pre_order');

export const isMealUnavailable = (meal = {}) =>
  meal?.meal?.is_available_today === false && !offersPreorder(meal);
