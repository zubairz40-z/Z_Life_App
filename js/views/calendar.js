/* Calendar view — monthly calendar of important date-based events. */

import * as state from '../state.js';
import { getSettings } from '../storage.js';
import {
  esc, todayStr, currentMonthKey, fullDate, humanDate, timeLabel, dateTime, isValidDateStr, isValidTimeStr,
} from '../utils.js';
import { icon } from '../icons.js';
import { openModal, toast, confirmDialog, setError, clearErrors, refresh } from '../ui.js';
import { viewHeader, emptyState, reminderSelect, priorityControl } from '../components.js';
import { priorityById, reminderLabel } from '../storage.js';
import { calendarGridHtml, calMonthKey } from './calendarGrid.js';

let ym = currentMonthKey();
let sel = todayStr();

export function resetView() {
  ym = currentMonthKey();
  sel = todayStr();
}

function dotsFor(dateStr) {
  const evs = state.getData().events.filter((e) => e.date === dateStr);
  return evs.map((e) => ({
    cls: priorityById(e.priority).dot,
    title: e.title,
  }));
}

export function render(container) {
  const data = state.getData();
  const events = data.events
    .filter((e) => (sel ? e.date === sel : true))
    .sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));

  const selLabel = sel ? fullDate(sel) : 'Pick a date';
  const countLabel = events.length ? `${events.length} ${events.length === 1 ? 'event' : 'events'}` : '';

  const dayPanel = sel
    ? `
      <div class="card mb-6 overflow-hidden">
        <div class="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <h2 class="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">${selLabel}</h2>
          <div class="flex items-center gap-2">
            ${countLabel ? `<span class="chip bg-accent-soft text-accent">${countLabel}</span>` : ''}
            <button type="button" class="btn btn-primary px-3 py-1.5 text-[13px]" data-action="add-event">${icon('plus', 'h-4 w-4')}Add</button>
          </div>
        </div>
        <div class="divide-y divide-neutral-100 dark:divide-neutral-800 ${events.length ? '' : 'py-2'}">
          ${events.length
            ? events.map(eventRow).join('')
            : emptyState({
                iconName: 'calendar',
                title: 'No events',
                subtitle: 'Nothing planned for this date. Add an event like a deadline, exam or birthday.',
              })}
        </div>
      </div>`
    : `
      <div class="mb-6">
        ${emptyState({
          iconName: 'calendar',
          title: 'Select a date',
          subtitle: 'Tap any date on the calendar to view or add events for that day.',
        })}
      </div>`;

  const headerActions = `
    <button type="button" class="btn btn-secondary px-3 py-2 text-sm" data-action="cal-today">${icon('calendarDays', 'h-4 w-4')}Today</button>`;

  container.innerHTML = `
    <div class="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 lg:px-8 lg:pb-20 lg:pt-10">
      ${viewHeader({ title: 'Calendar', subtitle: 'Deadlines, exams and important dates', iconName: 'calendar', action: headerActions })}
      ${calendarGridHtml({ ym, sel, dotsFor })}
      <div class="h-6"></div>
      ${dayPanel}
    </div>`;
}

function eventRow(e) {
  const p = priorityById(e.priority);
  const chips = [];
  if (e.time) chips.push(`<span class="chip bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">${icon('clock', 'h-3 w-3')}${esc(timeLabel(e.time))}</span>`);
  if (e.reminderMin) chips.push(`<span class="chip bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">${icon('bell', 'h-3 w-3')}${esc(reminderLabel(e.reminderMin))}</span>`);
  chips.push(`<span class="chip bg-neutral-50 text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400"><span class="h-1.5 w-1.5 rounded-full ${p.dot}"></span>${p.label}</span>`);
  return `
    <button type="button" data-action="open-event" data-id="${esc(e.id)}"
      class="row-hover flex w-full items-start gap-3 px-4 py-3.5 text-left">
      <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full ${p.dot}"></span>
      <span class="min-w-0 flex-1">
        <span class="block text-[15px] font-medium text-neutral-900 dark:text-neutral-100">${esc(e.title)}</span>
        <span class="mt-1 flex flex-wrap items-center gap-1.5">${chips.join('')}</span>
      </span>
      <span class="icon-btn -mr-2 -mt-1.5">${icon('chevronRight', 'h-4 w-4')}</span>
    </button>`;
}

/* ---------------- Event form ---------------- */

