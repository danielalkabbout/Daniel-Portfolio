/** Month helpers. Content stores months as "YYYY-MM"; a missing end means "present". */

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function ym(v?: string | null): [number, number] {
  if (!v) {
    const d = new Date();
    return [d.getFullYear(), d.getMonth()];
  }
  const [y, m] = v.split('-');
  return [Number(y), Number(m) - 1];
}

/** Month index, handy for widths and sorting. */
export const monthIndex = (v?: string | null) => {
  const [y, m] = ym(v);
  return y * 12 + m;
};

export function fmtMonth(v?: string | null, short = false) {
  if (!v) return short ? 'Present' : 'present';
  const [y, m] = ym(v);
  return `${short ? MONTHS[m].slice(0, 3) : MONTHS[m]} ${y}`;
}

export function duration(start: string, end?: string | null) {
  const n = monthIndex(end) - monthIndex(start) + 1;
  const y = Math.floor(n / 12);
  const m = n % 12;
  const out: string[] = [];
  if (y) out.push(`${y} ${y > 1 ? 'years' : 'year'}`);
  if (m) out.push(`${m} ${m > 1 ? 'months' : 'month'}`);
  return out.join(' ');
}
