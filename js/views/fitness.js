/* Fitness view — weight tracking, nothing more. */

import * as state from '../state.js';
import { getSettings, saveSettings } from '../storage.js';
import { esc, todayStr, fullDate, humanDate, isValidDateStr, clamp } from '../utils.js';
import { icon } from '../icons.js';
import { openModal, toast, confirmDialog, setError, clearErrors, refresh } from '../ui.js';
import { viewHeader, emptyState } from '../components.js';

export function render(container) {
  const data = state.getData();
  const settings = getSettings();
  const entries = [...data.weights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)));
  const latest = entries.length ? entries[entries.length - 1] : null;
  const first = entries.length ? entries[0] : null;
  const goal = settings.fitnessGoal;

  // progress toward goal
  let progress = null;
  let progressLabel = '';
  if (goal != null && first && latest && goal > 0 && first.weight !== latest.weight) {
    const total = Math.abs(goal - first.weight);
    const done = Math.abs(latest.weight - first.weight);
    progress = clamp(done / total, 0, 1);
    progressLabel = `You're ${Math.round(progress * 100)}% of the way to your goal.`;
  }

  const headerActions = `<button type="button" class="btn btn-primary px-3.5 py-2 text-sm" data-action="add-weight">${icon('plus', 'h-4 w-4')}Add entry</button>`;

  const currentCard = entries.length
    ? `
    <div class="card mb-3 px-5 py-4">
      <div class="flex items-end justify-between">
        <div>
          <p class="text-[12px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Current weight</p>
          <p class="mt-1 text-[34px] font-bold leading-none tracking-tight text-neutral-900 dark:text-white">${esc(formatWeight(latest.weight))}<span class="ml-1 text-[15px] font-medium text-neutral-400 dark:text-neutral-500">kg</span></p>
          <p class="mt-1.5 text-[12.5px] text-neutral-400 dark:text-neutral-500">${fullDate(latest.date)}</p>
        </div>
        <button type="button" class="btn btn-secondary px-3 py-1.5 text-[13px]" data-action="edit-weight" data-id="${esc(latest.id)}">${icon('pencil', 'h-3.5 w-3.5')}Edit</button>
      </div>
    </div>`
    : emptyState({
        iconName: 'target',
        title: 'No weight entries yet',
        subtitle: 'Add your first entry and ZLife will track the trend for you.',
        action: `<button type="button" class="btn btn-primary" data-action="add-weight">${icon('plus', 'h-4 w-4')}Add entry</button>`,
      });

  const goalCard = `
    <div class="card mb-3 px-5 py-4">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-[12px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Goal weight</p>
          ${goal != null
            ? `<p class="mt-1 text-[20px] font-semibold text-neutral-900 dark:text-white">${esc(formatWeight(goal))}<span class="ml-1 text-[13px] font-medium text-neutral-400 dark:text-neutral-500">kg</span></p>`
            : `<p class="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">Set a target to track progress.</p>`}
        </div>
        <button type="button" class="btn btn-secondary px-3 py-1.5 text-[13px]" data-action="edit-goal">${icon('target', 'h-3.5 w-3.5')}${goal != null ? 'Change' : 'Set goal'}</button>
      </div>
      ${goal != null && progress != null ? `
        <div class="mt-3.5">
          <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div class="h-full rounded-full bg-emerald-500 transition-all duration-500" style="width:${Math.round(progress * 100)}%"></div>
          </div>
          <p class="mt-2 text-[12.5px] text-neutral-500 dark:text-neutral-400">${progressLabel}</p>
        </div>` : ''}
      ${goal != null && progress == null && latest ? `
        <p class="mt-3 text-[12.5px] text-neutral-500 dark:text-neutral-400">You've reached your goal weight — great work. Set a new goal to keep going.</p>` : ''}
    </div>`;

  const trend = entries.length >= 2 ? sparkline(entries) : '';
  const trendCard = trend
    ? `<div class="card mb-6 px-5 py-4">
        <p class="mb-3 text-[12px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Trend</p>
        ${trend}
      </div>`
    : '';

  const history = [...entries].reverse().map((w, i, arr) => {
    const prev = arr[i + 1]; // the entry before (older)
    let delta = null;
    if (prev) delta = Math.round((w.weight - prev.weight) * 10) / 10;
    const deltaHtml = delta == null || delta === 0
      ? '<span class="text-[12px] text-neutral-300 dark:text-neutral-600">—</span>'
      : `<span class="text-[12px] font-medium tabular-nums ${delta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">${delta < 0 ? '' : '+'}${delta} kg</span>`;
    return `
      <button type="button" data-action="open-weight" data-id="${esc(w.id)}" class="row-hover flex w-full items-center gap-3 px-4 py-3 text-left">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">${icon('scale', 'h-4 w-4')}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-medium text-neutral-900 dark:text-neutral-100">${esc(formatWeight(w.weight))} kg${w.id === latest.id ? ' <span class="chip-sm bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">now</span>' : ''}</span>
          <span class="block text-[12.5px] text-neutral-500 dark:text-neutral-400">${esc(humanDate(w.date))}</span>
        </span>
        ${deltaHtml}
      </button>`;
  }).join('');

  container.innerHTML = `
    <div class="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 lg:px-8 lg:pb-20 lg:pt-10">
      ${viewHeader({ title: 'Fitness', subtitle: 'Simple weight tracking', iconName: 'dumbbell', action: headerActions })}
      ${currentCard}
      ${goalCard}
      ${trendCard}
      ${entries.length ? `
        <div class="mb-2 px-1">
          <h2 class="text-[12px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">History</h2>
        </div>
        <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">${history}</div>` : ''}
    </div>`;
}

function formatWeight(n) {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

function sparkline(entries) {
  const n = entries.length;
  const W = 320;
  const H = 84;
  const PAD = 8;
  const weights = entries.map((e) => Number(e.weight));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const pts = weights.map((w, i) => {
    const x = n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = H - PAD - ((w - min) / range) * (H - PAD * 2);
    return [x, y];
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dots = pts
    .map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${i === n - 1 ? '#4f46e5' : 'currentColor'}" class="${i === n - 1 ? '' : 'text-neutral-300 dark:text-neutral-600'}"/>`)
    .join('');
  const minLabel = `${formatWeight(min)} kg`;
  const maxLabel = `${formatWeight(max)} kg`;
  return `
    <svg viewBox="0 0 ${W} ${H}" class="w-full text-indigo-500" role="img" aria-label="Weight trend">
      <line x1="${PAD}" y1="${PAD}" x2="${W - PAD}" y2="${PAD}" class="stroke-neutral-100 dark:stroke-neutral-800" stroke-width="1"/>
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" class="stroke-neutral-100 dark:stroke-neutral-800" stroke-width="1"/>
      <polyline points="${line}" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <g>${dots}</g>
      <text x="${PAD}" y="${H - PAD - 6}" class="fill-neutral-400 text-[10px] dark:fill-neutral-500" font-family="inherit">${minLabel}</text>
      <text x="${W - PAD}" y="${PAD + 12}" class="fill-neutral-400 text-[10px] dark:fill-neutral-500" text-anchor="end" font-family="inherit">${maxLabel}</text>
    </svg>`;
}

