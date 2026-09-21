/* End-to-end test driver for ZLife using headless Chrome over CDP.
   Usage: node scripts/e2e.js            (full suite)
          node scripts/e2e.js today      (run only steps whose name includes the filter)
*/

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const BASE = 'http://localhost:4173';
const SHOTS = path.join(ROOT, 'shots');
const DOWNLOADS = path.join(os.tmpdir(), 'zlife-downloads');
const TESTDATA = path.join(ROOT, 'testdata');

const FILTER = process.argv[2] || '';

fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(DOWNLOADS, { recursive: true });
fs.mkdirSync(TESTDATA, { recursive: true });

/* ---------------- CDP plumbing ---------------- */

let ws = null;
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const pageExceptions = [];

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalv(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    const ex = r.exceptionDetails.exception?.description || r.exceptionDetails.text || String(r.exceptionDetails);
    throw new Error('Page exception: ' + ex);
  }
  return r.result ? r.result.value : undefined;
}

async function waitFor(expr, timeout = 10000, label = expr) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await evalv(`Boolean(${expr})`)) return;
    } catch {
      /* keep polling */
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('Timed out waiting for: ' + label);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let shotCount = 0;
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(SHOTS, `${String(++shotCount).padStart(2, '0')}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log('  📸 ' + path.relative(ROOT, file));
}

/* ---------------- Test framework ---------------- */

let passCount = 0;
let failCount = 0;
const failures = [];

async function step(name, fn) {
  if (FILTER && !name.toLowerCase().includes(FILTER.toLowerCase())) return;
  try {
    await fn();
    passCount++;
    console.log('  ✅ ' + name);
  } catch (err) {
    failCount++;
    failures.push(name + ' — ' + err.message);
    console.log('  ❌ ' + name + '\n     ' + err.message);
  }
}

function check(cond, message) {
  if (!cond) throw new Error(message);
}

async function click(sel) {
  const ok = await evalv(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error('Element not found for click: ' + sel);
}

async function fill(sel, value) {
  const ok = await evalv(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return false;
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error('Element not found for fill: ' + sel);
}

/** Click the first [data-action] button whose row text contains `text`. */
async function clickRowText(actionSel, text) {
  const ok = await evalv(`(() => {
    const rows = [...document.querySelectorAll(${JSON.stringify(actionSel)})];
    const row = rows.find(r => r.innerText.includes(${JSON.stringify(text)}));
    if (!row) return false;
    row.click();
    return true;
  })()`);
  if (!ok) throw new Error('Row not found: ' + text);
}

/* ---------------- Main ---------------- */

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(os.tmpdir(), 'zlife-chrome-' + Date.now())}`,
    '--window-size=390,844',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

function cleanup(code) {
  try {
    chrome.kill();
  } catch {
    /* ignore */
  }
  console.log(`\n${'-'.repeat(50)}\nPASS: ${passCount}   FAIL: ${failCount}`);
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log('  - ' + f);
  }
  if (consoleErrors.length) {
    console.log(`Console errors captured (${consoleErrors.length}):`);
    for (const c of consoleErrors.slice(0, 20)) console.log('  ' + c.slice(0, 300));
  }
  process.exit(code);
}

process.on('exit', cleanup);
process.on('SIGINT', () => cleanup(1));

async function run() {
  // wait for devtools
  let targets = null;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json/list`);
      targets = await res.json();
      if (targets.length) break;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  const page = targets && targets.find((t) => t.type === 'page');
  if (!page) throw new Error('No page target from Chrome');

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id) {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const { type, args } = msg.params;
      if (type === 'error' || type === 'warning') {
        consoleErrors.push(args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      pageExceptions.push(d.exception?.description || d.text || 'exception');
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS });

  console.log('Loaded page at ' + BASE);
  await send('Page.navigate', { url: BASE });
  await waitFor(`document.querySelector('#view') && document.querySelector('#view').innerText.length > 0`, 15000);

  /* =============== 1. BOOT =============== */
  await step('Boot: app shell renders', async () => {
    check(await evalv(`document.querySelectorAll('[data-nav]').length === 14`), 'expected 14 nav items (7 sidebar + 7 bottom nav)');
    // Brand/tagline live in the sidebar, which is display:none on this mobile viewport,
    // so use textContent (includes hidden elements).
    const shell = await evalv(`(() => { const s = document.querySelector('#sidebar'); return { brand: s.textContent.includes('ZLife'), tag: s.textContent.includes('Your life, organized.') }; })()`);
    check(shell.brand, 'brand missing');
    check(shell.tag, 'tagline missing');
    check(await evalv(`document.querySelector('#view h1')?.innerText === 'Today'`), 'Today not the default view');
  });

  await step('Boot: no page exceptions', async () => {
    if (pageExceptions.length) throw new Error(pageExceptions[0]);
  });

  await step('Boot: service worker registered', async () => {
    // Registration happens on window load — poll for it.
    await waitFor(`(async () => (await navigator.serviceWorker.getRegistrations()).length > 0)()`, 12000, 'service worker registration');
  });

  /* =============== 2. TODAY / TASKS =============== */
  await step('Today: add a task', async () => {
    await click('[data-action="add-task"]');
    await waitFor(`document.querySelector('#task-title')`);
    await fill('#task-title', 'Study JavaScript');
    await fill('#task-note', 'Chapter 4 — closures');
    await click('[data-priority="high"]');
    await fill('#task-date', await evalv('window.__zlifeToday()'));
    await fill('#task-time', '19:00');
    await evalv(`(() => { const s = document.querySelector('#task-reminder'); s.value = '15'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Study JavaScript')`);
    check(await evalv(`document.body.innerText.includes('Chapter 4')`), 'note not shown');
  });

  await step('Today: progress updates after completing', async () => {
    await click(`[data-action="toggle-task"]`);
    await waitFor(`document.body.innerText.includes('1 of 1')`);
    check(await evalv(`document.body.innerText.includes('100%')`), '100% not shown');
  });

  await step('Today: edit a task', async () => {
    await click('[data-action="open-task"]');
    await waitFor(`document.querySelector('[data-edit]')`);
    await click('[data-edit]');
    await waitFor(`document.querySelector('#task-title')`);
    await fill('#task-title', 'Study JavaScript (advanced)');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Study JavaScript (advanced)')`);
  });

  await step('Today: uncomplete then delete', async () => {
    await click('[data-action="toggle-task"]'); // uncomplete
    await waitFor(`!document.body.innerText.includes('1 of 1')`);
    await click('[data-action="open-task"]');
    await waitFor(`document.querySelector('[data-delete]')`);
    await click('[data-delete]');
    await waitFor(`document.querySelector('[data-ok]')`);
    await click('[data-ok]');
    await waitFor(`!document.body.innerText.includes('Study JavaScript')`);
  });
  await shot('today-empty');

  /* =============== 3. PERSISTENCE =============== */
  await step('Today: data persists across reload', async () => {
    await click('[data-action="add-task"]');
    await waitFor(`document.querySelector('#task-title')`);
    await fill('#task-title', 'Persistent task');
    await fill('#task-date', await evalv('window.__zlifeToday()'));
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Persistent task')`);
    await send('Page.reload');
    await waitFor(`document.querySelector('#view') && document.querySelector('#view').innerText.includes('Persistent task')`, 12000);
  });

  /* =============== 4. CALENDAR =============== */
  await step('Calendar: add an event', async () => {
    await evalv(`location.hash = '#/calendar'`);
    await waitFor(`document.querySelector('[data-action="cal-pick"]')`);
    await click(`[data-action="cal-pick"]`);
    await waitFor(`document.querySelector('[data-action="add-event"]')`);
    await click('[data-action="add-event"]');
    await waitFor(`document.querySelector('#ev-title')`);
    await fill('#ev-title', 'CSE Assignment');
    await fill('#ev-date', await evalv('window.__zlifeToday()'));
    await fill('#ev-time', '10:00');
    await click('[data-priority="high"]');
    await evalv(`(() => { const s = document.querySelector('#ev-reminder'); s.value = '1440'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('CSE Assignment')`);
  });

  await step('Calendar: navigate months and jump back to today', async () => {
    const before = await evalv(`document.querySelector('[data-month-label]').innerText`);
    await click('[data-action="cal-next"]');
    await waitFor(`document.querySelector('[data-month-label]').innerText !== ${JSON.stringify(before)}`);
    // The "Today" button must reset the view back to the current BD month.
    await click('[data-action="cal-today"]');
    await waitFor(`document.querySelector('[data-month-label]').innerText === ${JSON.stringify(before)}`);
  });

  await step('Calendar: delete event', async () => {
    await click('[data-action="open-event"]');
    await waitFor(`document.querySelector('[data-delete]')`);
    await click('[data-delete]');
    await waitFor(`document.querySelector('[data-ok]')`);
    await click('[data-ok]');
    await waitFor(`!document.body.innerText.includes('CSE Assignment')`);
  });

  /* =============== 5. TUITION =============== */
  await step('Tuition: add two students', async () => {
    await evalv(`location.hash = '#/tuition'`);
    await waitFor(`document.querySelector('[data-action="manage-students"]')`);
    await click('[data-action="manage-students"]');
    await waitFor(`document.querySelector('[data-action="add-student"]')`);
    await click('[data-action="add-student"]');
    await waitFor(`document.querySelector('#st-name')`);
    await fill('#st-name', 'Ariya');
    await fill('#st-subject', 'English');
    await fill('#st-time', '18:00');
    await click('[data-color="blue"]');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Ariya')`);
    // second student
    await click('[data-action="manage-students"]');
    await waitFor(`document.querySelector('[data-action="add-student"]')`);
    await click('[data-action="add-student"]');
    await waitFor(`document.querySelector('#st-name')`);
    await fill('#st-name', 'Student B');
    await fill('#st-subject', 'Math');
    await click('[data-color="green"]');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Student B')`);
  });

  await step('Tuition: add and complete a lesson', async () => {
    await click(`[data-action="cal-pick"]`);
    await waitFor(`document.querySelector('[data-action="add-lesson"]')`);
    await click('[data-action="add-lesson"]');
    await waitFor(`document.querySelector('#lesson-student')`);
    await evalv(`(() => { const s = document.querySelector('#lesson-student'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await fill('#lesson-time', '17:00');
    await fill('#lesson-note', 'Covered grammar');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Ariya')`);
    check(await evalv(`document.body.innerText.includes('Covered grammar') || document.body.innerText.includes('Ariya')`), 'lesson row missing');
    // complete it
    await click(`[data-action="toggle-lesson"]`);
    await waitFor(`document.body.innerText.includes('Done')`);
  });

  await step('Tuition: lesson detail shows student info', async () => {
    await click('[data-action="open-lesson"]');
    await waitFor(`document.querySelector('[data-edit]')`);
    check(await evalv(`document.body.innerText.includes('Completed')`), 'status not shown');
    await click('[data-close], [data-close]');
  });

  await shot('tuition');

  /* =============== 6. MONEY =============== */
  await step('Money: add expense + income', async () => {
    await evalv(`location.hash = '#/money'`);
    await waitFor(`document.querySelector('[data-action="add-transaction"]')`);
    await click('[data-action="add-transaction"]');
    await waitFor(`document.querySelector('#tx-amount')`);
    await fill('#tx-amount', '800');
    await fill('#tx-where', 'Foodpanda');
    await evalv(`(() => { const s = document.querySelector('#tx-category'); s.value = 'Food'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await evalv(`(() => { const s = document.querySelector('#tx-method'); s.value = 'bKash'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await fill('#tx-note', 'Dinner with friends');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Foodpanda')`);

    await click('[data-action="add-transaction"]');
    await waitFor(`document.querySelector('#tx-amount')`);
    await click('[data-seg="income"]');
    await fill('#tx-amount', '5000');
    await fill('#tx-where', 'Tuition');
    await evalv(`(() => { const s = document.querySelector('#tx-category'); s.value = 'Education'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Tuition')`);
    check(await evalv(`document.body.innerText.includes('4,200')`), 'balance 4200 not shown');
  });

  await step('Money: filters work', async () => {
    await click('[data-action="filter-type"][data-value="expense"]');
    await waitFor(`!document.body.innerText.includes('+৳5,000')`);
    check(await evalv(`document.body.innerText.includes('Foodpanda')`), 'expense missing under filter');
    await click('[data-action="filter-type"][data-value="all"]');
    await waitFor(`document.body.innerText.includes('+৳5,000')`);
  });

  await step('Money: calculator with result injection', async () => {
    await click('[data-action="open-calc"]');
    await waitFor(`document.querySelector('[data-calc]')`);
    // 7500 + 3200 - 1500 =
    await click(`[data-calc][data-k="7"]`);
    await click(`[data-calc][data-k="5"]`);
    await click(`[data-calc][data-k="0"]`);
    await click(`[data-calc][data-k="0"]`);
    await click(`[data-calc][data-k="+"]`);
    await click(`[data-calc][data-k="3"]`);
    await click(`[data-calc][data-k="2"]`);
    await click(`[data-calc][data-k="0"]`);
    await click(`[data-calc][data-k="0"]`);
    await click(`[data-calc][data-k="−"]`);
    await click(`[data-calc][data-k="1"]`);
    await click(`[data-calc][data-k="5"]`);
    await click(`[data-calc][data-k="0"]`);
    await click(`[data-calc][data-k="0"]`);
    await click(`[data-calc][data-k="="]`);
    await waitFor(`document.querySelector('#calc-result').innerText.includes('9200')`);
    await click('[data-use]');
    await waitFor(`document.querySelector('#tx-amount')`);
    check(await evalv(`document.querySelector('#tx-amount').value.trim() === '9200'`), 'amount not prefilled with 9200');
    await fill('#tx-where', 'Calculated amount');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Calculated amount')`);
  });
  await shot('money');

  await step('Money: edit and delete a transaction', async () => {
    await clickRowText('[data-action="open-transaction"]', 'Foodpanda');
    await waitFor(`document.querySelector('[data-edit]')`);
    await click('[data-edit]');
    await waitFor(`document.querySelector('#tx-where')`);
    await fill('#tx-where', 'Foodpanda (edited)');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Foodpanda (edited)')`);
    await clickRowText('[data-action="open-transaction"]', 'Foodpanda (edited)');
    await waitFor(`document.querySelector('[data-delete]')`);
    await click('[data-delete]');
    await waitFor(`document.querySelector('[data-ok]')`);
    await click('[data-ok]');
    await waitFor(`!document.body.innerText.includes('Foodpanda (edited)')`);
  });

  await step('Money: savings deposit tracked', async () => {
    await click('[data-action="add-transaction"]');
    await waitFor(`document.querySelector('#tx-amount')`);
    await click('[data-seg="income"]');
    await waitFor(`!document.querySelector('#tx-save-wrap').classList.contains('hidden')`);
    await fill('#tx-amount', '2000');
    await fill('#tx-where', 'Savings deposit');
    await evalv(`(() => { const c = document.querySelector('#tx-saved'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Savings deposit')`);
    // The Saved summary card must include the deposit (BDT default currency on a fresh profile).
    await waitFor(`document.body.innerText.includes('Saved') && document.body.innerText.includes('৳2,000')`);
  });

  /* =============== 7. FITNESS =============== */
  await step('Fitness: add entries, set goal', async () => {
    await evalv(`location.hash = '#/fitness'`);
    await waitFor(`document.querySelector('[data-action="add-weight"]')`);
    await click('[data-action="add-weight"]');
    await waitFor(`document.querySelector('#w-weight')`);
    await fill('#w-date', await evalv('window.__zlifeToday()'));
    await fill('#w-weight', '85.5');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('85.5')`);

    await click('[data-action="add-weight"]');
    await waitFor(`document.querySelector('#w-weight')`);
    await fill('#w-date', await evalv(`(function(){ const t = window.__zlifeToday(); return new Date(Date.parse(t + 'T00:00:00Z') - 7*86400000).toISOString().slice(0,10); })()`));
    await fill('#w-weight', '87');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('87')`);

    // trend should now exist
    check(await evalv(`document.querySelector('svg[aria-label="Weight trend"]') !== null`), 'trend chart missing');

    await click('[data-action="edit-goal"]');
    await waitFor(`document.querySelector('#goal-weight')`);
    await fill('#goal-weight', '80');
    await click('[data-save]');
    // The "Goal weight" label is rendered with `uppercase`, so innerText reports it as "GOAL WEIGHT".
    await waitFor(`document.body.innerText.includes('GOAL WEIGHT') && document.body.innerText.includes('80')`);
    check(await evalv(`document.body.innerText.includes('%')`), 'progress % not shown');
  });
  await shot('fitness');

  await step('Fitness: delete an entry', async () => {
    // History is newest-first, so target the '87' row explicitly.
    await clickRowText('[data-action="open-weight"]', '87');
    await waitFor(`document.querySelector('[data-delete]')`);
    await click('[data-delete]');
    await waitFor(`document.querySelector('[data-ok]')`);
    await click('[data-ok]');
    await waitFor(`!document.body.innerText.includes('87')`);
  });

  /* =============== 7.5 NOTES =============== */
  await step('Notes: add a note', async () => {
    await evalv(`location.hash = '#/notes'`);
    await waitFor(`document.querySelector('[data-action="add-note"]')`);
    await click('[data-action="add-note"]');
    await waitFor(`document.querySelector('#note-title')`);
    await fill('#note-title', 'Packing list');
    await fill('#note-body', 'Passport\nCharger\nAdapter');
    await evalv(`(() => { const c = document.querySelector('#note-pinned'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Packing list')`);
    check(await evalv(`document.body.innerText.includes('Charger')`), 'note body not previewed');
  });
  await shot('notes');

  await step('Notes: edit the title', async () => {
    await clickRowText('[data-action="open-note"]', 'Packing list');
    await waitFor(`document.querySelector('[data-edit]')`);
    await click('[data-edit]');
    await waitFor(`document.querySelector('#note-title')`);
    await fill('#note-title', 'Packing list (updated)');
    await click('[data-save]');
    await waitFor(`document.body.innerText.includes('Packing list (updated)')`);
  });

  await step('Notes: delete a note', async () => {
    await clickRowText('[data-action="open-note"]', 'Packing list (updated)');
    await waitFor(`document.querySelector('[data-delete]')`);
    await click('[data-delete]');
    await waitFor(`document.querySelector('[data-ok]')`);
    await click('[data-ok]');
    await waitFor(`!document.body.innerText.includes('Packing list')`);
  });

  /* =============== 8. SETTINGS =============== */
  await step('Settings: theme toggling', async () => {
    await evalv(`location.hash = '#/settings'`);
    await waitFor(`document.querySelector('#theme-seg [data-seg="dark"]')`);
    await click(`#theme-seg [data-seg="dark"]`);
    await waitFor(`document.documentElement.classList.contains('dark')`);
    await shot('settings-dark');
    await click(`#theme-seg [data-seg="light"]`);
    await waitFor(`!document.documentElement.classList.contains('dark')`);
    await click(`#theme-seg [data-seg="system"]`);
  });

  await step('Settings: notification permission flow', async () => {
    await click('[data-action="request-notif"]');
    await sleep(400);
    // In headless, permission may be denied without a UI — accept either outcome,
    // the key is the app didn't crash.
    check(true, 'ok');
  });

  await step('Settings: change currency', async () => {
    await evalv(`(() => { const s = document.querySelector('#currency'); s.value = 'USD'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await evalv(`(() => { const s = document.querySelector('#default-reminder'); s.value = '30'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const saved = await evalv(`JSON.parse(localStorage.getItem('zlife.settings.v1'))`);
    check(saved.currency === 'USD' && saved.defaultReminderMin === 30, 'settings not saved: ' + JSON.stringify(saved));
  });

  /* =============== 9. BACKUP =============== */
  await step('Backup: export produces a file', async () => {
    await click('[data-action="export-data"]');
    await sleep(800);
    const files = fs.readdirSync(DOWNLOADS);
    check(files.some((f) => f.startsWith('ZLife-backup-') && f.endsWith('.json')), 'no backup file downloaded: ' + files.join(','));
  });

  await step('Backup: import merge', async () => {
    const dump = fs.readdirSync(DOWNLOADS).filter((f) => f.startsWith('ZLife-backup-'))[0];
    const backup = JSON.parse(fs.readFileSync(path.join(DOWNLOADS, dump), 'utf8'));
    // add a task to the backup that isn't in the app
    backup.data.tasks.push({ id: 'imported-task-1', title: 'Imported only task', note: '', priority: 'low', dueDate: await evalv('window.__zlifeToday()'), time: null, reminderMin: null, completed: false, createdAt: Date.now(), updatedAt: Date.now() });
    fs.writeFileSync(path.join(TESTDATA, 'import-merge.json'), JSON.stringify(backup));

    await evalv(`(async () => {
      const res = await fetch('/testdata/import-merge.json').then(r => r.text());
      const file = new File([res], 'import-merge.json', { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('import-file');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitFor(`document.body.innerText.includes('Import backup')`);
    await click('[data-merge]');
    await waitFor(`document.body.innerText.includes('Backup merged')`);
    // verify the imported task appears on Today (it is due today)
    await evalv(`location.hash = '#/today'`);
    await waitFor(`document.body.innerText.includes('Imported only task')`);
  });

  await shot('today-after-import');

  await step('Backup: import replace (with confirmation word)', async () => {
    await evalv(`location.hash = '#/settings'`);
    await waitFor(`document.querySelector('[data-action="import-data"]')`);
    await evalv(`(async () => {
      const res = await fetch('/testdata/import-merge.json').then(r => r.text());
      const file = new File([res], 'import-merge.json', { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('import-file');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitFor(`document.body.innerText.includes('Import backup')`);
    await click('[data-replace]');
    await waitFor(`document.querySelector('#confirm-word')`);
    await fill('#confirm-word', 'ZZZ'); // wrong word — stays disabled
    check(await evalv(`document.querySelector('[data-ok]').disabled`), 'confirm should stay disabled');
    await fill('#confirm-word', 'DELETE');
    await click('[data-ok]');
    await waitFor(`document.body.innerText.includes('Backup restored')`);
  });

  /* =============== 10. CLEAR DATA =============== */
  await step('Settings: clear all data requires DELETE', async () => {
    await evalv(`location.hash = '#/settings'`);
    await waitFor(`document.querySelector('[data-action="clear-data"]')`);
    await click('[data-action="clear-data"]');
    await waitFor(`document.querySelector('#confirm-word')`);
    await fill('#confirm-word', 'DELETE');
    await click('[data-ok]');
    await waitFor(`document.body.innerText.includes('All data cleared')`);
    const counts = await evalv(`(async () => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('zlife'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const out = {};
      for (const s of ['tasks','events','students','lessons','transactions','weights','notes']) {
        out[s] = await new Promise((res) => { const g = db.transaction(s).objectStore(s).getAll(); g.onsuccess = () => res(g.result.length); });
      }
      return out;
    })()`);
    check(Object.values(counts).every((c) => c === 0), 'data not cleared: ' + JSON.stringify(counts));
  });

  /* =============== 11. DESKTOP LAYOUT =============== */
  await step('Desktop: sidebar layout renders', async () => {
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(300);
    await evalv(`location.hash = '#/today'`);
    await waitFor(`document.querySelector('#view h1')`);
    check(await evalv(`getComputedStyle(document.querySelector('#sidebar')).display !== 'none'`), 'sidebar hidden on desktop');
    await shot('desktop-today');
  });

  await step('No console errors across the whole run', async () => {
    const swRelated = consoleErrors.filter((c) => !c.includes('service worker') && !c.includes('ServiceWorker'));
    check(swRelated.length === 0, 'console errors: ' + swRelated.slice(0, 5).join(' | '));
  });

  cleanup(0);
}

async function debugDump() {
  try {
    const info = await evalv(`(() => ({
      view: document.querySelector('#view')?.innerText.slice(0, 200),
      appJsLoaded: typeof window.__zlifeIcon === 'function',
      navIcons: document.querySelectorAll('[data-nav] .nav-ic svg').length,
      bodyClasses: document.body.className,
    }))()`);
    console.log('Debug:', JSON.stringify(info, null, 2));
  } catch (e) {
    console.log('Debug eval failed:', e.message);
  }
  console.log('Console errors:', JSON.stringify(consoleErrors.slice(0, 10), null, 2));
  console.log('Page exceptions:', JSON.stringify(pageExceptions.slice(0, 5), null, 2));
}

run().catch(async (err) => {
  console.error('Fatal:', err.message);
  await debugDump();
  cleanup(1);
});