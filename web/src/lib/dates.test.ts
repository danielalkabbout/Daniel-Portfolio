import { describe, expect, it } from 'vitest';
import { duration, fmtMonth, monthIndex } from './dates';

describe('dates', () => {
  it('formats months and the present', () => {
    expect(fmtMonth('2024-09')).toBe('September 2024');
    expect(fmtMonth('2024-09', true)).toBe('Sep 2024');
    expect(fmtMonth(null, true)).toBe('Present');
  });

  it('counts both the first and last month', () => {
    expect(duration('2024-06', '2024-08')).toBe('3 months');
    expect(duration('2024-09', '2026-03')).toBe('1 year 7 months');
  });

  it('sorts by month', () => {
    expect(monthIndex('2026-04')).toBeGreaterThan(monthIndex('2024-02'));
  });
});
