/* Shared building blocks used across views. */

import { icon } from './icons.js';
import { esc } from './utils.js';
import { REMINDER_OPTIONS, reminderLabel } from './storage.js';

export function emptyState({ iconName, title, subtitle, action = '' }) {
  return `
    <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
        ${icon(iconName, 'h-7 w-7')}
      </div>
      <h3 class="text-[15px] font-semibold text-neutral-800 dark:text-neutral-100">${esc(title)}</h3>
      <p class="mt-1 max-w-xs text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">${esc(subtitle)}</p>
      ${action ? `<div class="mt-5">${action}</div>` : ''}
    </div>`;
}

export function viewHeader({ title, subtitle = '', action = '', iconName = null }) {
  const chip = iconName
    ? `<span class="view-head-chip">${icon(iconName, 'h-[18px] w-[18px]')}</span>`
    : '';
  return `
    <div class="mb-5 flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        ${chip}
        <div class="min-w-0">
          <h1 class="text-[22px] font-bold leading-7 tracking-tight text-neutral-900 dark:text-white">${esc(title)}</h1>
          ${subtitle ? `<p class="mt-0.5 text-[13.5px] text-neutral-500 dark:text-neutral-400">${subtitle}</p>` : ''}
        </div>
      </div>
      ${action ? `<div class="shrink-0">${action}</div>` : ''}
    </div>`;
}

export function segmented(options, value, name) {
  // options: [{ id, label }]
  return `
    <div class="flex w-full rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800" role="radiogroup" aria-label="${esc(name)}">
      ${options
        .map(
          (o) => `
        <button type="button" role="radio" aria-checked="${o.id === value}" data-seg="${esc(o.id)}"
          class="seg flex-1 ${o.id === value ? 'seg-active' : ''}">${esc(o.label)}</button>`
        )
        .join('')}
    </div>`;
}

export function reminderSelect(value, name = 'reminderMin') {
  const options = [...REMINDER_OPTIONS.map((r) => [String(r.min), r.label]), ['custom', 'Custom…']];
  const valueNorm = value && value !== 0 && !REMINDER_OPTIONS.some((r) => r.min === value) ? 'custom' : String(value || '');
  return `
    <select id="${esc(name)}" name="${esc(name)}" class="field" aria-label="Reminder">
      <option value="">No reminder</option>
      ${options
        .map(([v, l]) => `<option value="${esc(v)}" ${v === valueNorm ? 'selected' : ''}>${esc(l)}</option>`)
        .join('')}
    </select>
    <div id="custom-reminder-wrap" class="mt-2 ${valueNorm === 'custom' ? '' : 'hidden'}">
      <label class="field-label" for="customReminderMin">Minutes before</label>
      <input id="customReminderMin" type="number" min="1" step="1" class="field" value="${Number(value) || ''}" placeholder="e.g. 45" />
    </div>`;
}

export function reminderReadout(min) {
  return min ? reminderLabel(min) : '';
}

export function selectField({ id, label, value, options, placeholder = 'Select…', required = false }) {
  return `
    <label class="field-label" for="${esc(id)}">${esc(label)}</label>
    <select id="${esc(id)}" class="field" ${required ? 'required' : ''} aria-label="${esc(label)}">
      <option value="" ${!value ? 'selected' : ''}>${esc(placeholder)}</option>
      ${options
        .map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`;
        })
        .join('')}
    </select>`;
}

export function textInput({ id, label, value, placeholder = '', type = 'text', required = false, autofocus = false, inputmode = null }) {
  return `
    <label class="field-label" for="${esc(id)}">${esc(label)}</label>
    <input id="${esc(id)}" type="${type}" class="field" value="${esc(value ?? '')}" placeholder="${esc(placeholder)}"
      ${required ? 'required' : ''} ${autofocus ? 'data-autofocus' : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} />`;
}

export function numberInput({ id, label, value, placeholder = '', step = 'any', min = null, required = false, autofocus = false }) {
  return `
    <label class="field-label" for="${esc(id)}">${esc(label)}</label>
    <input id="${esc(id)}" type="number" inputmode="decimal" step="${step}" ${min != null ? `min="${min}"` : ''}
      class="field" value="${value == null ? '' : esc(String(value))}" placeholder="${esc(placeholder)}"
      ${required ? 'required' : ''} ${autofocus ? 'data-autofocus' : ''} />`;
}

/** Priority segmented control with colored dots. */
export function priorityControl(value) {
  const opts = [
    { id: 'high', label: 'High', dot: 'bg-red-500' },
    { id: 'medium', label: 'Medium', dot: 'bg-amber-500' },
    { id: 'low', label: 'Low', dot: 'bg-slate-400' },
  ];
  return `
    <div class="field-wrap">
      <span class="field-label">Priority</span>
      <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Priority">
        ${opts
          .map(
            (o) => `
          <button type="button" role="radio" aria-checked="${o.id === value}" data-priority="${o.id}"
            class="priority-opt flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[13.5px] font-medium transition">
            <span class="h-2 w-2 rounded-full ${o.dot}"></span>${o.label}
          </button>`
          )
          .join('')}
      </div>
    </div>`;
}

/** Student color picker. */
export function colorControl(value, colors) {
  return `
    <div class="field-wrap">
      <span class="field-label">Color</span>
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
        ${colors
          .map(
            (c) => `
          <button type="button" role="radio" aria-checked="${c.id === value}" aria-label="${esc(c.id)}" data-color="${c.id}"
            class="color-opt h-9 w-9 rounded-full ${c.swatch} transition hover:opacity-100"></button>`
          )
          .join('')}
      </div>
    </div>`;
}