/* Shared monthly calendar grid used by the Calendar (events) and Tuition views. */

import { monthGrid, todayStr, esc, monthLabel, currentMonthKey, WEEKDAYS_SHORT, MONTHS_SHORT } from '../utils.js';
import { icon } from '../icons.js';

/** dotsFor(dateStr) -> [{ cls, title }] */
export function calendarGridHtml({ ym, sel, dotsFor }) {
  const [y, m] = ym.split('-').map(Number); // m is 1-based (e.g. 9 = September)
  const today = todayStr();
  const cells = monthGrid(y, m - 1); // monthGrid expects a 0-based month index
  const [ty, tm, td] = today.split('-').map(Number);
  const todayDow = new Date(ty, tm - 1, td).getDay();
  const showHeaderToday = ym === currentMonthKey();

  const grid = cells
    .map((c) => {
      const [yy, mm, dd] = c.date.split('-').map(Number);
      const dow = new Date(yy, mm - 1, dd).getDay();
      // Bangladesh weekly holidays: Friday (5) & Saturday (6).
      const isWeekend = dow === 5 || dow === 6;
      const dots = dotsFor(c.date) || [];
      const count = dots.length;
      const isSel = c.date === sel;
      const isToday = c.date === today;
      const dayHtml =
        c.inMonth && isToday && !isSel
          ? `<span class="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white shadow-sm dark:text-white">${c.day}</span>`
          : `<span>${c.day}</span>`;
      // Marker dots: an always-visible "today" point (like a wall calendar)
      // plus one dot per scheduled item on the date.
      const markers = [];
      if (c.inMonth && isToday) markers.push(`<span class="h-[5px] w-[5px] shrink-0 rounded-full ${isSel ? 'bg-white/90' : 'bg-accent'}" data-today-dot></span>`);
      markers.push(...dots.slice(0, 3).map((d) => `<span class="h-[5px] w-[5px] shrink-0 rounded-full ${d.cls}"></span>`));
      if (count > 3) markers.push(`<span class="text-[8px] font-semibold leading-none text-neutral-400 dark:text-neutral-500">${count}</span>`);
      const markerHtml = markers.length
        ? `<span class="mt-0.5 flex h-[5px] items-end justify-center gap-[3px]">${markers.join('')}</span>`
        : '<span class="mt-[7px]"></span>';
      return `
        <button type="button" data-action="cal-pick" data-date="${c.date}"
          aria-label="${esc(c.date)}${isToday ? ' — today' : ''}${count ? ` — ${count} ${count === 1 ? 'item' : 'items'}` : ''}"
          class="cal-cell relative flex aspect-square flex-col items-center justify-center rounded-[10px] text-[13.5px] transition active:scale-95
          ${c.inMonth && isWeekend ? 'bg-accent-softest' : ''}
          ${c.inMonth && isToday && !isSel ? 'today-ring bg-accent-softest' : ''}
          ${c.inMonth ? '' : 'text-neutral-300 dark:text-neutral-700'}
          ${isSel
            ? 'bg-accent text-white shadow-sm dark:text-white'
            : isToday
              ? 'font-bold text-accent'
              : c.inMonth
                ? 'text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800'
                : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'}">
          ${dayHtml}
          ${markerHtml}
        </button>`;
    })
    .join('');

  return `
    <div class="card overflow-hidden">
      <div class="flex items-center justify-between border-b border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
        <button type="button" class="icon-btn !h-9 !w-9" data-action="cal-prev" aria-label="Previous month">${icon('chevronLeft', 'h-5 w-5')}</button>
        <div class="text-center">
          <div class="text-[15.5px] font-bold text-neutral-900 dark:text-neutral-100" data-month-label>${monthLabel(ym)}</div>
          ${showHeaderToday ? `<p class="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">Today · ${WEEKDAYS_SHORT[todayDow]} ${td} ${MONTHS_SHORT[tm - 1]}</p>` : ''}
        </div>
        <button type="button" class="icon-btn !h-9 !w-9" data-action="cal-next" aria-label="Next month">${icon('chevronRight', 'h-5 w-5')}</button>
      </div>
      <div class="px-2.5 pb-2.5 pt-2">
        <div class="mb-1 grid grid-cols-7">
          ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            .map(
              (d, i) =>
                `<span class="py-0.5 text-center text-[11px] font-bold uppercase tracking-wide ${i === 5 || i === 6 ? 'text-accent' : 'text-neutral-400 dark:text-neutral-500'}">${d}</span>`
            )
            .join('')}
        </div>
        <div class="grid grid-cols-7 gap-y-0.5">${grid}</div>
        <p class="mt-2 flex items-center justify-center gap-1.5 border-t border-neutral-100 pt-2 text-[11px] font-medium text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">${icon('sun', 'h-3 w-3')}Friday &amp; Saturday are weekly holidays</p>
      </div>
    </div>`;
}

export function calMonthKey(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}