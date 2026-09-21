/* Shared utilities: dates, formatting, ids, helpers. */

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Bangladesh Standard Time (Asia/Dhaka) is fixed UTC+6 with no DST. */
const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Local date -> 'YYYY-MM-DD' (no UTC shifting). */
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The current instant expressed in Bangladesh Standard Time.
 * Returns a Date whose local (getFullYear/getMonth/...) components
 * equal the BD wall clock, so all date helpers stay consistent with
 * "today in Bangladesh" no matter what timezone the device is in.
 */
export function bdNow() {
  const d = new Date();
  return new Date(d.getTime() + (d.getTimezoneOffset() + 360) * 60000);
}

/** Today's date in Bangladesh Standard Time, as 'YYYY-MM-DD'. */
export function todayStr() {
  return toDateStr(bdNow());
}

/** 'YYYY-MM-DD' -> Date at local midnight. */
export function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function isValidDateStr(str) {
  const d = parseDate(str);
  if (!d) return false;
  return toDateStr(d) === str;
}

export function isValidTimeStr(str) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(str || '');
}

/** 'HH:MM' -> '6:30 PM' */
export function timeLabel(str) {
  if (!str || !isValidTimeStr(str)) return '';
  const [h, m] = str.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

/** 'YYYY-MM-DD' -> 'Mon, Sep 21' */
export function shortDate(str) {
  const d = parseDate(str);
  if (!d) return '';
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** 'YYYY-MM-DD' -> 'September 21' (adds ', YYYY' if not current year) */
export function humanDate(str) {
  const d = parseDate(str);
  if (!d) return '';
  const base = `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === bdNow().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/** 'YYYY-MM-DD' -> 'Monday, September 21' */
export function fullDate(str) {
  const d = parseDate(str);
  if (!d) return '';
  return `${WEEKDAYS_LONG[d.getDay()]}, ${humanDate(str)}`;
}

/** Bangladesh weekly holidays are Friday & Saturday (work week is Sun–Thu). */
export function isHoliday(str) {
  const d = parseDate(str);
  if (!d) return false;
  const dow = d.getDay();
  return dow === 5 || dow === 6;
}

/** 'YYYY-MM-DD' -> 'Friday' / 'Saturday' when it's a BD holiday, else null. */
export function holidayName(str) {
  if (!isHoliday(str)) return null;
  return WEEKDAYS_LONG[parseDate(str).getDay()];
}

/** Live BD wall-clock, e.g. '9:22:17 PM' (ticked every second). */
export function bdTimeStr() {
  const n = bdNow();
  const h24 = n.getHours();
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')} ${ap}`;
}

/** Combined date + time -> Date at the exact instant those values mean in
    Bangladesh Standard Time (the stored dates are BD calendar dates). */
export function dateTime(str, timeStr) {
  const [y, m, d] = (str || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  let h = 9;
  let min = 0;
  if (isValidTimeStr(timeStr)) {
    const [hh, mm] = timeStr.split(':').map(Number);
    h = hh;
    min = mm;
  }
  // BD wall-clock (UTC+6) -> the corresponding absolute UTC instant.
  return new Date(Date.UTC(y, m - 1, d, h, min) - BD_OFFSET_MS);
}

export function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

export function firstWeekday(y, m) {
  return new Date(y, m, 1).getDay();
}

/** Month key 'YYYY-MM' -> { y, m } */
export function monthKey(y, m) {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function shiftMonth(key, delta) {
  let [y, m] = key.split('-').map(Number);
  m = m - 1 + delta;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return monthKey(y, m);
}

export function currentMonthKey() {
  const now = bdNow();
  return monthKey(now.getFullYear(), now.getMonth());
}

/** Month key 'YYYY-MM' -> 'September 2026' */
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** 6-week (or 5-week) grid of day cells for a month, starting Sunday. */
export function monthGrid(y, m) {
  const total = daysInMonth(y, m);
  const cells = [];
  const offset = firstWeekday(y, m);
  const prevCount = offset;
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 11 : m - 1;
  const prevTotal = daysInMonth(prevY, prevM);
  for (let i = prevCount - 1; i >= 0; i--) {
    cells.push({ date: toDateStr(new Date(prevY, prevM, prevTotal - i)), day: prevTotal - i, inMonth: false });
  }
  for (let d = 1; d <= total; d++) {
    cells.push({ date: toDateStr(new Date(y, m, d)), day: d, inMonth: true });
  }
  const after = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 0 : m + 1;
  for (let d = 1; d <= after; d++) {
    cells.push({ date: toDateStr(new Date(nextY, nextM, d)), day: d, inMonth: false });
  }
  return cells;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isSameDay(a, b) {
  return toDateStr(a) === toDateStr(b);
}

export function greeting() {
  const h = bdNow().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

export const MOTIVATION = [
  'Just start.',
  'Small progress counts.',
  'Keep going.',
  'One more thing done.',
  'Future you will thank you.',
  'Discipline over motivation.',
  'Slow is smooth, smooth is fast.',
  'Consistency beats intensity.',
  'One task at a time.',
  'Every day counts.',
];

export function pickMotivation(dateStr) {
  // Deterministic pick per day so it doesn't shuffle on every re-render.
  const seed = dateStr ? [...dateStr].reduce((a, c) => a + c.charCodeAt(0), 0) : 0;
  return MOTIVATION[seed % MOTIVATION.length];
}

const BDT_LOCALE = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const GLOBAL_LOCALE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export const CURRENCIES = [
  { code: 'BDT', symbol: '৳', label: '৳ — Bangladeshi Taka' },
  { code: 'USD', symbol: '$', label: '$ — US Dollar' },
  { code: 'EUR', symbol: '€', label: '€ — Euro' },
  { code: 'GBP', symbol: '£', label: '£ — British Pound' },
];

export function currencySymbol(code) {
  const c = CURRENCIES.find((x) => x.code === code);
  return c ? c.symbol : '৳';
}

export function formatNumber(n) {
  const locale = n >= 10000 ? BDT_LOCALE : GLOBAL_LOCALE;
  return locale.format(n);
}

export function formatMoney(n, currencyCode) {
  const sym = currencySymbol(currencyCode);
  const abs = Math.abs(n);
  return `${sym}${formatNumber(abs)}`;
}

export function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}