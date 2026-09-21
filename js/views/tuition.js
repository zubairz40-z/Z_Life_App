/* Tuition view — monthly calendar where lessons are marked complete per student. */

import * as state from '../state.js';
import { getSettings, saveSettings, STUDENT_COLORS, studentColorById } from '../storage.js';
import {
  esc, todayStr, currentMonthKey, fullDate, timeLabel, isValidTimeStr, isValidDateStr, isHoliday, holidayName,
} from '../utils.js';
import { icon } from '../icons.js';
import { openModal, toast, confirmDialog, setError, clearErrors, refresh } from '../ui.js';
import { viewHeader, emptyState, reminderSelect, colorControl, selectField } from '../components.js';
import { reminderLabel } from '../storage.js';
import { calendarGridHtml, calMonthKey } from './calendarGrid.js';

let ym = currentMonthKey();
let sel = todayStr();

export function resetView() {
  ym = currentMonthKey();
  sel = todayStr();
}

function dotsFor(dateStr) {
  return state
    .getData()
    .lessons.filter((l) => l.date === dateStr)
    .map((l) => {
      const st = state.getData().students.find((s) => s.id === l.studentId);
      const c = studentColorById(st?.color);
      return {
        cls: l.completed ? c.dot : `${c.dot} opacity-50`,
        title: `${st?.name || 'Student'}${l.completed ? ' — done' : ''}`,
      };
    });
}

export function render(container) {
  const data = state.getData();
  const students = data.students;
  const lessons = data.lessons
    .filter((l) => (sel ? l.date === sel : true))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  const y = Number(ym.split('-')[0]);
  const m = Number(ym.split('-')[1]) - 1;
  const monthLessons = data.lessons.filter((l) => l.date.startsWith(ym));
  const monthDone = monthLessons.filter((l) => l.completed).length;

  const legend = students.length
    ? `<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        ${students
          .map((s) => {
            const c = studentColorById(s.color);
            return `
          <button type="button" data-action="edit-student" data-id="${esc(s.id)}" class="flex items-center gap-1.5 text-[12.5px] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100">
            <span class="h-2.5 w-2.5 rounded-full ${c.dot}"></span>${esc(s.name)}
          </button>`;
          })
          .join('')}
      </div>`
    : '';

  const dayPanel = sel
    ? ` 
      <div class="card mb-6">
        <div class="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h2 class="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">${fullDate(sel)}</h2>
            ${isHoliday(sel) ? `<span class="chip bg-accent-soft text-accent">${icon('sun', 'h-3 w-3')}${holidayName(sel)} holiday</span>` : ''}
          </div>
          <button type="button" class="btn btn-primary px-3 py-1.5 text-[13px]" data-action="add-lesson">${icon('plus', 'h-4 w-4')}Lesson</button>
        </div>
        ${students.length
          ? `<div class="divide-y divide-neutral-100 dark:divide-neutral-800 ${lessons.length ? '' : 'py-2'}">
              ${lessons.length
                ? lessons.map(lessonRow).join('')
                : emptyState({ iconName: 'graduationCap', title: 'No lessons', subtitle: 'Mark a lesson for this date with any student.' })}
            </div>`
          : emptyState({
              iconName: 'users',
              title: 'Add a student first',
              subtitle: 'Create a student, then mark lessons as complete on the calendar.',
              action: `<button type="button" class="btn btn-primary" data-action="add-student">${icon('plus', 'h-4 w-4')}Add student</button>`,
            })}
      </div>`
    : '';

  container.innerHTML = `
    <div class="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 lg:px-8 lg:pb-20 lg:pt-10">
      ${viewHeader({
        title: 'Tuition',
        subtitle: 'Your personal tuition calendar',
        iconName: 'bookOpen',
        action: `
        <div class="flex gap-2">
          <button type="button" class="btn btn-secondary px-3 py-2 text-sm" data-action="cal-today">${icon('calendarDays', 'h-4 w-4')}Today</button>
          <button type="button" class="btn btn-secondary px-3.5 py-2 text-sm" data-action="manage-students">${icon('users', 'h-4 w-4')}Students</button>
        </div>`,
      })}
      ${calendarGridHtml({ ym, sel, dotsFor })}
      ${legend}
      <div class="mt-3 px-1 text-[12.5px] text-neutral-400 dark:text-neutral-500">
        ${monthLessons.length ? `${monthDone} of ${monthLessons.length} lessons completed this month` : 'No lessons this month yet'}
      </div>
      <div class="h-6"></div>
      ${dayPanel}
    </div>`;
}

