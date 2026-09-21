/* Constants + small settings stored in localStorage. */

import { uid } from './utils.js';

export const PRIORITIES = [
  { id: 'high', label: 'High', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/30' },
  { id: 'medium', label: 'Medium', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/30' },
  { id: 'low', label: 'Low', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400', ring: 'ring-slate-500/30' },
];

export function priorityById(id) {
  return PRIORITIES.find((p) => p.id === id) || PRIORITIES[2];
}

export const REMINDER_OPTIONS = [
  { min: 5, label: '5 minutes before' },
  { min: 15, label: '15 minutes before' },
  { min: 30, label: '30 minutes before' },
  { min: 60, label: '1 hour before' },
  { min: 1440, label: '1 day before' },
];

export function reminderLabel(min) {
  if (!min) return 'No reminder';
  const o = REMINDER_OPTIONS.find((r) => r.min === min);
  if (o) return o.label;
  if (min >= 1440 && min % 1440 === 0) {
    const d = min / 1440;
    return `${d} day${d > 1 ? 's' : ''} before`;
  }
  if (min >= 60 && min % 60 === 0) return `${min / 60} hour${min / 60 > 1 ? 's' : ''} before`;
  return `${min} minutes before`;
}

export const CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Education', 'Gym', 'Mobile/Internet',
  'Household', 'Gifts', 'Technology', 'Savings', 'Other',
];

export const PAYMENT_METHODS = ['Cash', 'Bank', 'Card', 'bKash', 'Nagad', 'Other'];

export const STUDENT_COLORS = [
  { id: 'blue', swatch: 'bg-blue-500', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  { id: 'green', swatch: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  { id: 'purple', swatch: 'bg-purple-500', dot: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', chip: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' },
  { id: 'orange', swatch: 'bg-orange-500', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', chip: 'bg-orange-500/10 text-orange-700 dark:text-orange-300' },
  { id: 'red', swatch: 'bg-red-500', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', chip: 'bg-red-500/10 text-red-700 dark:text-red-300' },
  { id: 'teal', swatch: 'bg-teal-500', dot: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400', chip: 'bg-teal-500/10 text-teal-700 dark:text-teal-300' },
  { id: 'pink', swatch: 'bg-pink-500', dot: 'bg-pink-500', text: 'text-pink-600 dark:text-pink-400', chip: 'bg-pink-500/10 text-pink-700 dark:text-pink-300' },
  { id: 'indigo', swatch: 'bg-indigo-500', dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', chip: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
];

export function studentColorById(id) {
  return STUDENT_COLORS.find((c) => c.id === id) || STUDENT_COLORS[0];
}

/* ---------------- Settings (localStorage) ---------------- */

const SETTINGS_KEY = 'zlife.settings.v1';

const DEFAULT_SETTINGS = {
  theme: 'system', // 'light' | 'dark' | 'system'
  notifEnabled: true,
  defaultReminderMin: 15,
  currency: 'BDT',
  fitnessGoal: null, // number (kg)
  tuitionDefaultColor: 'blue',
};

let cache = null;

export function getSettings() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    cache = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache;
}

export function saveSettings(patch) {
  const s = getSettings();
  Object.assign(s, patch);
  cache = s;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage full/unavailable — non-fatal for settings
  }
  return s;
}

export function applyTheme(theme) {
  const root = document.documentElement;
  const resolved =
    theme === 'system'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
  root.classList.toggle('dark', resolved === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#fafafa');
  return resolved;
}

export function trackThemeSystem() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getSettings().theme === 'system') applyTheme('system');
  };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

export const CLEAR_CONFIRM_WORD = 'DELETE';

export function newId() {
  return uid();
}