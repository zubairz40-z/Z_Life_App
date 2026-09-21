/* Lightweight UI primitives: modals (bottom-sheet on mobile), toasts, confirms. */

import { icon } from './icons.js';
import { esc } from './utils.js';

let toastRoot = null;
let modalEl = null;
let lastFocused = null;
let refreshFn = null;

/** Register the current view's re-render callback (wired by app.js). */
export function setRefresh(fn) {
  refreshFn = fn;
}

/** Re-render the current view without resetting view-local state (filters, month, selection). */
export function refresh() {
  if (refreshFn) refreshFn();
}

function ensureToastRoot() {
  if (toastRoot) return toastRoot;
  toastRoot = document.createElement('div');
  toastRoot.className =
    'pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:items-end sm:pr-6';
  document.body.appendChild(toastRoot);
  return toastRoot;
}

export function toast(message, opts = {}) {
  const { type = 'info', action = null } = opts;
  const root = ensureToastRoot();
  const icons = {
    success: ['checkCircle', 'text-emerald-600 dark:text-emerald-400'],
    error: ['alertTriangle', 'text-red-600 dark:text-red-400'],
    info: ['bell', 'text-indigo-600 dark:text-indigo-400'],
    motivation: ['sparkles', 'text-indigo-600 dark:text-indigo-400'],
  };
  const [ic, icColor] = icons[type] || icons.info;
  const el = document.createElement('div');
  el.className =
    'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur animate-pop dark:border-neutral-700 dark:bg-neutral-800/95';
  el.innerHTML = `
    <span class="shrink-0 ${icColor}">${icon(ic, 'h-5 w-5')}</span>
    <p class="min-w-0 flex-1 text-[14px] leading-snug text-neutral-800 dark:text-neutral-100">${esc(message)}</p>
    ${action ? `<button type="button" class="shrink-0 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400">${esc(action.label)}</button>` : ''}`;
  if (action) {
    el.querySelector('button').addEventListener('click', () => {
      dismiss();
      action.onClick();
    });
  }
  root.appendChild(el);
  const dismiss = () => {
    el.style.transition = 'opacity .15s, transform .15s';
    el.style.opacity = '0';
    el.style.transform = 'scale(.96)';
    setTimeout(() => el.remove(), 160);
  };
  el.addEventListener('click', (e) => {
    if (e.target === el && opts.dismissOnClick !== false) dismiss();
  });
  setTimeout(dismiss, opts.duration ?? 3400);
  return dismiss;
}

/* ---------------- Modal ---------------- */

export function openModal({ title, body, footer = '', maxWidth = 'sm:max-w-md', onClose = null, scrollBody = true }) {
  closeModal(false);
  lastFocused = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" data-close></div>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="${esc(title)}"
      class="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-sheet animate-sheet-in sm:max-h-[88vh] sm:rounded-2xl sm:shadow-xl sm:animate-modal-in dark:bg-neutral-900 ${maxWidth}">
      <div class="pb-safe">
        <div class="flex items-start justify-between gap-3 px-5 pt-3 sm:pt-4">
          <div class="sm:hidden mt-0.5"><div class="sheet-handle"></div></div>
          <h2 class="min-w-0 flex-1 pt-2 text-[17px] font-semibold leading-6 text-neutral-900 sm:pt-0 dark:text-neutral-100">${esc(title)}</h2>
          <button type="button" class="icon-btn -mr-1 -mt-1" data-close aria-label="Close">${icon('x', 'h-5 w-5')}</button>
        </div>
        <div class="${scrollBody ? 'overflow-y-auto overscroll-contain px-5 pb-5 pt-2' : 'px-5 pb-0 pt-2'}">${body}</div>
        ${footer ? `<div class="border-t border-neutral-100 px-5 pb-4 pt-3.5 pt-safe dark:border-neutral-800">${footer}</div>` : ''}
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  modalEl = overlay;

  const close = (restore = true) => {
    if (!overlay.isConnected) return;
    overlay.remove();
    modalEl = null;
    document.body.style.overflow = '';
    if (restore && lastFocused && lastFocused.focus) lastFocused.focus();
    if (onClose) onClose();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // focus first field
  const focusable = overlay.querySelector('input, select, textarea, button[data-autofocus]');
  if (focusable) setTimeout(() => focusable.focus(), 60);

  return {
    close,
    el: overlay,
    bodyEl: overlay.querySelector('[data-modal-body]') || overlay,
  };
}

export function closeModal(restore = true) {
  if (modalEl) {
    const overlay = modalEl;
    modalEl = null;
    overlay.remove();
    document.body.style.overflow = '';
    if (restore && lastFocused && lastFocused.focus) lastFocused.focus();
  }
}

/* ---------------- Confirm dialog ---------------- */

export function confirmDialog(opts) {
  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    word = null,
  } = opts;

  return new Promise((resolve) => {
    let confirmed = false;
    const wordInput = word
      ? `<div class="mt-4">
           <label class="field-label" for="confirm-word">Type <span class="font-semibold">${esc(word)}</span> to continue</label>
           <input id="confirm-word" type="text" autocomplete="off" class="field" placeholder="${esc(word)}" />
         </div>`
      : '';

    const m = openModal({
      title,
      body: `<div class="text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300">${message}</div>${wordInput}`,
      maxWidth: 'sm:max-w-sm',
      footer: `
        <div class="flex gap-3">
          <button type="button" class="btn btn-secondary flex-1" data-cancel>${esc(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} flex-1" data-ok>${esc(confirmLabel)}</button>
        </div>`,
      onClose: () => resolve(confirmed),
    });

    const okBtn = m.el.querySelector('[data-ok]');
    const input = m.el.querySelector('#confirm-word');
    if (input) {
      okBtn.disabled = true;
      okBtn.classList.add('opacity-40');
      input.addEventListener('input', () => {
        const ok = input.value.trim() === word;
        okBtn.disabled = !ok;
        okBtn.classList.toggle('opacity-40', !ok);
      });
    }
    m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      confirmed = true;
      m.close();
    });
  });
}

/* ---------------- Tiny DOM helpers used by views ---------------- */

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function setError(input, message) {
  const wrap = input.closest('.field-wrap');
  if (!wrap) return;
  const existing = wrap.querySelector('.field-error');
  if (existing) existing.remove();
  if (message) {
    const err = document.createElement('p');
    err.className = 'field-error';
    err.setAttribute('role', 'alert');
    err.innerHTML = `${icon('alertCircle', 'h-4 w-4 shrink-0')}<span>${esc(message)}</span>`;
    wrap.appendChild(err);
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
}

export function clearErrors(container) {
  container.querySelectorAll('.field-error').forEach((e) => e.remove());
  container.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
}

export function fieldWrap(inner, extraClass = '') {
  return `<div class="field-wrap ${extraClass}">${inner}</div>`;
}