function lessonRow(l) {
  const st = state.getData().students.find((s) => s.id === l.studentId);
  const c = studentColorById(st?.color);
  const chips = [];
  if (l.time) chips.push(`<span class="chip bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">${icon('clock', 'h-3 w-3')}${esc(timeLabel(l.time))}</span>`);
  if (st?.subject) chips.push(`<span class="chip ${c.chip}">${esc(st.subject)}</span>`);
  if (l.reminderMin) chips.push(`<span class="chip bg-accent-soft text-accent">${icon('bell', 'h-3 w-3')}${esc(reminderLabel(l.reminderMin))}</span>`);

  return `
    <button type="button" data-action="open-lesson" data-id="${esc(l.id)}"
      class="row-hover flex w-full items-start gap-3 px-4 py-3.5 text-left">
      <span data-action="toggle-lesson" data-id="${esc(l.id)}" role="checkbox" aria-checked="${!!l.completed}" aria-label="${l.completed ? 'Mark lesson as upcoming' : 'Mark lesson as done'}"
        class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition
        ${l.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-300 text-transparent hover:border-emerald-500 dark:border-neutral-600'}">
        ${icon('check', 'h-3.5 w-3.5')}
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex flex-wrap items-baseline gap-x-2">
          <span class="text-[15px] font-medium text-neutral-900 dark:text-neutral-100 ${l.completed ? 'text-neutral-400 line-through decoration-neutral-300 dark:text-neutral-500' : ''}">${esc(st?.name || 'Student')}</span>
          ${l.completed ? `<span class="chip-sm bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">Done</span>` : '<span class="chip-sm bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">Upcoming</span>'}
        </span>
        <span class="mt-1 flex flex-wrap items-center gap-1.5">${chips.join('')}</span>
      </span>
      <span class="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}"></span>
    </button>`;
}

/* ---------------- Students manager ---------------- */

function openStudentsManager() {
  const data = state.getData();
  const students = [...data.students].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  const m = openModal({
    title: 'Students',
    body: `
      ${students.length
        ? `<div class="divide-y divide-neutral-100 dark:divide-neutral-800">
            ${students
              .map((s) => {
                const c = studentColorById(s.color);
                return `
              <button type="button" data-action="edit-student" data-id="${esc(s.id)}" class="row-hover flex w-full items-center gap-3 py-3 text-left">
                <span class="h-3 w-3 shrink-0 rounded-full ${c.dot}"></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[15px] font-medium text-neutral-900 dark:text-neutral-100">${esc(s.name)}</span>
                  <span class="block truncate text-[12.5px] text-neutral-500 dark:text-neutral-400">${esc(s.subject || 'No subject')}${!s.active ? ' · Inactive' : ''}</span>
                </span>
                <span class="icon-btn -mr-2">${icon('chevronRight', 'h-4 w-4')}</span>
              </button>`;
              })
              .join('')}
          </div>`
        : emptyState({ iconName: 'users', title: 'No students yet', subtitle: 'Add your first student to start logging tuition lessons.' })}
      <div class="pt-4">
        <button type="button" class="btn btn-primary w-full" data-action="add-student">${icon('plus', 'h-4 w-4')}Add student</button>
      </div>`,
    maxWidth: 'sm:max-w-lg',
  });

  m.el.querySelector('[data-action="add-student"]')?.addEventListener('click', () => {
    m.close();
    openStudentForm();
  });
  m.el.querySelectorAll('[data-action="edit-student"]').forEach((b) => {
    b.addEventListener('click', () => {
      m.close();
      openStudentForm(state.getData().students.find((s) => s.id === b.dataset.id));
    });
  });
}

/* ---------------- Student form ---------------- */

