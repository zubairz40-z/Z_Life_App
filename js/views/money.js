/* Money view — personal expense/income tracker with a simple calculator. */

import * as state from '../state.js';
import { getSettings, CATEGORIES, PAYMENT_METHODS } from '../storage.js';
import { esc, todayStr, currentMonthKey, monthLabel, shiftMonth, fullDate, humanDate, formatMoney, formatNumber, isValidDateStr } from '../utils.js';
import { icon } from '../icons.js';
import { openModal, toast, confirmDialog, setError, clearErrors, refresh } from '../ui.js';
import { viewHeader, emptyState, segmented, selectField, textInput } from '../components.js';

let ym = currentMonthKey();
let typeFilter = 'all'; // 'all' | 'income' | 'expense'
let categoryFilter = '';
let calcPrefill = null; // amount to prefill into the Add form

export function resetView() {
  ym = currentMonthKey();
  typeFilter = 'all';
  categoryFilter = '';
}

function summary(data, cur) {
  let balance = 0;
  let monthIncome = 0;
  let monthExpense = 0;
  let saved = 0;
  let monthSaved = 0;
  for (const t of data.transactions) {
    const amt = Number(t.amount) || 0;
    balance += t.type === 'income' ? amt : -amt;
    if (t.saved) {
      saved += amt;
      if (t.date && t.date.startsWith(ym)) monthSaved += amt;
    }
    if (t.date && t.date.startsWith(ym)) {
      if (t.type === 'income') monthIncome += amt;
      else monthExpense += amt;
    }
  }
  return { balance, monthIncome, monthExpense, monthRemaining: monthIncome - monthExpense, saved, monthSaved };
}

