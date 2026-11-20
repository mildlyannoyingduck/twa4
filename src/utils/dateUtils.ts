import { DayOfWeek } from '../types';

const JS_DAY_TO_DOW: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function getDayOfWeek(date: Date = new Date()): DayOfWeek {
  return JS_DAY_TO_DOW[date.getDay()];
}

export function formatFullDateLabel(date: Date): string {
  return `${DAYS_FULL[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

export function getMondayOfWeek(date: Date = new Date()): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay(); // 0 Sun .. 6 Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diffToMon);
  return copy;
}

export interface WeekDayInfo {
  day: DayOfWeek;
  dateISO: string;
  dateNum: string;
  fullLabel: string;
  isToday: boolean;
}

export function getCurrentWeekDays(now: Date = new Date()): WeekDayInfo[] {
  const monday = getMondayOfWeek(now);
  const todayISO = toISODate(now);
  const order: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return order.map((day, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const iso = toISODate(d);
    return {
      day,
      dateISO: iso,
      dateNum: String(d.getDate()),
      fullLabel: formatFullDateLabel(d),
      isToday: iso === todayISO,
    };
  });
}

export function formatWeekRange(weekStartISO: string): string {
  const [y, m, d] = weekStartISO.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
}