function openEventForm(ev = null, defaultDate = sel) {
  const isNew = !ev;
  const body = `
    <div class="space-y-4">
      <div class="field-wrap">
        <label class="field-label" for="ev-title">Title</label>
        <input id="ev-title" type="text" maxlength="120" class="field" placeholder="e.g. CSE assignment deadline" data-autofocus value="${esc(ev?.title || '')}" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="field-wrap">
          <label class="field-label" for="ev-date">Date</label>
          <input id="ev-date" type="date" class="field" value="${esc(ev?.date || defaultDate || todayStr())}" />
        </div>
        <div class="field-wrap">
          <label class="field-label" for="ev-time">Time <span class="font-normal text-neutral-400">(optional)</span></label>
          <input id="ev-time" type="time" class="field" value="${esc(ev?.time || '')}" />
        </div>
      </div>
      <div>${priorityControl(ev?.priority || 'medium')}</div>
      <div class="field-wrap">
        <label class="field-label" for="ev-reminder">Reminder</label>
        ${reminderSelect(ev?.reminderMin || getSettings().defaultReminderMin, 'ev-reminder')}
      </div>
      <div class="field-wrap">
        <label class="field-label" for="ev-notes">Notes <span class="font-normal text-neutral-400">(optional)</span></label>
        <textarea id="ev-notes" rows="3" maxlength="500" class="field resize-none" placeholder="Details, address, link…">${esc(ev?.notes || '')}</textarea>
      </div>
    </div>`;

  const m = openModal({
    title: isNew ? 'New event' : 'Edit event',
    body,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary flex-1" data-save>${isNew ? 'Add event' : 'Save changes'}</button>
      </div>`,
  });

  const reminderSel = m.el.querySelector('#ev-reminder');
  const customWrap = m.el.querySelector('#custom-reminder-wrap');
  reminderSel.addEventListener('change', () => {
    customWrap.classList.toggle('hidden', reminderSel.value !== 'custom');
  });

  m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-save]').addEventListener('click', save);

  function getReminderMin() {
    if (reminderSel.value === '') return null;
    if (reminderSel.value === 'custom') {
      const v = Number(m.el.querySelector('#customReminderMin').value);
      return v > 0 ? v : null;
    }
    return Number(reminderSel.value);
  }

  function save() {
    clearErrors(m.el);
    const title = m.el.querySelector('#ev-title').value.trim();
    const date = m.el.querySelector('#ev-date').value;
    const time = m.el.querySelector('#ev-time').value || null;
    const priority = m.el.querySelector('[data-priority][aria-checked="true"]')?.dataset.priority || 'medium';
    const notes = m.el.querySelector('#ev-notes').value.trim();
    const reminderMin = getReminderMin();
    let ok = true;
    if (!title) {
      setError(m.el.querySelector('#ev-title'), 'Please enter a title.');
      ok = false;
    }
    if (!isValidDateStr(date)) {
      setError(m.el.querySelector('#ev-date'), 'Please pick a valid date.');
      ok = false;
    }
    if (time && !isValidTimeStr(time)) {
      setError(m.el.querySelector('#ev-time'), 'Please enter a valid time.');
      ok = false;
    }
    if (!ok) return;

    state.saveEvent({
      id: ev?.id,
      title,
      date,
      time,
      priority,
      notes,
      reminderMin,
    }).then(() => {
      m.close();
      if (!ev && date) sel = date;
      const inMonth = ym.split('-')[0] === date.slice(0, 4) && ym.split('-')[1] === date.slice(5, 7);
      if (!inMonth) ym = `${date.slice(0, 4)}-${date.slice(5, 7)}`;
      toast(isNew ? 'Event added' : 'Event updated', { type: 'success' });
    });
  }
}

/* ---------------- Event detail ---------------- */

function openEventDetail(id) {
  const e = state.getData().events.find((x) => x.id === id);
  if (!e) return;
  const p = priorityById(e.priority);
  const rows = [];
  rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Date</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${esc(humanDate(e.date))}${e.time ? ' · ' + esc(timeLabel(e.time)) : ''}</span>
    </div>`);
  rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Priority</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100"><span class="mr-1.5 inline-block h-2 w-2 rounded-full ${p.dot}"></span>${p.label}</span>
    </div>`);
  if (e.reminderMin) {
    rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Reminder</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${esc(reminderLabel(e.reminderMin))}</span>
    </div>`);
  }

  const m = openModal({
    title: e.title,
    body: `
      ${e.notes ? `<p class="mb-4 text-[14.5px] leading-relaxed text-neutral-600 dark:text-neutral-300">${esc(e.notes)}</p>` : ''}
      <div class="space-y-2">${rows.join('')}</div>`,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-edit>${icon('pencil', 'h-4 w-4')}Edit</button>
        <button type="button" class="btn btn-danger-ghost flex-1" data-delete>${icon('trash', 'h-4 w-4')}Delete</button>
      </div>`,
  });

  m.el.querySelector('[data-edit]').addEventListener('click', () => {
    m.close();
    openEventForm(e, e.date);
  });
  m.el.querySelector('[data-delete]').addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: 'Delete event',
      message: `Delete “${e.title}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (yes) {
      await state.deleteEvent(e.id);
      m.close();
      toast('Event deleted', { type: 'success' });
    }
  });
}

/* ---------------- Delegated clicks ---------------- */

export function onViewClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action, id, date } = target.dataset;
  if (action === 'cal-prev') { ym = calMonthKey(ym, -1); refresh(); }
  else if (action === 'cal-next') { ym = calMonthKey(ym, 1); refresh(); }
  else if (action === 'cal-today') { ym = currentMonthKey(); sel = todayStr(); refresh(); }
  else if (action === 'cal-pick') { sel = date; refresh(); }
  else if (action === 'add-event') openEventForm();
  else if (action === 'open-event') openEventDetail(id);
}