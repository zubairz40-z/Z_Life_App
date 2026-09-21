/* Settings view — appearance, notifications, currency, data backup. */

import * as state from '../state.js';
import * as db from '../db.js';
import {
  getSettings, saveSettings, applyTheme, trackThemeSystem, CLEAR_CONFIRM_WORD,
  REMINDER_OPTIONS,
} from '../storage.js';
import { esc, todayStr, CURRENCIES, fullDate, bdTimeStr, getClockDrift, syncClock } from '../utils.js';
import { icon } from '../icons.js';
import { openModal, toast, confirmDialog, setError, clearErrors, refresh } from '../ui.js';
import { viewHeader, segmented, selectField } from '../components.js';
import { notifSupported, permissionState, ensurePermission, testNotification, onReminderFire } from '../notifications.js';

export function render(container) {
  const s = getSettings();
  const perm = permissionState();

  const notifStatus =
    !notifSupported()
      ? 'Notifications are not supported in this browser.'
      : perm === 'granted'
      ? 'Notifications are allowed.'
      : perm === 'denied'
      ? 'Notifications are blocked by the browser. Enable them in site settings, or rely on in-app reminders.'
      : 'Permission has not been granted yet.';

  const notifHint = notifSupported()
    ? 'Reminders are checked while ZLife is open or in the background of your device. iOS limits what apps can do while fully closed.'
    : 'In-app reminders will still appear as toasts.';

  container.innerHTML = `
    <div class="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 lg:px-8 lg:pb-20 lg:pt-10">
      ${viewHeader({ title: 'Settings', subtitle: 'Appearance, notifications and data', iconName: 'settings' })}

      <div class="space-y-6">
        <!-- Date & time -->
        <section class="card px-5 py-4">
          <h2 class="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">${icon('clock', 'h-4 w-4')}Date &amp; time</h2>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
              <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Bangladesh date</span>
              <span class="text-[13.5px] font-semibold text-neutral-800 dark:text-neutral-100">${fullDate(todayStr())}</span>
            </div>
            <div class="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
              <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Right now</span>
              <span class="font-mono text-[13.5px] font-semibold tabular-nums text-neutral-800 dark:text-neutral-100" data-live-clock>${bdTimeStr()}</span>
            </div>
            <div class="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
              <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Clock status</span>
              <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${Math.abs(getClockDrift()) > 5 * 60 * 1000 ? 'Device clock is off — using synced time' : 'Device clock looks correct'}</span>
            </div>
          </div>
          <p class="mt-2.5 text-[12.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">ZLife shows the true Bangladesh date even if your phone or PC clock is wrong — it syncs the time automatically when online (and uses the last known good sync offline).</p>
          <button type="button" class="btn btn-secondary mt-3 px-3 py-1.5 text-[13px]" data-action="resync-time">${icon('repeat', 'h-3.5 w-3.5')}Sync time now</button>
        </section>

        <!-- Appearance -->
        <section class="card px-5 py-4">
          <h2 class="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">${icon('sun', 'h-4 w-4')}Appearance</h2>
          <div id="theme-seg">${segmented(
            [
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
              { id: 'system', label: 'System' },
            ],
            s.theme,
            'Theme'
          )}</div>
        </section>

        <!-- Notifications -->
        <section class="card px-5 py-4">
          <h2 class="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">${icon('bell', 'h-4 w-4')}Notifications</h2>
          <label class="flex items-center justify-between gap-3" for="notif-enabled">
            <span class="text-[15px] font-medium text-neutral-800 dark:text-neutral-100">Enable notifications</span>
            <button type="button" role="switch" aria-checked="${!!s.notifEnabled}" data-action="toggle-notif" class="relative h-7 w-12 rounded-full transition ${s.notifEnabled ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700'}">
              <span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-200 ${s.notifEnabled ? 'left-[22px]' : 'left-0.5'}"></span>
            </button>
          </label>
          <p class="mt-2 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">${esc(notifStatus)}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            ${notifSupported() && perm !== 'granted' ? `<button type="button" class="btn btn-secondary px-3 py-1.5 text-[13px]" data-action="request-notif">${icon('bell', 'h-3.5 w-3.5')}Allow notifications</button>` : ''}
            ${notifSupported() && perm === 'granted' ? `<button type="button" class="btn btn-secondary px-3 py-1.5 text-[13px]" data-action="test-notif">${icon('bellRing', 'h-3.5 w-3.5')}Send test</button>` : ''}
          </div>
          <div class="mt-5">
            ${selectField({
              id: 'default-reminder',
              label: 'Default reminder',
              value: s.defaultReminderMin || '',
              options: [['', 'No reminder'], ...REMINDER_OPTIONS.map((r) => [String(r.min), r.label])],
            })}
          </div>
          <p class="mt-2 text-[12.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">${esc(notifHint)}</p>
        </section>

        <!-- Currency -->
        <section class="card px-5 py-4">
          <h2 class="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">${icon('banknote', 'h-4 w-4')}Currency</h2>
          ${selectField({
            id: 'currency',
            label: 'Display currency',
            value: s.currency,
            options: CURRENCIES.map((c) => [c.code, c.label]),
          })}
        </section>

        <!-- Data -->
        <section class="card px-5 py-4">
          <h2 class="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">${icon('database', 'h-4 w-4')}Data</h2>
          <div class="grid grid-cols-2 gap-2.5">
            <button type="button" class="btn btn-secondary" data-action="export-data">${icon('download', 'h-4 w-4')}Export</button>
            <button type="button" class="btn btn-secondary" data-action="import-data">${icon('upload', 'h-4 w-4')}Import</button>
            <button type="button" class="btn btn-danger-ghost col-span-2 border border-red-200 dark:border-red-900/50" data-action="clear-data">${icon('trash', 'h-4 w-4')}Clear all data</button>
          </div>
          <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
          <p class="mt-3 text-[12.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">Your data lives only on this device. Export a backup file regularly — you can import it later on any device.</p>
        </section>

        <!-- About -->
        <section class="px-1 pt-2 pb-4 text-center">
          <div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">${icon('zap', 'h-5 w-5')}</div>
          <p class="text-[14px] font-semibold text-neutral-800 dark:text-neutral-100">ZLife</p>
          <p class="text-[12.5px] text-neutral-400 dark:text-neutral-500">Your life, organized. · Version 1.0.0</p>
        </section>
      </div>
    </div>`;

  // wire segmented theme
  const seg = container.querySelector('#theme-seg');
  seg.querySelectorAll('[data-seg]').forEach((b) =>
    b.addEventListener('click', () => {
      const theme = b.dataset.seg;
      saveSettings({ theme });
      applyTheme(theme);
      seg.querySelectorAll('[data-seg]').forEach((x) => {
        const on = x === b;
        x.classList.toggle('seg-active', on);
        x.setAttribute('aria-checked', on);
      });
    })
  );

  container.querySelector('#default-reminder').addEventListener('change', (e) => {
    saveSettings({ defaultReminderMin: e.target.value ? Number(e.target.value) : null });
    toast('Default reminder saved', { type: 'success' });
  });

  container.querySelector('#currency').addEventListener('change', (e) => {
    saveSettings({ currency: e.target.value });
    toast('Currency updated', { type: 'success' });
  });

  container.querySelector('#import-file').addEventListener('change', onFilePicked);
}

