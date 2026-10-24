'use client';
export function eligiblePreorderDates(meal, now = new Date()) {
 const rule = (meal?.booking_options || []).find(option => option.type === 'pre_order') || {};
 const exact = meal?.available_date?.slice(0,10);
 const today = new Date(now.getTime() + 3600000).toISOString().slice(0,10);
 const start = new Date(today + 'T12:00:00Z');
 const keys = exact ? [exact] : rule.available_dates?.length ? rule.available_dates.map(value => value.slice(0,10)) : Array.from({length: 366}, (_, i) => new Date(start.getTime() + (i + 1) * 86400000).toISOString().slice(0,10));
 return [...new Set(keys)].filter(key => key > today && (!rule.available_from || key >= rule.available_from.slice(0,10)) && (!rule.available_until || key <= rule.available_until.slice(0,10)) && (!rule.available_weekdays?.length || rule.available_weekdays.includes(new Date(key + 'T12:00:00Z').getUTCDay())) && new Date(key + 'T12:00:00+01:00').getTime() >= now.getTime() + Math.max(0, Number(rule.lead_time_minutes) || 0) * 60000).sort();
}
export default function PreorderDateSelect({ meal, value, onChange, className }) {
 const dates = eligiblePreorderDates(meal);
 return <select aria-label="Preorder date" value={dates.includes(value) ? value : ''} onChange={event => onChange(event.target.value)} className={className}><option value="">{dates.length ? 'Choose an available date' : 'No preorder dates available'}</option>{dates.map(date => <option key={date} value={date}>{new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</option>)}</select>;
}
