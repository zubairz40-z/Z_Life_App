/* ZLife bootstrap. */

import * as state from './state.js';
import { getSettings, applyTheme, trackThemeSystem } from './storage.js';
import { icon } from './icons.js';
import { todayStr, bdTimeStr, syncClock } from './utils.js';
import { startScheduler } from './notifications.js';
import { render, renderCurrent, bindGlobal, injectNavIcons } from './router.js';
import { setRefresh } from './ui.js';
import { wireReminderToasts } from './views/settings.js';

// Expose the icon helper for the router's nav injection.
window.__zlifeIcon = (name, cls) => icon(name, cls);
// Expose "today in Bangladesh Standard Time" so tests assert the right day.
window.__zlifeToday = () => todayStr();
// Expose the build version so you/we can instantly tell whether a device is
// running the latest release (matches the service-worker cache name).
window.__zlifeVersion = 'zlife-v6';

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('Service worker registration failed:', err));
  });
}

// Global handler for segmented pickers (priority / color) used inside modals.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-priority], [data-color]');
  if (!b) return;
  const group = b.hasAttribute('data-priority') ? '[data-priority]' : '[data-color]';
  const radios = b.closest('[role="radiogroup"]');
  if (!radios) return;
  radios.querySelectorAll(group).forEach((x) => {
    x.setAttribute('aria-checked', x === b ? 'true' : 'false');
  });
});

async function init() {
  applyTheme(getSettings().theme);
  trackThemeSystem();
  injectNavIcons();
  bindGlobal();

  try {
    await state.loadAll();
  } catch (err) {
    // Database unavailable — show a friendly screen instead of a blank app.
    document.getElementById('view').innerHTML = `
      <div class="mx-auto max-w-md px-6 py-16 text-center">
        <p class="text-[15px] font-medium text-neutral-800 dark:text-neutral-100">We couldn't open the local database.</p>
        <p class="mt-1 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          ZLife stores everything in your browser's local storage, which appears to be unavailable (private mode or restricted settings).
        </p>
      </div>`;
    console.error(err);
    return;
  }

  render();
  state.onChange(renderCurrent);
  setRefresh(renderCurrent);
  wireReminderToasts();
  startScheduler(() => state.getData());
  registerSW();

  // Roll today over automatically when the BD date changes (e.g. app left open at midnight).
  let lastDay = todayStr();
  setInterval(() => {
    const day = todayStr();
    if (day !== lastDay) {
      lastDay = day;
      renderCurrent();
    }
  }, 60000);

  // Live Bangladesh clock — updates every [data-live-clock] element (Today view) once per second.
  setInterval(() => {
    const t = bdTimeStr();
    document.querySelectorAll('[data-live-clock]').forEach((el) => {
      el.textContent = t;
    });
  }, 1000);

  // Correct the real time once we've measured the device-clock drift, so a
  // phone/PC with a wrong date can't pin the calendars to the wrong month.
  syncClock().then(() => {
    const liveDay = todayStr();
    if (liveDay !== lastDay) {
      lastDay = liveDay;
      renderCurrent(); // snap Today/calendars to the true BD day & month
    }
  });
}

init();