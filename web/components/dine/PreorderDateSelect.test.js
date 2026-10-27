import { fireEvent, render, screen, within } from '@testing-library/react';
import PreorderDateSelect from './PreorderDateSelect';
import { describe, it, expect } from 'vitest';
import { eligiblePreorderDates } from './PreorderDateSelect';
describe('preorder date choices', () => {
 const now = new Date('2026-10-22T12:00:00Z');
 it('offers only allowed weekdays', () => {
  const choices = eligiblePreorderDates({ booking_options: [{ type: 'pre_order', available_weekdays: [5, 6] }] }, now);
  expect(choices.slice(0,2)).toEqual(['2026-10-23','2026-10-24']);
  expect(choices.every(date => [5,6].includes(new Date(date+'T12:00:00Z').getUTCDay()))).toBe(true);
 });
 it('limits exact dates to the intersection with allowed weekdays', () => {
  expect(eligiblePreorderDates({ booking_options: [{ type: 'pre_order', available_dates: ['2026-10-23','2026-10-24'], available_weekdays: [6] }] }, now)).toEqual(['2026-10-24']);
 });
 it('offers no invalid locked date or past date', () => {
  expect(eligiblePreorderDates({ available_date: '2026-10-20', booking_options: [] }, now)).toEqual([]);
  expect(eligiblePreorderDates({ available_date: '2026-10-24', booking_options: [{ type: 'pre_order', available_weekdays: [5] }] }, now)).toEqual([]);
 });
});

it('makes only eligible days selectable and shows an invalid value as unselected', () => {
 const picked = [];
 render(<PreorderDateSelect meal={{ booking_options: [{ type: 'pre_order', available_dates: ['2030-01-04','2030-01-05'], available_weekdays: [5] }] }} value="2030-01-05" onChange={date => picked.push(date)} />);
 const calendar = screen.getByRole('group', { name: 'Preorder date' });
 const days = within(calendar).getAllByRole('button').filter(button => /^\d+$/.test(button.textContent));
 expect(days.map(button => button.textContent)).toEqual(['4']);
 expect(days[0].getAttribute('aria-pressed')).toBe('false');
 fireEvent.click(days[0]);
 expect(picked).toEqual(['2030-01-04']);
});

it('says so when no preorder dates are available', () => {
 render(<PreorderDateSelect meal={{ available_date: '2020-01-01', booking_options: [] }} value="" onChange={() => {}} />);
 expect(screen.getByRole('status').textContent).toContain('No preorder dates available');
});