/* ---------------- Goal editor ---------------- */

function openGoalEditor() {
  const settings = getSettings();
  const body = `
    <div class="space-y-4">
      <div class="field-wrap">
        <label class="field-label" for="goal-weight">Goal weight (kg)</label>
        <input id="goal-weight" type="number" inputmode="decimal" step="0.1" min="1" class="field" data-autofocus value="${settings.fitnessGoal != null ? esc(String(settings.fitnessGoal)) : ''}" placeholder="e.g. 90" />
      </div>
    </div>`;
  const m = openModal({
    title: settings.fitnessGoal != null ? 'Change goal weight' : 'Set goal weight',
    body,
    footer: `
      <div class="flex gap-3">
        ${settings.fitnessGoal != null ? `<button type="button" class="btn btn-danger-ghost flex-1" data-clear>${icon('trash', 'h-4 w-4')}Clear goal</button>` : ''}
        <button type="button" class="btn btn-secondary flex-1" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary flex-1" data-save>Save</button>
      </div>`,
    maxWidth: 'sm:max-w-sm',
  });
  m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-save]').addEventListener('click', () => {
    const v = Number(m.el.querySelector('#goal-weight').value);
    if (!v || v <= 0) {
      setError(m.el.querySelector('#goal-weight'), 'Please enter a weight greater than 0.');
      return;
    }
    saveSettings({ fitnessGoal: v });
    refresh();
    m.close();
    toast('Goal updated', { type: 'success' });
  });
  m.el.querySelector('[data-clear]')?.addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: 'Clear goal',
      message: 'Remove your goal weight? Progress tracking will pause.',
      confirmLabel: 'Clear goal',
      danger: true,
    });
    if (yes) {
      saveSettings({ fitnessGoal: null });
      refresh();
      m.close();
      toast('Goal cleared', { type: 'success' });
    }
  });
}

