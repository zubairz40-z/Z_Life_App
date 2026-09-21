/* Notification engine.
   Web Notifications can only be shown while the app is running (browsers do not
   allow scheduling notifications ahead of time from a page, and iOS restricts
   local notifications entirely). So ZLife checks for due reminders:
     - when the app loads
     - when the tab regains focus / becomes visible
     - every 30 seconds while open
   Each reminder fires once (tracked by a key). If native notifications are
   unavailable or denied, the reminder is still shown as an in-app toast. */

import { getSettings } from './storage.js';
import { dateTime, timeLabel } from './utils.js';

const SHOWN_KEY = 'zlife.shownNotifs.v1';

const listeners = new Set();

export function onReminderFire(cb) {
  listeners.add(cb);
}

function shownList() {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function markShown(key) {
  try {
    const arr = shownList().filter((k) => typeof k === 'string');
    arr.push(key);
    // keep the list bounded
    if (arr.length > 300) arr.splice(0, arr.length - 300);
    localStorage.setItem(SHOWN_KEY, JSON.stringify(arr));
  } catch {
    /* non-fatal */
  }
}

export function isShown(key) {
  return shownList().includes(key);
}

/* ---------- Permission helpers ---------- */

export function notifSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permissionState() {
  if (!notifSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function ensurePermission() {
  if (!notifSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'default';
  }
}

export async function testNotification() {
  const p = await ensurePermission();
  if (p !== 'granted') return { ok: false, reason: p };
  const fire = () => {
    if (notifSupported() && Notification.permission === 'granted') {
      const opts = {
        body: 'Notifications are working. You will get reminders here.',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'zlife-test',
        silent: false,
      };
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready
          .then((reg) => reg.showNotification('ZLife', opts))
          .catch(() => new Notification('ZLife', opts));
      } else {
        new Notification('ZLife', opts);
      }
    }
  };
  fire();
  return { ok: true, reason: 'granted' };
}

/* ---------- Due-reminder computation ---------- */

function triggerAt(item) {
  const d = dateTime(item.date, item.time);
  if (!d) return null;
  const min = Number(item.reminderMin);
  if (!min) return null;
  return d.getTime() - min * 60000;
}

/** Build the list of pending reminders across tasks/events/lessons. */
export function collectReminders({ tasks = [], events = [], lessons = [], students = [] }) {
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const out = [];
  const now = Date.now();

  for (const t of tasks) {
    if (t.completed) continue;
    const at = triggerAt(t);
    if (!at) continue;
    out.push({
      key: `task:${t.id}:${at}`,
      at,
      title: t.title || 'Task',
      body: taskBody(t),
      icon: './icons/icon-192.png',
    });
  }
  for (const e of events) {
    const at = triggerAt(e);
    if (!at) continue;
    out.push({
      key: `event:${e.id}:${at}`,
      at,
      title: e.title || 'Event',
      body: eventBody(e),
      icon: './icons/icon-192.png',
    });
  }
  for (const l of lessons) {
    if (l.completed) continue;
    const at = triggerAt(l);
    if (!at) continue;
    const st = studentMap.get(l.studentId);
    out.push({
      key: `lesson:${l.id}:${at}`,
      at,
      title: 'Tuition lesson',
      body: `${st ? st.name : 'Student'}${st && st.subject ? ' — ' + st.subject : ''}${l.time ? ' at ' + timeLabel(l.time) : ''}`,
      icon: './icons/icon-192.png',
    });
  }
  return out.filter((r) => r.at <= now);
}

function taskBody(t) {
  const parts = [];
  if (t.dueDate) parts.push(t.dueDate);
  if (t.time) parts.push(timeLabel(t.time));
  const when = parts.join(' · ') || 'Due soon';
  return `${t.note ? t.note + ' · ' : ''}Due ${when}`.slice(0, 140);
}

function eventBody(e) {
  const parts = [];
  if (e.date) parts.push(e.date);
  if (e.time) parts.push(timeLabel(e.time));
  const when = parts.join(' · ') || 'Happening soon';
  return `${e.notes ? e.notes + ' · ' : ''}${when}`.slice(0, 140);
}

/* ---------- Fire due reminders ---------- */

let checking = false;

export async function checkDue(reminders) {
  if (checking) return;
  checking = true;
  try {
    if (!reminders) reminders = collectReminders(await window.__zlifeData?.());
    const settings = getSettings();
    const canNative = notifSupported() && Notification.permission === 'granted' && settings.notifEnabled;
    const due = reminders.filter((r) => !isShown(r.key));
    for (const r of due) {
      markShown(r.key);
      if (canNative) {
        try {
          const sw = await navigator.serviceWorker?.ready;
          if (sw && sw.showNotification) {
            await sw.showNotification(r.title, {
              body: r.body,
              icon: r.icon,
              badge: r.icon,
              tag: r.key,
              renotify: false,
            });
          } else {
            new Notification(r.title, { body: r.body, icon: r.icon, badge: r.icon, tag: r.key });
          }
        } catch {
          try {
            new Notification(r.title, { body: r.body, icon: r.icon, tag: r.key });
          } catch {
            /* ignore */
          }
        }
      }
      // Always surface in-app so users get reminders even with notifications off.
      listeners.forEach((cb) => {
        try {
          cb(r);
        } catch {
          /* ignore */
        }
      });
    }
  } finally {
    checking = false;
  }
}

let interval = null;

export async function startScheduler(getData) {
  window.__zlifeData = getData;
  const run = () => checkDue();
  if (document.visibilityState === 'visible') setTimeout(run, 800);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
  window.addEventListener('focus', run);
  if (interval) clearInterval(interval);
  interval = setInterval(run, 30000);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener?.('message', (e) => {
      if (e.data && e.data.type === 'check-reminders') run();
    });
  }
}