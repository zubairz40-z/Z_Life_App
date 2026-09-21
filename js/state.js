/* Central data store. Loads everything from IndexedDB into memory at startup,
   exposes getters + mutation helpers, and notifies subscribers (the router)
   so the current view re-renders after any change. */

import * as db from './db.js';
import { uid } from './utils.js';

let data = {
  tasks: [],
  events: [],
  students: [],
  lessons: [],
  transactions: [],
  weights: [],
  notes: [],
};

const listeners = new Set();

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export async function loadAll() {
  const [tasks, events, students, lessons, transactions, weights, notes] = await Promise.all([
    db.dbGetAll(db.STORES.tasks),
    db.dbGetAll(db.STORES.events),
    db.dbGetAll(db.STORES.students),
    db.dbGetAll(db.STORES.lessons),
    db.dbGetAll(db.STORES.transactions),
    db.dbGetAll(db.STORES.weights),
    db.dbGetAll(db.STORES.notes),
  ]);
  data = { tasks, events, students, lessons, transactions, weights, notes };
  return data;
}

export function getData() {
  return data;
}

/* ---------------- Generic helpers ---------------- */

async function upsert(store, obj) {
  obj.updatedAt = Date.now();
  const id = await db.dbPut(store, obj);
  obj.id = obj.id || id;
  return obj;
}

async function remove(store, id, cacheKey) {
  await db.dbDelete(store, id);
  data[cacheKey] = data[cacheKey].filter((x) => x.id !== id);
  emitChange();
}

/* ---------------- Tasks ---------------- */

export async function saveTask(task) {
  const existing = data.tasks.find((t) => t.id === task.id);
  if (existing) {
    Object.assign(existing, task);
    await db.dbPut(db.STORES.tasks, existing);
  } else {
    const fresh = { ...task, id: task.id || uid(), createdAt: Date.now(), updatedAt: Date.now() };
    data.tasks.push(fresh);
    await db.dbPut(db.STORES.tasks, fresh);
  }
  emitChange();
}

export async function toggleTask(id) {
  const t = data.tasks.find((x) => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? Date.now() : null;
  t.updatedAt = Date.now();
  await db.dbPut(db.STORES.tasks, t);
  emitChange();
}

export function deleteTask(id) {
  return remove(db.STORES.tasks, id, 'tasks');
}

/* ---------------- Events ---------------- */

export async function saveEvent(ev) {
  const existing = data.events.find((x) => x.id === ev.id);
  if (existing) {
    Object.assign(existing, ev);
    await db.dbPut(db.STORES.events, existing);
  } else {
    const fresh = { ...ev, id: ev.id || uid(), createdAt: Date.now(), updatedAt: Date.now() };
    data.events.push(fresh);
    await db.dbPut(db.STORES.events, fresh);
  }
  emitChange();
}

export function deleteEvent(id) {
  return remove(db.STORES.events, id, 'events');
}

/* ---------------- Students ---------------- */

export async function saveStudent(st) {
  const existing = data.students.find((x) => x.id === st.id);
  if (existing) {
    Object.assign(existing, st);
    await db.dbPut(db.STORES.students, existing);
  } else {
    const fresh = { ...st, id: st.id || uid(), createdAt: Date.now(), updatedAt: Date.now() };
    data.students.push(fresh);
    await db.dbPut(db.STORES.students, fresh);
  }
  emitChange();
}

export async function deleteStudent(id) {
  await db.dbDelete(db.STORES.students, id);
  data.students = data.students.filter((x) => x.id !== id);
  // remove that student's lessons too
  const orphan = data.lessons.filter((l) => l.studentId === id);
  if (orphan.length) {
    data.lessons = data.lessons.filter((l) => l.studentId !== id);
    await db.dbBulkPut(db.STORES.lessons, []);
    for (const l of orphan) await db.dbDelete(db.STORES.lessons, l.id);
  }
  emitChange();
}

/* ---------------- Lessons ---------------- */

export async function saveLesson(lesson) {
  const existing = data.lessons.find((x) => x.id === lesson.id);
  if (existing) {
    Object.assign(existing, lesson);
    await db.dbPut(db.STORES.lessons, existing);
  } else {
    const fresh = { ...lesson, id: lesson.id || uid(), createdAt: Date.now(), updatedAt: Date.now() };
    data.lessons.push(fresh);
    await db.dbPut(db.STORES.lessons, fresh);
  }
  emitChange();
}

export async function toggleLesson(id) {
  const l = data.lessons.find((x) => x.id === id);
  if (!l) return;
  l.completed = !l.completed;
  l.completedAt = l.completed ? Date.now() : null;
  l.updatedAt = Date.now();
  await db.dbPut(db.STORES.lessons, l);
  emitChange();
}

export function deleteLesson(id) {
  return remove(db.STORES.lessons, id, 'lessons');
}

/* ---------------- Transactions ---------------- */

export async function saveTransaction(tx) {
  const existing = data.transactions.find((x) => x.id === tx.id);
  if (existing) {
    Object.assign(existing, tx);
    await db.dbPut(db.STORES.transactions, existing);
  } else {
    const fresh = { ...tx, id: tx.id || uid(), createdAt: Date.now(), updatedAt: Date.now() };
    data.transactions.push(fresh);
    await db.dbPut(db.STORES.transactions, fresh);
  }
  emitChange();
}

export function deleteTransaction(id) {
  return remove(db.STORES.transactions, id, 'transactions');
}

/* ---------------- Weights ---------------- */

export async function saveWeight(w) {
  const existing = data.weights.find((x) => x.id === w.id);
  if (existing) {
    Object.assign(existing, w);
    await db.dbPut(db.STORES.weights, existing);
  } else {
    const fresh = { ...w, id: w.id || uid(), createdAt: Date.now(), updatedAt: Date.now() };
    data.weights.push(fresh);
    await db.dbPut(db.STORES.weights, fresh);
  }
  emitChange();
}

export function deleteWeight(id) {
  return remove(db.STORES.weights, id, 'weights');
}

/* ---------------- Notes ---------------- */

export async function saveNote(note) {
  const existing = data.notes.find((x) => x.id === note.id);
  if (existing) {
    Object.assign(existing, note);
    await db.dbPut(db.STORES.notes, existing);
  } else {
    const fresh = { ...note, id: note.id || uid(), pinned: !!note.pinned, createdAt: Date.now(), updatedAt: Date.now() };
    data.notes.push(fresh);
    await db.dbPut(db.STORES.notes, fresh);
  }
  emitChange();
}

export function deleteNote(id) {
  return remove(db.STORES.notes, id, 'notes');
}

/* ---------------- Bulk operations (import/clear) ---------------- */

export function dbClearAll() {
  return db.dbClearAll();
}

export function dbExport() {
  return db.dbExport();
}

export function dbImportAll(d) {
  return db.dbImportAll(d);
}

export function dbImportMerge(d) {
  return db.dbImportMerge(d);
}