/* ---------------- Weight entry form ---------------- */

function openWeightForm(w = null) {
  const isNew = !w;
  const body = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div class="field-wrap">
          <label class="field-label" for="w-date">Date</label>
          <input id="w-date" type="date" class="field" value="${esc(w?.date || todayStr())}" />
        </div>
        <div class="field-wrap">
          <label class="field-label" for="w-weight">Weight (kg)</label>
          <input id="w-weight" type="number" inputmode="decimal" step="0.1" min="1" max="500" class="field" data-autofocus value="${esc(w?.weight ?? '')}" placeholder="e.g. 85.5" />
        </div>
      </div>
      <p class="text-[12.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">If you already have an entry on the same date, it will be replaced.</p>
    </div>`;
  const m = openModal({
    title: isNew ? 'Add weight entry' : 'Edit weight entry',
    body,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary flex-1" data-save>${isNew ? 'Add entry' : 'Save changes'}</button>
      </div>`,
    maxWidth: 'sm:max-w-sm',
  });
  m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-save]').addEventListener('click', save);

  function save() {
    clearErrors(m.el);
    const date = m.el.querySelector('#w-date').value;
    const weight = Number(m.el.querySelector('#w-weight').value);
    let ok = true;
    if (!isValidDateStr(date)) {
      setError(m.el.querySelector('#w-date'), 'Please pick a valid date.');
      ok = false;
    }
    if (!weight || Number.isNaN(weight) || weight <= 0 || weight > 500) {
      setError(m.el.querySelector('#w-weight'), 'Please enter a valid weight in kg.');
      ok = false;
    }
    if (!ok) return;

    // upsert by date (replace existing entry on the same date)
    const existing = state.getData().weights.find((x) => x.date === date);
    state
      .saveWeight({
        id: existing ? existing.id : w?.id,
        date,
        weight: Math.round(weight * 10) / 10,
      })
      .then(() => {
        m.close();
        toast(isNew ? 'Weight entry added' : 'Weight entry updated', { type: 'success' });
      });
  }
}

/* ---------------- Detail ---------------- */

function openWeightDetail(id) {
  const w = state.getData().weights.find((x) => x.id === id);
  if (!w) return;
  const m = openModal({
    title: `${formatWeight(w.weight)} kg`,
    body: `
      <div class="space-y-2">
        <div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
          <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Date</span>
          <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${esc(fullDate(w.date))}</span>
        </div>
      </div>`,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-edit>${icon('pencil', 'h-4 w-4')}Edit</button>
        <button type="button" class="btn btn-danger-ghost flex-1" data-delete>${icon('trash', 'h-4 w-4')}Delete</button>
      </div>`,
    maxWidth: 'sm:max-w-sm',
  });
  m.el.querySelector('[data-edit]').addEventListener('click', () => {
    m.close();
    openWeightForm(w);
  });
  m.el.querySelector('[data-delete]').addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: 'Delete entry',
      message: `Delete the ${formatWeight(w.weight)} kg entry from ${fullDate(w.date)}?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (yes) {
      await state.deleteWeight(w.id);
      m.close();
      toast('Entry deleted', { type: 'success' });
    }
  });
}

/* ---------------- Delegated clicks ---------------- */

export function onViewClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action, id } = target.dataset;
  if (action === 'add-weight') openWeightForm();
  else if (action === 'edit-weight') openWeightForm(state.getData().weights.find((x) => x.id === id));
  else if (action === 'open-weight') openWeightDetail(id);
  else if (action === 'edit-goal') openGoalEditor();
}