/* Today view — the home screen: greeting, progress, tasks due today (and overdue). */

import * as state from '../state.js';
import { getSettings } from '../storage.js';
import {
  todayStr, fullDate, greeting, pickMotivation, esc, timeLabel, humanDate, dateTime, isValidTimeStr, isValidDateStr,
} from '../utils.js';
import { icon } from '../icons.js';
import { openModal, toast, confirmDialog, setError, clearErrors } from '../ui.js';
import {
  viewHeader, emptyState, segmented, reminderSelect, priorityControl, textInput, numberInput,
} from '../components.js';
import { priorityById, reminderLabel } from '../storage.js';

function dueSort(a, b) {
  const ta = a.time || '99:99';
  const tb = b.time || '99:99';
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

function taskRowHtml(t, { overdue = false } = {}) {
  const p = priorityById(t.priority);
  const done = !!t.completed;
  const chips = [];
  if (t.time) chips.push(`<span class="chip bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">${icon('clock', 'h-3 w-3')}${esc(timeLabel(t.time))}</span>`);
  if (t.reminderMin) chips.push(`<span class="chip bg-accent-soft text-accent">${icon('bell', 'h-3 w-3')}${esc(reminderLabel(t.reminderMin))}</span>`);
  if (overdue) chips.push(`<span class="chip bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">Overdue</span>`);
  chips.push(`<span class="chip bg-neutral-50 text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400"><span class="h-1.5 w-1.5 rounded-full ${p.dot}"></span>${p.label}</span>`);

  return `
    <button type="button" data-action="open-task" data-id="${esc(t.id)}"
      class="task-row group flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.995]
      ${done
        ? 'border-neutral-200/70 bg-neutral-50/70 hover:bg-neutral-100/70 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:bg-neutral-800/70'
        : 'card hover:border-neutral-300 dark:hover:border-neutral-700'}">
      <span data-action="toggle-task" data-id="${esc(t.id)}" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Mark task as not done' : 'Mark task as done'}"
        class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition
        ${done
          ? 'bg-accent border-accent text-white'
          : 'border-neutral-300 text-transparent hover:border-accent dark:border-neutral-600'}">
        ${icon('check', 'h-3.5 w-3.5')}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[15px] font-medium leading-snug text-neutral-900 dark:text-neutral-100 ${done ? 'text-neutral-400 line-through decoration-neutral-300 dark:text-neutral-500 dark:decoration-neutral-600' : ''}">${esc(t.title)}</span>
        ${t.note ? `<span class="mt-0.5 block truncate text-[13px] text-neutral-500 dark:text-neutral-400 ${done ? 'text-neutral-400/70' : ''}">${esc(t.note)}</span>` : ''}
        ${chips.length ? `<span class="mt-2 flex flex-wrap items-center gap-1.5">${chips.join('')}</span>` : ''}
      </span>
    </button>`;
}

export function render(container) {
  const data = state.getData();
  const today = todayStr();
  const tasks = data.tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const todaysTasks = data.tasks
    .filter((t) => t.dueDate === today)
    .sort((a, b) => Number(a.completed) - Number(b.completed) || dueSort(a, b));
  const hiddenTasks = data.tasks.filter((t) => t.dueDate && t.dueDate > today);

  const dueToday = data.tasks.filter((t) => t.dueDate === today);
  const doneToday = dueToday.filter((t) => t.completed).length;
  const totalToday = dueToday.length;
  const pct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;
  const motivation = doneToday > 0 ? pickMotivation(today) : null;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const addBtn = `
    <button type="button" data-action="add-task" class="btn btn-primary px-3.5 py-2 text-sm">${icon('plus', 'h-4 w-4')}New task</button>`;

  const sections = [];

  sections.push(
    viewHeader({ title: 'Today', subtitle: `${greeting()} · ${fullDate(today)}`, iconName: 'home', action: addBtn })
  );

  // Progress card
  const progressLabel =
    totalToday === 0
      ? 'No tasks scheduled today.'
      : `${doneToday} of ${totalToday} task${totalToday > 1 ? 's' : ''} done`;
  sections.push(`
    <div class="card mb-5 px-4 py-3.5">
      <div class="flex items-center justify-between gap-3">
        <p class="text-[13.5px] font-medium text-neutral-500 dark:text-neutral-400">${progressLabel}</p>
        ${totalToday ? `<p class="text-[13.5px] font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">${pct}%</p>` : ''}
      </div>
      <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div class="h-full rounded-full bg-accent-grad transition-all duration-500" style="width: ${totalToday ? pct + '%' : '0%'}"></div>
      </div>
      ${motivation ? `<p class="mt-2 flex items-center gap-1.5 text-[12.5px] text-accent">${icon('sparkles', 'h-3.5 w-3.5')}${esc(motivation)}</p>` : ''}
    </div>`);

  if (tasks.length) {
    sections.push(`
      <h2 class="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-red-500/80 dark:text-red-400/70">Overdue</h2>
      <div class="space-y-2.5">${tasks.map((t) => taskRowHtml(t, { overdue: true })).join('')}</div>
      <div class="h-6"></div>`);
  }

  sections.push(`
    <div class="mb-2 flex items-end justify-between px-1">
      <h2 class="text-[12px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Today</h2>
      ${todaysTasks.length ? `<span class="text-[12px] tabular-nums text-neutral-400 dark:text-neutral-500">${todaysTasks.length}</span>` : ''}
    </div>`);

  if (!todaysTasks.length) {
    sections.push(
      emptyState({
        iconName: 'checkCircle',
        title: totalToday > 0 ? 'All done for today' : 'Nothing planned today',
        subtitle:
          totalToday > 0
            ? 'Every scheduled task is complete. Enjoy the rest of your day.'
            : 'Plan your first task and get today rolling.',
        action: `<button type="button" data-action="add-task" class="btn btn-primary">${icon('plus', 'h-4 w-4')}Add a task</button>`,
      })
    );
  } else {
    sections.push(`<div class="space-y-2.5">${todaysTasks.map((t) => taskRowHtml(t)).join('')}</div>`);
  }

  if (hiddenTasks.length) {
    const soon = hiddenTasks.filter((t) => t.dueDate === tomorrow.toISOString().slice(0, 10)).slice(0, 3);
    if (soon.length) {
      sections.push(`
        <h2 class="mb-2 mt-7 px-1 text-[12px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Tomorrow</h2>
        <div class="space-y-2.5">${soon.map((t) => taskRowHtml(t)).join('')}</div>`);
    }
  }

  container.innerHTML = `
    <div class="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 lg:px-8 lg:pb-20 lg:pt-10">
      ${sections.join('')}
    </div>`;
}

/* ---------------- Task form ---------------- */

function openTaskForm(task = null) {
  const isNew = !task;
  const body = `
    <div class="space-y-4">
      <div class="field-wrap">
        <label class="field-label" for="task-title">Title</label>
        <input id="task-title" type="text" maxlength="120" class="field" placeholder="e.g. Study JavaScript" data-autofocus value="${esc(task?.title || '')}" />
      </div>
      <div class="field-wrap">
        <label class="field-label" for="task-note">Note <span class="font-normal text-neutral-400">(optional)</span></label>
        <textarea id="task-note" rows="2" maxlength="300" class="field resize-none" placeholder="A short description…">${esc(task?.note || '')}</textarea>
      </div>
      <div>${priorityControl(task?.priority || 'medium')}</div>
      <div class="grid grid-cols-2 gap-3">
        <div class="field-wrap">
          <label class="field-label" for="task-date">Due date</label>
          <input id="task-date" type="date" class="field" value="${esc(task?.dueDate || todayStr())}" />
        </div>
        <div class="field-wrap">
          <label class="field-label" for="task-time">Due time <span class="font-normal text-neutral-400">(optional)</span></label>
          <input id="task-time" type="time" class="field" value="${esc(task?.time || '')}" />
        </div>
      </div>
      <div class="field-wrap">
        <label class="field-label" for="task-reminder">Reminder</label>
        ${reminderSelect(task?.reminderMin || getSettings().defaultReminderMin, 'task-reminder')}
      </div>
    </div>`;

  const m = openModal({
    title: isNew ? 'New task' : 'Edit task',
    body,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary flex-1" data-save>${isNew ? 'Add task' : 'Save changes'}</button>
      </div>`,
  });

  const reminderSel = m.el.querySelector('#task-reminder');
  const customWrap = m.el.querySelector('#custom-reminder-wrap');
  reminderSel.addEventListener('change', () => {
    customWrap.classList.toggle('hidden', reminderSel.value !== 'custom');
  });

  m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-save]').addEventListener('click', save);
  m.el.querySelector('#task-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });

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
    const title = m.el.querySelector('#task-title').value.trim();
    const note = m.el.querySelector('#task-note').value.trim();
    const priority = (m.el.querySelector('[data-priority][aria-checked="true"]')?.dataset.priority) || 'medium';
    const dueDate = m.el.querySelector('#task-date').value;
    const time = m.el.querySelector('#task-time').value || null;
    const reminderMin = getReminderMin();
    let ok = true;
    if (!title) {
      setError(m.el.querySelector('#task-title'), 'Please enter a title.');
      ok = false;
    }
    if (!isValidDateStr(dueDate)) {
      setError(m.el.querySelector('#task-date'), 'Please pick a valid date.');
      ok = false;
    }
    if (time && !isValidTimeStr(time)) {
      setError(m.el.querySelector('#task-time'), 'Please enter a valid time.');
      ok = false;
    }
    if (!ok) return;

    const due = dateTime(dueDate, time);
    if (due == null) {
      setError(m.el.querySelector('#task-date'), 'Please pick a valid date.');
      return;
    }

    const payload = {
      id: task?.id,
      title,
      note,
      priority,
      dueDate,
      time,
      reminderMin,
      completed: task ? task.completed : false,
    };
    state.saveTask(payload).then(() => {
      m.close();
      toast(isNew ? 'Task added' : 'Task updated', { type: 'success' });
    });
  }
}

/* ---------------- Task detail ---------------- */

function openTaskDetail(id) {
  const t = state.getData().tasks.find((x) => x.id === id);
  if (!t) return;
  const p = priorityById(t.priority);
  const done = !!t.completed;

  const rows = [];
  rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Status</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${done ? 'Completed' : 'Pending'}</span>
    </div>`);
  rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Priority</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100"><span class="mr-1.5 inline-block h-2 w-2 rounded-full ${p.dot}"></span>${p.label}</span>
    </div>`);
  if (t.dueDate) {
    rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Due</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${esc(humanDate(t.dueDate))}${t.time ? ' · ' + esc(timeLabel(t.time)) : ''}</span>
    </div>`);
  }
  if (t.reminderMin) {
    rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Reminder</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${esc(reminderLabel(t.reminderMin))}</span>
    </div>`);

  }

  const m = openModal({
    title: t.title,
    body: `
      ${t.note ? `<p class="mb-4 text-[14.5px] leading-relaxed text-neutral-600 dark:text-neutral-300">${esc(t.note)}</p>` : ''}
      <div class="space-y-2">${rows.join('')}</div>`,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-edit>${icon('pencil', 'h-4 w-4')}Edit</button>
        <button type="button" class="btn ${done ? 'btn-secondary' : 'btn-primary'} flex-1" data-toggle>${done ? 'Undo' : 'Mark done'}</button>
        <button type="button" class="btn btn-danger-ghost px-3" data-delete aria-label="Delete task">${icon('trash', 'h-4 w-4')}</button>
      </div>`,
  });

  m.el.querySelector('[data-edit]').addEventListener('click', () => {
    m.close();
    openTaskForm(t);
  });
  m.el.querySelector('[data-toggle]').addEventListener('click', () => {
    state.toggleTask(t.id);
    m.close();
    if (!done) toast(pickMotivation(todayStr()), { type: 'motivation' });
  });
  m.el.querySelector('[data-delete]').addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: 'Delete task',
      message: `Delete “${t.title}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (yes) {
      await state.deleteTask(t.id);
      m.close();
      toast('Task deleted', { type: 'success' });
    }
  });
}

/* ---------------- Delegated clicks ---------------- */

export function onViewClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action, id } = target.dataset;
  if (action === 'add-task') openTaskForm();
  else if (action === 'open-task') openTaskDetail(id);
  else if (action === 'toggle-task') {
    e.stopPropagation();
    const t = state.getData().tasks.find((x) => x.id === id);
    if (!t) return;
    state.toggleTask(id);
    if (!t.completed) toast(pickMotivation(todayStr()), { type: 'motivation' });
  }
}