/* ---------------- Actions ---------------- */

export function onViewClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action } = target.dataset;

  if (action === 'toggle-notif') {
    const s = getSettings();
    const next = !s.notifEnabled;
    if (next && notifSupported() && Notification.permission !== 'denied') {
      ensurePermission().then(() => {
        saveSettings({ notifEnabled: true });
        render(document.getElementById('view'));
        toast('Notifications enabled', { type: 'success' });
        if (permissionState() === 'denied') afterRender();
      });
      return;
    }
    saveSettings({ notifEnabled: next });
    render(document.getElementById('view'));
    toast(next ? 'Notifications enabled' : 'Notifications turned off', { type: 'success' });
  } else if (action === 'request-notif') {
    ensurePermission().then(() => {
      render(document.getElementById('view'));
      if (permissionState() === 'granted') {
        testNotification();
        toast('Notifications enabled', { type: 'success' });
      }
    });
  } else if (action === 'test-notif') {
    testNotification().then((r) => {
      if (r.ok) toast('Test notification sent', { type: 'success' });
      else if (r.reason === 'denied') toast('Notifications are blocked by the browser.', { type: 'error' });
      else toast('Please allow notifications first.', { type: 'error' });
    });
  } else if (action === 'export-data') {
    exportData();
  } else if (action === 'resync-time') {
    toast('Syncing time…', { type: 'info' });
    syncClock(true).then((drift) => {
      render(document.getElementById('view'));
      toast(Math.abs(drift) > 5 * 60 * 1000 ? 'Time synced — your device clock is off, calendars corrected.' : 'Time synced — device clock looks correct.', { type: 'success' });
    });
  } else if (action === 'import-data') {
    document.getElementById('import-file').click();
  } else if (action === 'clear-data') {
    clearAllData();
  }
}

function afterRender() {
  render(document.getElementById('view'));
}

/* ---------------- Notifications wiring ---------------- */

export function wireReminderToasts() {
  // Show reminders as in-app toasts even when native notifications are off.
  onReminderFire((r) => {
    toast(`${r.title} — ${r.body}`, { type: 'info', duration: 6000 });
  });
}

/* ---------------- Export / Import / Clear ---------------- */

async function exportData() {
  try {
    const data = await state.dbExport();
    const payload = {
      app: 'ZLife',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZLife-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup exported', { type: 'success' });
  } catch (err) {
    toast('Could not export data. Please try again.', { type: 'error' });
    console.error(err);
  }
}

function onFilePicked(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const error = validateImport(parsed);
      if (error) {
        openImportError(error);
        return;
      }
      offerImport(parsed);
    } catch {
      openImportError('This file is not a valid ZLife backup.');
    }
  };
  reader.onerror = () => openImportError('Could not read the file. Please try again.');
  reader.readAsText(file);
}

