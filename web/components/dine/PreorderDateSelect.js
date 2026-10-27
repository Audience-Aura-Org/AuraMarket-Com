'use client';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';

export function eligiblePreorderDates(meal, now = new Date()) {
 const rule = (meal?.booking_options || []).find(option => option.type === 'pre_order') || {};
 const exact = meal?.available_date?.slice(0,10);
 const today = new Date(now.getTime() + 3600000).toISOString().slice(0,10);
 const start = new Date(today + 'T12:00:00Z');
 const keys = exact ? [exact] : rule.available_dates?.length ? rule.available_dates.map(value => value.slice(0,10)) : Array.from({length: 366}, (_, i) => new Date(start.getTime() + (i + 1) * 86400000).toISOString().slice(0,10));
 return [...new Set(keys)].filter(key => key > today && (!rule.available_from || key >= rule.available_from.slice(0,10)) && (!rule.available_until || key <= rule.available_until.slice(0,10)) && (!rule.available_weekdays?.length || rule.available_weekdays.includes(new Date(key + 'T12:00:00Z').getUTCDay())) && new Date(key + 'T12:00:00+01:00').getTime() >= now.getTime() + Math.max(0, Number(rule.lead_time_minutes) || 0) * 60000).sort();
}

// Date keys are "YYYY-MM-DD"; all calendar maths stays in UTC so keys never shift a day.
const monthKey = (key) => key.slice(0, 7);
const shiftMonth = (month, delta) => {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
};
const monthDays = (month) => {
  const first = new Date(`${month}-01T12:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
};
const label = (key, options) => new Date(key + 'T12:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', ...options });
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => label(`2024-01-0${i + 1}`, { weekday: 'narrow' })); // 2024-01-01 is a Monday

/**
 * Month calendar of the dates a meal can be pre-ordered for. Only eligible
 * days are tappable; an invalid `value` is shown as unselected.
 * Pass `dates` (sorted "YYYY-MM-DD" keys) instead of `meal` when the choices
 * are already known, e.g. the dates every meal in a cart allows.
 */
export default function PreorderDateSelect({ meal, dates: providedDates, value, onChange, className = '' }) {
  const dates = useMemo(() => providedDates || eligiblePreorderDates(meal), [providedDates, meal]);
  const eligible = useMemo(() => new Set(dates), [dates]);
  const selected = eligible.has(value) ? value : '';
  const firstMonth = dates[0] ? monthKey(dates[0]) : null;
  const lastMonth = dates.length ? monthKey(dates[dates.length - 1]) : null;
  const [month, setMonth] = useState(() => (selected ? monthKey(selected) : firstMonth));
  useEffect(() => { if (!month || month < firstMonth || month > lastMonth) setMonth(selected ? monthKey(selected) : firstMonth); }, [firstMonth, lastMonth, month, selected]);

  if (!dates.length || !month) {
    return <p role="status" className={`flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-3 text-[11px] text-[var(--text-secondary)] ${className}`}>
      <CalendarClock className="size-4 shrink-0" aria-hidden="true" />No preorder dates available
    </p>;
  }

  const navButton = 'flex size-9 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] disabled:pointer-events-none disabled:opacity-25';
  return (
    <div role="group" aria-label="Preorder date" className={`mx-auto w-full max-w-[360px] rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" className={navButton} onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= firstMonth} aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-[12px] font-semibold capitalize text-[var(--text-primary)]" aria-live="polite">{label(`${month}-01`, { month: 'long', year: 'numeric' })}</p>
        <button type="button" className={navButton} onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= lastMonth} aria-label="Next month">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day, i) => <span key={i} className="pb-1 text-[10px] font-medium text-[var(--text-secondary)]">{day}</span>)}
        {monthDays(month).map((key, i) => {
          if (!key) return <span key={`blank-${i}`} />;
          const day = Number(key.slice(8));
          if (!eligible.has(key)) {
            return <span key={key} className="flex h-10 items-center justify-center text-[11px] text-[var(--text-secondary)] opacity-35">{day}</span>;
          }
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={isSelected}
              aria-label={label(key, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              className={`flex h-10 items-center justify-center rounded-xl text-[12px] font-semibold tabular-nums transition-colors ${
                isSelected
                  ? 'bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/30'
                  : 'border border-[var(--accent)]/25 bg-[var(--accent)]/5 text-[var(--text-primary)] hover:bg-[var(--accent)]/15'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex items-center gap-1.5 border-t border-[var(--glass-border)] pt-2.5 text-[11px] text-[var(--text-secondary)]">
        <CalendarClock className="size-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        {selected
          ? <span className="text-[11px] font-semibold text-[var(--text-primary)]">{label(selected, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          : <span className="text-[11px]">Choose an available date ({dates.length} open)</span>}
      </p>
    </div>
  );
}