function openStudentForm(st = null) {
  const isNew = !st;
  const lessonCount = st ? state.getData().lessons.filter((l) => l.studentId === st.id).length : 0;
  const body = `
    <div class="space-y-4">
      <div class="field-wrap">
        <label class="field-label" for="st-name">Name</label>
        <input id="st-name" type="text" maxlength="60" class="field" placeholder="e.g. Ariya" data-autofocus value="${esc(st?.name || '')}" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="field-wrap">
          <label class="field-label" for="st-subject">Subject <span class="font-normal text-neutral-400">(optional)</span></label>
          <input id="st-subject" type="text" maxlength="60" class="field" placeholder="e.g. English" value="${esc(st?.subject || '')}" />
        </div>
        <div class="field-wrap">
          <label class="field-label" for="st-time">Usual time <span class="font-normal text-neutral-400">(optional)</span></label>
          <input id="st-time" type="time" class="field" value="${esc(st?.usualTime || '')}" />
        </div>
      </div>
      ${colorControl(st?.color || getSettings().tuitionDefaultColor, STUDENT_COLORS)}
      <div class="field-wrap">
        <label class="field-label" for="st-notes">Notes <span class="font-normal text-neutral-400">(optional)</span></label>
        <textarea id="st-notes" rows="2" maxlength="300" class="field resize-none" placeholder="Anything useful about this student…">${esc(st?.notes || '')}</textarea>
      </div>
      <label class="flex items-center justify-between rounded-xl border border-neutral-200 px-3.5 py-3 dark:border-neutral-800">
        <span class="text-[14.5px] font-medium text-neutral-700 dark:text-neutral-200">Active student</span>
        <input type="checkbox" id="st-active" class="h-5 w-5 rounded accent-indigo-600" ${st ? (st.active ? 'checked' : '') : 'checked'} />
      </label>
    </div>`;

  const footer = `
    <div class="flex gap-3">
      ${st ? `<button type="button" class="btn btn-danger-ghost px-3" data-delete aria-label="Delete student">${icon('trash', 'h-4 w-4')}</button>` : ''}
      <button type="button" class="btn btn-secondary flex-1" data-cancel>Cancel</button>
      <button type="button" class="btn btn-primary flex-1" data-save>${isNew ? 'Add student' : 'Save changes'}</button>
    </div>`;

  const m = openModal({ title: isNew ? 'New student' : 'Edit student', body, maxWidth: 'sm:max-w-lg', footer });

  m.el.querySelector('[data-cancel]')?.addEventListener('click', () => m.close());
  m.el.querySelector('[data-save]').addEventListener('click', save);

  if (st) {
    m.el.querySelector('[data-delete]').addEventListener('click', async () => {
      const yes = await confirmDialog({
        title: 'Delete student',
        message: `Delete “${st.name}”? ${lessonCount ? `${lessonCount} lesson${lessonCount > 1 ? 's' : ''} for this student will also be removed.` : ''} This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (yes) {
        await state.deleteStudent(st.id);
        m.close();
        toast('Student deleted', { type: 'success' });
      }
    });
  }

  function save() {
    clearErrors(m.el);
    const name = m.el.querySelector('#st-name').value.trim();
    const subject = m.el.querySelector('#st-subject').value.trim();
    const color = m.el.querySelector('[data-color][aria-checked="true"]')?.dataset.color || getSettings().tuitionDefaultColor;
    const usualTime = m.el.querySelector('#st-time').value || null;
    const notes = m.el.querySelector('#st-notes').value.trim();
    const active = m.el.querySelector('#st-active').checked;

    if (usualTime && !isValidTimeStr(usualTime)) {
      setError(m.el.querySelector('#st-time'), 'Please enter a valid time.');
      return;
    }
    if (!name) {
      setError(m.el.querySelector('#st-name'), 'Please enter a name.');
      return;
    }
    saveSettings({ tuitionDefaultColor: color });
    state
      .saveStudent({
        id: st?.id,
        name,
        subject,
        color,
        usualTime,
        notes,
        active,
      })
      .then(() => {
        m.close();
        toast(isNew ? 'Student added' : 'Student updated', { type: 'success' });
      });
  }
}

/* ---------------- Lesson form ---------------- */

function openLessonForm(l = null, defaultDate = sel) {
  const data = state.getData();
  const students = [...data.students].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  if (!students.length) {
    toast('Add a student first', { type: 'error' });
    openStudentsManager();
    return;
  }
  const isNew = !l;
  const studentOptions = students.map((s) => [s.id, `${s.name}${s.subject ? ' · ' + s.subject : ''}${s.active ? '' : ' (inactive)'}`]);

  const body = `
    <div class="space-y-4">
      <div class="field-wrap">
        ${selectField({ id: 'lesson-student', label: 'Student', value: l?.studentId || students[0].id, options: studentOptions, required: true })}
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="field-wrap">
          <label class="field-label" for="lesson-date">Date</label>
          <input id="lesson-date" type="date" class="field" value="${esc(l?.date || defaultDate || todayStr())}" />
        </div>
        <div class="field-wrap">
          <label class="field-label" for="lesson-time">Time <span class="font-normal text-neutral-400">(optional)</span></label>
          <input id="lesson-time" type="time" class="field" value="${esc(l?.time || '')}" />
        </div>
      </div>
      <div class="field-wrap">
        <label class="field-label" for="lesson-reminder">Reminder</label>
        ${reminderSelect(l?.reminderMin || getSettings().defaultReminderMin, 'lesson-reminder')}
      </div>
      <div class="field-wrap">
        <label class="field-label" for="lesson-note">Note <span class="font-normal text-neutral-400">(optional)</span></label>
        <input id="lesson-note" type="text" maxlength="200" class="field" placeholder="What was covered…" value="${esc(l?.note || '')}" />
      </div>
    </div>`;

  const m = openModal({
    title: isNew ? 'New lesson' : 'Edit lesson',
    body,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary flex-1" data-save>${isNew ? 'Add lesson' : 'Save changes'}</button>
      </div>`,
  });

  const reminderSel = m.el.querySelector('#lesson-reminder');
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
    const studentId = m.el.querySelector('#lesson-student').value;
    const date = m.el.querySelector('#lesson-date').value;
    const time = m.el.querySelector('#lesson-time').value || null;
    const note = m.el.querySelector('#lesson-note').value.trim();
    const reminderMin = getReminderMin();
    let ok = true;
    if (!studentId) {
      setError(m.el.querySelector('#lesson-student'), 'Please choose a student.');
      ok = false;
    }
    if (!isValidDateStr(date)) {
      setError(m.el.querySelector('#lesson-date'), 'Please pick a valid date.');
      ok = false;
    }
    if (time && !isValidTimeStr(time)) {
      setError(m.el.querySelector('#lesson-time'), 'Please enter a valid time.');
      ok = false;
    }
    if (!ok) return;

    state
      .saveLesson({
        id: l?.id,
        studentId,
        date,
        time,
        note,
        reminderMin,
        completed: l ? l.completed : false,
      })
      .then(() => {
        m.close();
        if (!l && date) {
          sel = date;
          const k = `${date.slice(0, 7)}`;
          if (!ym.startsWith(date.slice(0, 7))) ym = k;
        }
        toast(isNew ? 'Lesson added' : 'Lesson updated', { type: 'success' });
      });
  }
}

/* ---------------- Lesson detail ---------------- */

function openLessonDetail(id) {
  const data = state.getData();
  const l = data.lessons.find((x) => x.id === id);
  if (!l) return;
  const st = data.students.find((s) => s.id === l.studentId);
  const c = studentColorById(st?.color);
  const rows = [];
  rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Student</span>
      <span class="flex items-center gap-2 text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100"><span class="h-2 w-2 rounded-full ${c.dot}"></span>${esc(st?.name || 'Unknown')}</span>
    </div>`);
  if (st?.subject) {
    rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Subject</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${esc(st.subject)}</span>
    </div>`);
  }
  rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Date</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${esc(fullDate(l.date))}${l.time ? ' · ' + esc(timeLabel(l.time)) : ''}</span>
    </div>`);
  rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Status</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${l.completed ? 'Completed' : 'Upcoming'}</span>
    </div>`);
  if (l.reminderMin) {
    rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Reminder</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${esc(reminderLabel(l.reminderMin))}</span>
    </div>`);
  }

  const m = openModal({
    title: l.completed ? 'Lesson — done' : 'Lesson',
    body: `
      ${l.note ? `<p class="mb-4 text-[14.5px] leading-relaxed text-neutral-600 dark:text-neutral-300">${esc(l.note)}</p>` : ''}
      <div class="space-y-2">${rows.join('')}</div>`,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-edit>${icon('pencil', 'h-4 w-4')}Edit</button>
        <button type="button" class="btn ${l.completed ? 'btn-secondary' : 'btn-primary'} flex-1" data-toggle>${l.completed ? 'Undo' : 'Mark done'}</button>
        <button type="button" class="btn btn-danger-ghost px-3" data-delete aria-label="Delete lesson">${icon('trash', 'h-4 w-4')}</button>
      </div>`,
  });

  m.el.querySelector('[data-edit]').addEventListener('click', () => {
    m.close();
    openLessonForm(l, l.date);
  });
  m.el.querySelector('[data-toggle]').addEventListener('click', () => {
    state.toggleLesson(l.id);
    m.close();
    toast(l.completed ? 'Lesson marked done' : 'Lesson marked as upcoming', { type: 'success' });
  });
  m.el.querySelector('[data-delete]').addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: 'Delete lesson',
      message: `Delete this ${st?.name ? st.name + ' ' : ''}lesson? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (yes) {
      await state.deleteLesson(l.id);
      m.close();
      toast('Lesson deleted', { type: 'success' });
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
  else if (action === 'manage-students') openStudentsManager();
  else if (action === 'add-student') openStudentForm();
  else if (action === 'edit-student') openStudentForm(state.getData().students.find((s) => s.id === id));
  else if (action === 'add-lesson') openLessonForm();
  else if (action === 'open-lesson') openLessonDetail(id);
  else if (action === 'toggle-lesson') {
    e.stopPropagation();
    state.toggleLesson(id);
  }
}