function validateImport(parsed) {
  if (!parsed || typeof parsed !== 'object') return 'This file is not a valid ZLife backup.';
  if (parsed.app !== 'ZLife') return 'This file is not a ZLife backup.';
  if (!parsed.data || typeof parsed.data !== 'object') return 'This backup has no data in it.';
  const stores = ['tasks', 'events', 'students', 'lessons', 'transactions', 'weights'];
  for (const k of stores) {
    if (parsed.data[k] !== undefined && !Array.isArray(parsed.data[k])) {
      return 'This backup file is corrupted.';
    }
  }
  return null;
}

function sanitizeData(data) {
  const out = {};
  const fields = {
    tasks: ['id', 'title', 'note', 'priority', 'dueDate', 'time', 'reminderMin', 'completed', 'completedAt', 'createdAt', 'updatedAt'],
    events: ['id', 'title', 'date', 'time', 'priority', 'reminderMin', 'notes', 'createdAt', 'updatedAt'],
    students: ['id', 'name', 'subject', 'color', 'usualTime', 'notes', 'active', 'createdAt', 'updatedAt'],
    lessons: ['id', 'studentId', 'date', 'time', 'reminderMin', 'note', 'completed', 'completedAt', 'createdAt', 'updatedAt'],
    transactions: ['id', 'amount', 'type', 'where', 'category', 'method', 'date', 'note', 'saved', 'createdAt', 'updatedAt'],
    weights: ['id', 'date', 'weight', 'createdAt', 'updatedAt'],
    notes: ['id', 'title', 'body', 'pinned', 'createdAt', 'updatedAt'],
  };
  for (const key of Object.keys(fields)) {
    const arr = Array.isArray(data[key]) ? data[key] : [];
    out[key] = arr
      .filter((r) => r && typeof r === 'object' && typeof r.id === 'string' && r.id)
      .map((r) => {
        const clean = {};
        for (const f of fields[key]) if (f in r) clean[f] = r[f];
        return clean;
      });
  }
  return out;
}

function openImportError(message) {
  openModal({
    title: 'Import failed',
    body: `<div class="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700 dark:bg-red-500/10 dark:text-red-400">
        ${icon('alertTriangle', 'h-5 w-5 shrink-0')}<span>${esc(message)}</span>
      </div>`,
    maxWidth: 'sm:max-w-sm',
    footer: `<button type="button" class="btn btn-primary w-full" data-close>OK</button>`,
  });
}

function offerImport(parsed) {
  const clean = sanitizeData(parsed.data);
  const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : null;
  const counts = Object.entries(clean).map(([k, v]) => `${v.length} ${k}`).join(', ');

  const body = `
    <p class="text-[14.5px] leading-relaxed text-neutral-600 dark:text-neutral-300">
      This backup contains: <span class="font-medium text-neutral-800 dark:text-neutral-100">${counts}</span>.
    </p>
    <div class="mt-4 space-y-2">
      <button type="button" class="btn btn-primary w-full" data-merge>${icon('copy', 'h-4 w-4')}Merge with current data</button>
      <button type="button" class="btn btn-danger w-full" data-replace>${icon('download', 'h-4 w-4')}Replace everything</button>
    </div>
    <p class="mt-3 text-[12.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">Merge keeps your existing records and adds anything new from the backup. Replace deletes all current data first.</p>`;

  const m = openModal({
    title: 'Import backup',
    body,
    maxWidth: 'sm:max-w-sm',
    footer: `<button type="button" class="btn btn-secondary w-full" data-close>Cancel</button>`,
  });

  m.el.querySelector('[data-merge]').addEventListener('click', async () => {
    try {
      await state.dbImportMerge(clean);
      await state.loadAll();
      m.close();
      toast('Backup merged into your data', { type: 'success' });
    } catch {
      toast('Import failed. Please try again.', { type: 'error' });
    }
  });

  m.el.querySelector('[data-replace]').addEventListener('click', async () => {
    // confirm destructive operation explicitly
    const ok = await confirmDialog({
      title: 'Replace all data?',
      message: `This will permanently delete all current tasks, events, students, lessons, transactions, weights, notes and settings, then load the backup. This cannot be undone.`,
      confirmLabel: 'Replace all',
      danger: true,
      word: CLEAR_CONFIRM_WORD,
    });
    if (!ok) return;
    try {
      await state.dbImportAll(clean);
      if (settings) saveSettings(settings);
      await state.loadAll();
      applyTheme(getSettings().theme);
      m.close();
      toast('Backup restored', { type: 'success' });
    } catch (err) {
      console.error(err);
      toast('Import failed. Your data was not changed.', { type: 'error' });
    }
  });
}

async function clearAllData() {
  const ok = await confirmDialog({
    title: 'Clear all data?',
    message: `This will permanently delete every task, event, student, lesson, transaction, weight entry and note on this device. This cannot be undone.`,
    confirmLabel: 'Clear all',
    danger: true,
    word: CLEAR_CONFIRM_WORD,
  });
  if (!ok) return;
  try {
    await state.dbClearAll();
    await state.loadAll();
    toast('All data cleared', { type: 'success' });
  } catch {
    toast('Could not clear data. Please try again.', { type: 'error' });
  }
}