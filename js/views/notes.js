/* Notes view — quick, private notes with pinning and text search. */

import * as state from '../state.js';
import { esc } from '../utils.js';
import { icon } from '../icons.js';
import { openModal, toast, confirmDialog, refresh } from '../ui.js';
import { viewHeader, emptyState } from '../components.js';

let query = '';

export function resetView() {
  query = '';
}

function excerpt(note, len = 150) {
  const t = (note.body || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > len ? t.slice(0, len).trimEnd() + '…' : t;
}

function updatedLabel(n) {
  const d = new Date(n.updatedAt || n.createdAt || Date.now());
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return 'Edited today · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const days = Math.floor((now - d) / 86400000);
  if (days <= 7) return `Edited ${days}d ago`;
  return 'Edited ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function render(container) {
  const q = query.trim().toLowerCase();
  const notes = state
    .getData()
    .notes.filter((n) => {
      if (!q) return true;
      return (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

  const headerActions = `
    <div class="flex gap-2">
      <button type="button" class="btn btn-primary px-3 py-2 text-sm" data-action="add-note">${icon('plus', 'h-4 w-4')}New note</button>
    </div>`;

  const search = `
    <div class="relative mb-4">
      <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">${icon('search', 'h-4 w-4')}</span>
      <input id="notes-search" type="search" class="field !pl-10" placeholder="Search notes…" value="${esc(query)}" aria-label="Search notes" />
    </div>`;

  const list = notes.length
    ? `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">${notes.map(noteCard).join('')}</div>`
    : emptyState({
        iconName: 'stickyNote',
        title: q ? 'No matching notes' : 'No notes yet',
        subtitle: q
          ? 'Try a different search term.'
          : 'Capture thoughts, lists and ideas — they stay on this device, visible only to you.',
        action: `<button type="button" class="btn btn-primary" data-action="add-note">${icon('plus', 'h-4 w-4')}New note</button>`,
      });

  container.innerHTML = `
    <div class="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 lg:px-8 lg:pb-20 lg:pt-10">
      ${viewHeader({ title: 'Notes', subtitle: 'Thoughts and lists, kept private', iconName: 'stickyNote', action: headerActions })}
      ${search}
      ${list}
    </div>`;
}

function noteCard(n) {
  const title = n.title?.trim() || 'Untitled';
  const bodyPreview = excerpt(n);
  return `
    <button type="button" data-action="open-note" data-id="${esc(n.id)}"
      class="card row-hover group relative p-4 text-left transition hover:-translate-y-px hover:shadow-md">
      ${n.pinned ? `<span class="absolute right-3.5 top-3.5 text-accent" title="Pinned">${icon('pin', 'h-4 w-4')}</span>` : ''}
      <h3 class="min-w-0 truncate pr-6 text-[15.5px] font-semibold text-neutral-900 dark:text-neutral-100">${esc(title)}</h3>
      ${bodyPreview ? `<p class="mt-1.5 line-clamp-3 whitespace-pre-line text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">${esc(bodyPreview)}</p>` : ''}
      <p class="mt-3 text-[11.5px] font-medium text-neutral-400 dark:text-neutral-500">${esc(updatedLabel(n))}</p>
    </button>`;
}

/* ---------------- Note form ---------------- */

function openNoteForm(n = null) {
  const isNew = !n;
  const body = `
    <div class="space-y-4">
      <div class="field-wrap">
        <label class="field-label" for="note-title">Title</label>
        <input id="note-title" type="text" maxlength="120" class="field" placeholder="e.g. Packing list" data-autofocus value="${esc(n?.title || '')}" />
      </div>
      <div class="field-wrap">
        <label class="field-label" for="note-body">Note</label>
        <textarea id="note-body" rows="7" maxlength="20000" class="field resize-none leading-relaxed" placeholder="Write anything…">${esc(n?.body || '')}</textarea>
      </div>
      <label class="flex cursor-pointer select-none items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/70">
        <span class="flex items-center gap-2 text-[14px] font-medium text-neutral-700 dark:text-neutral-200">${icon('pin', 'h-4 w-4')}Pin to top</span>
        <input id="note-pinned" type="checkbox" class="h-5 w-5 rounded accent-[rgb(var(--accent))]" ${n?.pinned ? 'checked' : ''} />
      </label>
    </div>`;

  const m = openModal({
    title: isNew ? 'New note' : 'Edit note',
    body,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary flex-1" data-save>${isNew ? 'Add note' : 'Save changes'}</button>
      </div>`,
  });

  m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-save]').addEventListener('click', () => {
    const title = m.el.querySelector('#note-title').value.trim();
    const body = m.el.querySelector('#note-body').value;
    const pinned = m.el.querySelector('#note-pinned').checked;
    state.saveNote({ id: n?.id, title, body, pinned }).then(() => {
      m.close();
      toast(isNew ? 'Note added' : 'Note updated', { type: 'success' });
    });
  });
}

/* ---------------- Note detail ---------------- */

function openNoteDetail(id) {
  const n = state.getData().notes.find((x) => x.id === id);
  if (!n) return;
  const title = n.title?.trim() || 'Untitled';

  const m = openModal({
    title,
    body: `
      <p class="px-1 text-[11.5px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        ${n.pinned ? 'Pinned · ' : ''}${esc(updatedLabel(n))}
        ${n.createdAt ? ' · Created ' + new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
      </p>
      <div class="mt-3 whitespace-pre-wrap rounded-xl bg-neutral-50 px-4 py-3.5 text-[14.5px] leading-relaxed text-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-200">
        ${esc(n.body || '') || '<span class="text-neutral-400 dark:text-neutral-500">No text — this note has a title only.</span>'}
      </div>`,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-edit>${icon('pencil', 'h-4 w-4')}Edit</button>
        <button type="button" class="btn btn-danger-ghost flex-1" data-delete>${icon('trash', 'h-4 w-4')}Delete</button>
      </div>`,
  });

  m.el.querySelector('[data-edit]').addEventListener('click', () => {
    m.close();
    openNoteForm(n);
  });
  m.el.querySelector('[data-delete]').addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: 'Delete note',
      message: `Delete “${title}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (yes) {
      await state.deleteNote(n.id);
      m.close();
      toast('Note deleted', { type: 'success' });
    }
  });
}

/* ---------------- Delegated events ---------------- */

export function onViewClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action, id } = target.dataset;
  if (action === 'add-note') openNoteForm();
  else if (action === 'open-note') openNoteDetail(id);
}

export function onViewChange(e) {
  if (e.target.id === 'notes-search') {
    query = e.target.value;
    refresh();
  }
}