export function render(container) {
  const data = state.getData();
  const cur = getSettings().currency;
  const s = summary(data, cur);

  let list = data.transactions
    .filter((t) => t.date && t.date.startsWith(ym))
    .filter((t) => (typeFilter === 'all' ? true : typeFilter === 'saved' ? !!t.saved : t.type === typeFilter))
    .filter((t) => (categoryFilter ? t.category === categoryFilter : true))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

  // group by date
  const groups = [];
  const map = new Map();
  for (const t of list) {
    if (!map.has(t.date)) {
      map.set(t.date, []);
      groups.push({ date: t.date, items: map.get(t.date) });
    }
    map.get(t.date).push(t);
  }

  const headerActions = `
    <div class="flex gap-2">
      <button type="button" class="btn btn-secondary px-3 py-2 text-sm" data-action="open-calc" aria-label="Calculator">${icon('equal', 'h-4 w-4')}</button>
      <button type="button" class="btn btn-primary px-3 py-2 text-sm" data-action="add-transaction">${icon('plus', 'h-4 w-4')}Add</button>
    </div>`;

  const summaryHtml = `
    <div class="grid grid-cols-2 gap-2.5">
      <div class="card bg-accent-wash px-4 py-3.5 ring-accent-soft">
        <p class="text-[12px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Balance</p>
        <p class="mt-1 text-[21px] font-bold tabular-nums tracking-tight text-neutral-900 dark:text-white">${formatMoney(s.balance, cur)}</p>
        <p class="mt-0.5 text-[11.5px] text-neutral-400 dark:text-neutral-500">All time</p>
      </div>
      <div class="card px-4 py-3.5">
        <p class="text-[12px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Remaining</p>
        <p class="mt-1 text-[21px] font-bold tabular-nums tracking-tight text-accent">${formatMoney(s.monthRemaining, cur)}</p>
        <p class="mt-0.5 text-[11.5px] text-neutral-400 dark:text-neutral-500">This month</p>
      </div>
      <div class="card bg-emerald-50/60 px-4 py-3.5 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
        <p class="text-[12px] font-medium uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">Income</p>
        <p class="mt-1 text-[19px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">${formatMoney(s.monthIncome, cur)}</p>
        <p class="mt-0.5 text-[11.5px] text-emerald-600/60 dark:text-emerald-400/60">This month</p>
      </div>
      <div class="card bg-rose-50/60 px-4 py-3.5 ring-1 ring-inset ring-rose-100 dark:bg-rose-500/10 dark:ring-rose-500/20">
        <p class="text-[12px] font-medium uppercase tracking-wide text-rose-700/80 dark:text-rose-300/80">Expenses</p>
        <p class="mt-1 text-[19px] font-semibold tabular-nums text-red-600 dark:text-red-400">${formatMoney(s.monthExpense, cur)}</p>
        <p class="mt-0.5 text-[11.5px] text-rose-600/60 dark:text-rose-400/60">This month</p>
      </div>
      <div class="card col-span-2 flex items-center justify-between bg-accent-wash px-4 py-3.5 ring-accent-soft">
        <div>
          <p class="text-[12px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Saved</p>
          <p class="mt-0.5 text-[11.5px] text-neutral-400 dark:text-neutral-500">${s.monthSaved > 0 ? `${formatMoney(s.monthSaved, cur)} saved this month` : 'Income marked “saved”'}</p>
        </div>
        <p class="text-[24px] font-bold tabular-nums tracking-tight text-accent">${formatMoney(s.saved, cur)}</p>
      </div>
    </div>`;

  const filters = `
    <div class="mt-4 flex flex-col gap-2.5">
      <div class="flex items-center justify-between gap-2">
        <div class="flex gap-1.5">
          <button type="button" class="btn px-3 py-1.5 text-[13px] ${typeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-action="filter-type" data-value="all">All</button>
          <button type="button" class="btn px-3 py-1.5 text-[13px] ${typeFilter === 'income' ? 'btn-primary' : 'btn-secondary'}" data-action="filter-type" data-value="income">Income</button>
          <button type="button" class="btn px-3 py-1.5 text-[13px] ${typeFilter === 'saved' ? 'btn-primary' : 'btn-secondary'}" data-action="filter-type" data-value="saved">Saved</button>
          <button type="button" class="btn px-3 py-1.5 text-[13px] ${typeFilter === 'expense' ? 'btn-primary' : 'btn-secondary'}" data-action="filter-type" data-value="expense">Expenses</button>
        </div>
        <button type="button" class="btn btn-secondary px-2.5 py-1.5 text-[13px]" data-action="clear-filters" ${categoryFilter ? '' : 'disabled'}>${icon('filter', 'h-4 w-4')}${categoryFilter ? `<span class="ml-1">${esc(categoryFilter)}</span>` : ''}</button>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="icon-btn" data-action="prev-month" aria-label="Previous month">${icon('chevronLeft', 'h-5 w-5')}</button>
        <div class="flex-1 text-center text-[14px] font-semibold text-neutral-800 dark:text-neutral-100">${monthLabel(ym)}</div>
        <button type="button" class="icon-btn" data-action="next-month" aria-label="Next month">${icon('chevronRight', 'h-5 w-5')}</button>
      </div>
      <div>
        <select id="money-category" class="field !py-2 text-[13.5px]" aria-label="Filter by category">
          <option value="">All categories</option>
          ${CATEGORIES.map((c) => `<option value="${esc(c)}" ${c === categoryFilter ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
    </div>`;

  const historyHtml = groups.length
    ? groups
        .map(
          (g) => `
        <div>
          <h3 class="mb-1.5 mt-5 px-1 text-[12px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">${g.date === todayStr() ? 'Today' : fullDate(g.date)}</h3>
          <div class="card divide-y divide-neutral-100 dark:divide-neutral-800">${g.items.map(txRow).join('')}</div>
        </div>`
        )
        .join('')
    : emptyState({
        iconName: 'wallet',
        title: 'No transactions',
        subtitle: categoryFilter || typeFilter !== 'all'
          ? 'Nothing matches the current filters.'
          : 'Add your first income or expense to start tracking.',
        action: `<button type="button" class="btn btn-primary" data-action="add-transaction">${icon('plus', 'h-4 w-4')}Add transaction</button>`,
      });

  container.innerHTML = `
    <div class="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 lg:px-8 lg:pb-20 lg:pt-10">
      ${viewHeader({ title: 'Money', subtitle: 'Personal finances, kept simple', iconName: 'wallet', action: headerActions })}
      ${summaryHtml}
      ${filters}
      <div class="mb-1">${historyHtml}</div>
    </div>`;
}

function txRow(t) {
  const income = t.type === 'income';
  const chips = [];
  if (t.saved) chips.push(`<span class="chip bg-accent-soft text-accent">${icon('save', 'h-3 w-3')}Saved</span>`);
  if (t.category) chips.push(`<span class="chip bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">${esc(t.category)}</span>`);
  if (t.method) chips.push(`<span class="chip bg-neutral-50 text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400">${esc(t.method)}</span>`);
  const amountCls = income
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
  const amt = formatMoney(Number(t.amount) || 0, getSettings().currency);
  return `
    <button type="button" data-action="open-transaction" data-id="${esc(t.id)}" class="row-hover flex w-full items-center gap-3 px-4 py-3 text-left">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${income ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}">
        ${icon(income ? 'arrowUpRight' : 'arrowDown', 'h-4 w-4')}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[15px] font-medium text-neutral-900 dark:text-neutral-100">${esc(t.where || 'Untitled')}</span>
        <span class="mt-0.5 flex flex-wrap items-center gap-1">${chips.join('')}</span>
      </span>
      <span class="shrink-0 text-[15px] font-semibold tabular-nums ${amountCls}">${income ? '+' : '−'}${esc(amt)}</span>
    </button>`;
}

/* ---------------- Transaction form ---------------- */

function openTransactionForm(tx = null) {
  const isNew = !tx;
  const body = `
    <div class="space-y-4">
      <div class="field-wrap">
        <label class="field-label" for="tx-amount">Amount</label>
        <div class="relative">
          <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-neutral-400 dark:text-neutral-500">${esc((getSettings().currency === 'BDT' ? '৳' : getSettings().currency === 'USD' ? '$' : getSettings().currency === 'EUR' ? '€' : '£'))}</span>
          <input id="tx-amount" type="text" inputmode="decimal" autocomplete="off" class="field pl-8" placeholder="0.00" value="${calcPrefill != null ? esc(String(calcPrefill)) : esc(tx?.amount ?? '')}" data-autofocus />
        </div>
      </div>
      <div class="field-wrap">
        <span class="field-label">Type</span>
        ${segmented(
          [
            { id: 'expense', label: 'Expense' },
            { id: 'income', label: 'Income' },
          ],
          tx?.type || 'expense',
          'Transaction type'
        )}
      </div>
      <div class="field-wrap">
        <label class="field-label" for="tx-where">Where</label>
        <input id="tx-where" type="text" maxlength="80" class="field" placeholder="e.g. Foodpanda, Uber, Agora, NSU" value="${esc(tx?.where || '')}" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="field-wrap">
          ${selectField({ id: 'tx-category', label: 'Category', value: tx?.category || '', options: CATEGORIES, placeholder: 'Select category' })}
        </div>
        <div class="field-wrap">
          ${selectField({ id: 'tx-method', label: 'Payment method', value: tx?.method || '', options: PAYMENT_METHODS, placeholder: 'Select method' })}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 items-end">
        <div class="field-wrap">
          <label class="field-label" for="tx-date">Date</label>
          <input id="tx-date" type="date" class="field" value="${esc(tx?.date || todayStr())}" />
        </div>
        <label id="tx-save-wrap" class="mb-0.5 flex cursor-pointer select-none items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/70 ${tx?.type === 'income' ? '' : 'hidden'}">
          <span class="flex items-center gap-1.5 text-[13px] font-medium text-neutral-700 dark:text-neutral-200">${icon('save', 'h-3.5 w-3.5')}Save to savings</span>
          <input id="tx-saved" type="checkbox" class="h-5 w-5 rounded accent-[rgb(var(--accent))]" ${tx?.saved ? 'checked' : ''} />
        </label>
      </div>
      <div class="field-wrap">
        <label class="field-label" for="tx-note">Note <span class="font-normal text-neutral-400">(optional)</span></label>
        <input id="tx-note" type="text" maxlength="200" class="field" placeholder="e.g. Dinner with friends" value="${esc(tx?.note || '')}" />
      </div>
    </div>`;

  const m = openModal({
    title: isNew ? 'Add transaction' : 'Edit transaction',
    body,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-cancel>Cancel</button>
        <button type="button" class="btn btn-primary flex-1" data-save>${isNew ? 'Add' : 'Save changes'}</button>
      </div>`,
  });

  // segmented wiring
  const segButtons = m.el.querySelectorAll('[data-seg]');
  const saveWrap = m.el.querySelector('#tx-save-wrap');
  segButtons.forEach((b) =>
    b.addEventListener('click', () => {
      segButtons.forEach((x) => {
        const on = x === b;
        x.classList.toggle('seg-active', on);
        x.setAttribute('aria-checked', on);
      });
      // The savings checkbox only makes sense for income.
      saveWrap.classList.toggle('hidden', b.dataset.seg !== 'income');
    })
  );
  if ((tx?.type || 'expense') !== 'income') saveWrap.classList.add('hidden');

  m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-save]').addEventListener('click', save);

  function save() {
    clearErrors(m.el);
    const amountRaw = m.el.querySelector('#tx-amount').value.replace(/,/g, '').trim();
    const amount = Number(amountRaw);
    const where = m.el.querySelector('#tx-where').value.trim();
    const category = m.el.querySelector('#tx-category').value;
    const method = m.el.querySelector('#tx-method').value;
    const date = m.el.querySelector('#tx-date').value;
    const note = m.el.querySelector('#tx-note').value.trim();
    const type = m.el.querySelector('[data-seg][aria-checked="true"]')?.dataset.seg || 'expense';
    let ok = true;
    if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
      setError(m.el.querySelector('#tx-amount'), 'Please enter an amount greater than 0.');
      ok = false;
    }
    if (!where) {
      setError(m.el.querySelector('#tx-where'), 'Please enter where the money went or came from.');
      ok = false;
    }
    if (!isValidDateStr(date)) {
      setError(m.el.querySelector('#tx-date'), 'Please pick a valid date.');
      ok = false;
    }
    if (!ok) return;

    state
      .saveTransaction({
        id: tx?.id,
        amount: Math.round(amount * 100) / 100,
        type,
        where,
        category,
        method,
        date,
        note,
        saved: type === 'income' && m.el.querySelector('#tx-saved').checked,
      })
      .then(() => {
        calcPrefill = null;
        ym = `${date.slice(0, 7)}`;
        m.close();
        toast(isNew ? 'Transaction added' : 'Transaction updated', { type: 'success' });
      });
  }
}

