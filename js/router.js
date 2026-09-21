/* Hash router: maps '#/section' to a view module and keeps navigation in sync. */

import * as todayView from './views/today.js';
import * as calendarView from './views/calendar.js';
import * as tuitionView from './views/tuition.js';
import * as moneyView from './views/money.js';
import * as fitnessView from './views/fitness.js';
import * as notesView from './views/notes.js';
import * as settingsView from './views/settings.js';

const ROUTES = {
  today: todayView,
  calendar: calendarView,
  tuition: tuitionView,
  money: moneyView,
  fitness: fitnessView,
  notes: notesView,
  settings: settingsView,
};

const NAV_ICONS = {
  today: 'home',
  calendar: 'calendar',
  tuition: 'bookOpen',
  money: 'wallet',
  fitness: 'dumbbell',
  notes: 'stickyNote',
  settings: 'settings',
};

const ACCENTS = {
  today: 'today',
  calendar: 'calendar',
  tuition: 'tuition',
  money: 'money',
  fitness: 'fitness',
  notes: 'notes',
  settings: 'settings',
};

let current = 'today';

export function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '').trim();
  return ROUTES[h] ? h : 'today';
}

export function getCurrent() {
  return current;
}

export function navigate(section) {
  if (ROUTES[section]) window.location.hash = '/' + section;
}

export function injectNavIcons() {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    const sec = btn.dataset.nav;
    const ic = btn.querySelector('.nav-ic');
    if (ic) {
      const size = btn.classList.contains('nav-item-side') ? 'h-5 w-5' : 'h-6 w-6';
      ic.innerHTML = window.__zlifeIcon(NAV_ICONS[sec] || 'circle', size);
    }
  });
}

export function setNavActive(section) {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    const on = btn.dataset.nav === section;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-current', on ? 'true' : 'false');
  });
}

export function renderCurrent() {
  current = parseHash();
  const view = document.getElementById('view');
  if (!view) return;

  // Per-section accent drives the whole theme (nav active state, buttons, tints).
  document.body.dataset.accent = ACCENTS[current] || 'today';

  const m = ROUTES[current];
  try {
    m.render(view);
  } catch (err) {
    console.error('Render failed for', current, err);
    view.innerHTML = `
      <div class="mx-auto max-w-md px-6 py-16 text-center">
        <p class="text-[15px] font-medium text-neutral-800 dark:text-neutral-100">Something went wrong showing this screen.</p>
        <p class="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">Please try again. Your data is safe.</p>
        <button type="button" class="btn btn-primary mt-5" data-retry>Try again</button>
      </div>`;
    view.querySelector('[data-retry]')?.addEventListener('click', () => render());
  }

  setNavActive(current);
  window.scrollTo(0, 0);
}

export function render() {
  current = parseHash();
  const m = ROUTES[current];
  if (m.resetView) m.resetView();
  renderCurrent();
}

export function bindGlobal() {
  window.addEventListener('hashchange', render);

  const view = document.getElementById('view');
  view.addEventListener('click', (e) => {
    const m = ROUTES[current];
    if (m.onViewClick) m.onViewClick(e);
  });
  view.addEventListener('change', (e) => {
    const m = ROUTES[current];
    if (m.onViewChange) m.onViewChange(e);
  });
  view.addEventListener('submit', (e) => e.preventDefault());

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });
}