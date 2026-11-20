import { DayCompletionLog, PaperEntry, StudyTask, TimetableSlot } from '../types';

const KEYS = {
  slots: 'thisweek_slots_v1',
  papers: 'thisweek_papers_v1',
  dailyLogs: 'thisweek_daily_logs_v1',
  tasks: 'thisweek_planner_tasks_v2',
  theme: 'thisweek_theme_v1',
  manualLockUntil: 'thisweek_manual_lock_until_v1',
  notifiedSlots: 'thisweek_notified_slots_v1',
  glassTransparency: 'thisweek_glass_transparency_v1',
  calmBackdrop: 'thisweek_calm_backdrop_v1',
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadSlots(): TimetableSlot[] {
  return safeRead<TimetableSlot[]>(KEYS.slots, []);
}

export function saveSlots(slots: TimetableSlot[]): void {
  safeWrite(KEYS.slots, slots);
}

export function loadPapers(): PaperEntry[] {
  return safeRead<PaperEntry[]>(KEYS.papers, []);
}

export function savePapers(papers: PaperEntry[]): void {
  safeWrite(KEYS.papers, papers);
}

export function loadDailyLogs(): Record<string, DayCompletionLog> {
  return safeRead<Record<string, DayCompletionLog>>(KEYS.dailyLogs, {});
}

export function saveDailyLogs(logs: Record<string, DayCompletionLog>): void {
  safeWrite(KEYS.dailyLogs, logs);
}

export function loadTasks(): StudyTask[] {
  return safeRead<StudyTask[]>(KEYS.tasks, []);
}

export function saveTasks(tasks: StudyTask[]): void {
  safeWrite(KEYS.tasks, tasks);
}

export function loadThemeDark(): boolean {
  return safeRead<boolean>(KEYS.theme, true);
}

export function saveThemeDark(isDark: boolean): void {
  safeWrite(KEYS.theme, isDark);
}

export function loadManualLockUntil(): number {
  return safeRead<number>(KEYS.manualLockUntil, 0);
}

export function saveManualLockUntil(timestampMs: number): void {
  safeWrite(KEYS.manualLockUntil, timestampMs);
}

export function loadNotifiedKeys(): Record<string, boolean> {
  return safeRead<Record<string, boolean>>(KEYS.notifiedSlots, {});
}

export function saveNotifiedKeys(keys: Record<string, boolean>): void {
  safeWrite(KEYS.notifiedSlots, keys);
}

export function loadGlassTransparency(): number {
  const val = safeRead<number>(KEYS.glassTransparency, 72);
  return Math.max(0, Math.min(100, Number.isFinite(val) ? val : 72));
}

export function saveGlassTransparency(val: number): void {
  safeWrite(KEYS.glassTransparency, Math.max(0, Math.min(100, Math.round(val))));
}

export function loadCalmBackdrop(): boolean {
  return safeRead<boolean>(KEYS.calmBackdrop, true);
}

export function saveCalmBackdrop(calm: boolean): void {
  safeWrite(KEYS.calmBackdrop, calm);
}