/* ---------------- Transaction detail ---------------- */

function openTransactionDetail(id) {
  const t = state.getData().transactions.find((x) => x.id === id);
  if (!t) return;
  const income = t.type === 'income';
  const cur = getSettings().currency;
  const rows = [];
  rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">Amount</span>
      <span class="text-[15px] font-semibold tabular-nums ${income ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">${income ? '+' : '−'}${esc(formatMoney(t.amount, cur))}</span>
    </div>`);
  const rows2 = [
    ['Type', `${income ? 'Income' : 'Expense'}${t.saved ? ' — saved' : ''}`],
    ['Date', humanDate(t.date)],
    ['Category', t.category || '—'],
    ['Payment method', t.method || '—'],
  ];
  for (const [k, v] of rows2) {
    rows.push(`<div class="flex items-center justify-between rounded-xl bg-neutral-50 px-3.5 py-2.5 dark:bg-neutral-800/50">
      <span class="text-[13px] text-neutral-500 dark:text-neutral-400">${esc(k)}</span>
      <span class="text-[13.5px] font-medium text-neutral-800 dark:text-neutral-100">${esc(v)}</span>
    </div>`);
  }

  const m = openModal({
    title: t.where || 'Transaction',
    body: `
      ${t.note ? `<p class="mb-4 text-[14.5px] leading-relaxed text-neutral-600 dark:text-neutral-300">${esc(t.note)}</p>` : ''}
      <div class="space-y-2">${rows.join('')}</div>`,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-edit>${icon('pencil', 'h-4 w-4')}Edit</button>
        <button type="button" class="btn btn-danger-ghost flex-1" data-delete>${icon('trash', 'h-4 w-4')}Delete</button>
      </div>`,
  });

  m.el.querySelector('[data-edit]').addEventListener('click', () => {
    m.close();
    openTransactionForm(t);
  });
  m.el.querySelector('[data-delete]').addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: 'Delete transaction',
      message: `Delete the ${income ? 'income' : 'expense'} of ${formatMoney(t.amount, cur)} from ${t.where || 'this record'}?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (yes) {
      await state.deleteTransaction(t.id);
      m.close();
      toast('Transaction deleted', { type: 'success' });
    }
  });
}

/* ---------------- Calculator ---------------- */

// Safe expression evaluator (recursive descent, no eval()).
const TOKEN_RE = /\s*(\d+\.?\d*|\.\d+|[+−×÷*\/()])/g;

function tokenize(expr) {
  const tokens = [];
  let m;
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(expr))) {
    if (m.index !== last) return null; // unknown chars
    tokens.push(m[1].replace('×', '*').replace('−', '-').replace('÷', '/'));
    last = TOKEN_RE.lastIndex;
  }
  return last === expr.length ? tokens : null;
}

class Parser {
  constructor(tokens) {
    this.t = tokens;
    this.i = 0;
  }
  peek() {
    return this.t[this.i];
  }
  next() {
    return this.t[this.i++];
  }
  expect(v) {
    if (this.peek() === v) return this.next();
    throw new Error('parse');
  }
  parseExpr() {
    let v = this.parseTerm();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.next();
      const r = this.parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  parseTerm() {
    let v = this.parseFactor();
    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.next();
      const r = this.parseFactor();
      if (op === '/') {
        if (r === 0) throw new Error('div0');
        v = v / r;
      } else {
        v = v * r;
      }
    }
    return v;
  }
  parseFactor() {
    const t = this.peek();
    if (t === '-') {
      this.next();
      return -this.parseFactor();
    }
    if (t === '(') {
      this.next();
      const v = this.parseExpr();
      this.expect(')');
      return v;
    }
    if (t != null && /^\d/.test(t)) return Number(this.next());
    throw new Error('parse');
  }
}

export function evalExpr(expr) {
  try {
    const tokens = tokenize(expr);
    if (!tokens) return null;
    const p = new Parser(tokens);
    const v = p.parseExpr();
    if (p.peek() !== undefined) return null;
    if (!Number.isFinite(v)) return null;
    return Math.round(v * 1e10) / 1e10;
  } catch {
    return null;
  }
}

export function formatCalc(n) {
  const str = String(n);
  // trim long decimals
  if (Math.abs(n) >= 1e12) return n.toExponential(3);
  return Number.isInteger(n) ? str : String(Math.round(n * 1e6) / 1e6);
}

function openCalculator() {
  let expr = '';

  const KEYS = [
    [{ k: 'C', t: 'clear', cls: 'text-red-500' }, { k: '(', t: 'ch' }, { k: ')', t: 'ch' }, { k: '⌫', t: 'bs' }],
    [{ k: '7', t: 'ch' }, { k: '8', t: 'ch' }, { k: '9', t: 'ch' }, { k: '÷', t: 'ch' }],
    [{ k: '4', t: 'ch' }, { k: '5', t: 'ch' }, { k: '6', t: 'ch' }, { k: '×', t: 'ch' }],
    [{ k: '1', t: 'ch' }, { k: '2', t: 'ch' }, { k: '3', t: 'ch' }, { k: '−', t: 'ch' }],
    [{ k: '0', t: 'ch' }, { k: '.', t: 'ch' }, { k: '=', t: 'eq', cls: 'bg-indigo-600 text-white' }, { k: '+', t: 'ch' }],
  ];

  const body = `
    <div class="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-right dark:border-neutral-800 dark:bg-neutral-800/50">
      <div id="calc-expr" class="min-h-[22px] truncate text-[15px] text-neutral-500 dark:text-neutral-400">&nbsp;</div>
      <div id="calc-result" class="text-[28px] font-bold tabular-nums leading-9 text-neutral-900 dark:text-white">0</div>
    </div>
    <div class="mt-3 grid grid-cols-4 gap-2">
      ${KEYS.map(
        (row) =>
          row
            .map((b) => {
              const cls = b.cls || 'card text-[17px] font-semibold text-neutral-800 dark:text-neutral-100';
              return `<button type="button" data-calc="${esc(b.t)}" data-k="${esc(b.k)}" class="rounded-xl py-3.5 text-[17px] font-semibold transition active:scale-95 ${cls}">${esc(b.k)}</button>`;
            })
            .join('')
      ).join('')}
    </div>
    <p class="mt-3 text-[12.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">Use “Use result” to fill the amount of a new transaction.</p>`;

  const m = openModal({
    title: 'Calculator',
    body,
    footer: `
      <div class="flex gap-3">
        <button type="button" class="btn btn-secondary flex-1" data-cancel>Close</button>
        <button type="button" class="btn btn-primary flex-1" data-use>${icon('save', 'h-4 w-4')}Use result</button>
      </div>`,
    maxWidth: 'sm:max-w-sm',
  });

  const exprEl = m.el.querySelector('#calc-expr');
  const resEl = m.el.querySelector('#calc-result');
  const keys = m.el.querySelectorAll('[data-calc]');

  function render() {
    exprEl.innerHTML = esc(expr) || '&nbsp;';
    const res = expr ? evalExpr(expr) : null;
    resEl.textContent = res != null ? formatCalc(res) : '…';
    resEl.classList.toggle('text-red-500', res == null && expr.length > 0);
  }

  function appendChar(ch) {
    if (expr.length > 60) return;
    if ('+−×÷'.includes(ch) && '()+−×÷'.includes(expr.slice(-1))) return; // avoid double operators
    if (ch === '.' && /\.\d*$/.test(expr) && !/[+−×÷()]$/.test(expr)) return;
    expr += ch;
    render();
  }

  function backspace() {
    expr = expr.slice(0, -1);
    render();
  }

  function equals() {
    const res = evalExpr(expr);
    if (res != null) {
      expr = formatCalc(res);
      render();
    }
  }

  m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-use]').addEventListener('click', () => {
    const res = evalExpr(expr);
    if (res == null) {
      toast('Enter a valid calculation first', { type: 'error' });
      return;
    }
    calcPrefill = res;
    m.close();
    openTransactionForm();
  });
  keys.forEach((b) =>
    b.addEventListener('click', () => {
      const t = b.dataset.calc;
      if (t === 'clear') {
        expr = '';
        render();
      } else if (t === 'bs') backspace();
      else if (t === 'eq') equals();
      else appendChar(b.dataset.k);
    })
  );
}

/* ---------------- Delegated clicks ---------------- */

export function onViewClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action, id, value } = target.dataset;
  if (action === 'add-transaction') {
    calcPrefill = null;
    openTransactionForm();
  } else if (action === 'open-transaction') openTransactionDetail(id);
  else if (action === 'open-calc') openCalculator();
  else if (action === 'filter-type') { typeFilter = value; refresh(); }
  else if (action === 'clear-filters') { categoryFilter = ''; refresh(); }
  else if (action === 'prev-month') { ym = shiftMonth(ym, -1); refresh(); }
  else if (action === 'next-month') { ym = shiftMonth(ym, 1); refresh(); }
}

export function onViewChange(e) {
  if (e.target && e.target.id === 'money-category') {
    categoryFilter = e.target.value;
    refresh();
  }
}