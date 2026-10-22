import { describe, it, expect } from 'vitest';
import { formatMoney, formatNumber, formatDelta, timeAgo } from './format';

describe('formatMoney', () => {
  it('compacts millions and thousands', () => {
    expect(formatMoney(4820500)).toBe('4.82M');
    expect(formatMoney(860000)).toBe('860K');
  });
  it('keeps small values and zero as-is', () => {
    expect(formatMoney(950)).toBe('950');
    expect(formatMoney(0)).toBe('0');
  });
  it('treats missing values as zero', () => {
    expect(formatMoney(undefined)).toBe('0');
  });
});

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(1284)).toBe('1,284');
  });
});

describe('formatDelta', () => {
  it('reports growth as good', () => {
    expect(formatDelta(112, 100)).toEqual({ text: '+12.0%', tone: 'good' });
  });
  it('reports decline as bad', () => {
    expect(formatDelta(90, 100)).toEqual({ text: '-10.0%', tone: 'bad' });
  });
  it('has no delta when there is no previous period', () => {
    expect(formatDelta(5, 0)).toEqual({ text: '—', tone: 'neutral' });
    expect(formatDelta(0, 0)).toEqual({ text: '—', tone: 'neutral' });
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-21T12:00:00Z').getTime();
  it('buckets into now / minutes / hours / days', () => {
    expect(timeAgo(now - 30e3, now)).toBe('now');
    expect(timeAgo(now - 5 * 60e3, now)).toBe('5m');
    expect(timeAgo(now - 3 * 3600e3, now)).toBe('3h');
    expect(timeAgo(now - 2 * 864e5, now)).toBe('2d');
  });
  it('returns an empty string for a missing date', () => {
    expect(timeAgo(null, now)).toBe('');
  });
});
