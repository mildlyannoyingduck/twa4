export type TabId = 'timetable' | 'planner' | 'day' | 'papers' | 'countdown';

export type SubjectId = 'biology' | 'physics' | 'chemistry';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type SlotCategory = 'class' | 'self-study';

export type ClassMode = 'online' | 'physical';

export type RevisionStage = 'r1' | 'r2' | 'r3';

export type PaperFormat = 'both' | 'part1' | 'part2';

export type TimePreference = 'any' | 'morning' | 'afternoon' | 'night';

export interface ClassPreset {
  id: string;
  subject: SubjectId;
  title: string;
  teacher: string;
  kind: 'Theory' | 'Paper' | 'Revision';
  defaultMode: ClassMode;
  defaultTravelBeforeMins: number;
  defaultTravelAfterMins: number;
  supportsReviseLoop: boolean;
}

export interface TimetableSlot {
  id: string;
  day: DayOfWeek;
  startTime: string; // HH:MM (24h)
  endTime: string;   // HH:MM (24h)
  category: SlotCategory;
  subject: SubjectId;
  classPresetId?: string;
  title: string;
  subtitle: string;
  autoBlock: boolean;
  mode?: ClassMode;
  travelBeforeMins?: number;
  travelAfterMins?: number;
  linkedTaskId?: string;
  revisionStage?: RevisionStage;
  sourceClassSlotId?: string;
}

export interface DayCompletionLog {
  dateISO: string; // YYYY-MM-DD
  completedSlotIds: string[];
  incompleteSlotIds?: string[];
  loggedMinutesBySlot?: Record<string, number>;
  plannedMinutes: number;
  completedMinutes: number;
  tasksTotal: number;
  tasksDone: number;
}

export interface PaperEntry {
  id: string;
  paperName: string;
  subject: SubjectId;
  classLabel: string;
  date: string; // YYYY-MM-DD
  format: PaperFormat;
  part1Score?: number;
  part1Max?: number;
  part2Score?: number;
  part2Max?: number;
  combinedPercent: number;
  note?: string;
}

export interface StudyChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface StudyTask {
  id: string;
  title: string;
  subject: SubjectId;
  kind: 'task' | 'revision-loop';
  sourceClassSlotId?: string;
  defaultSessionMins: number;
  targetMinutes?: number;
  checklist: StudyChecklistItem[];
  notes: string;
  status: 'active' | 'completed';
  order: number;
  createdAtISO: string;
  autoBlockDefault: boolean;
}

export interface SlotSuggestion {
  id: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMins: number;
  reason: string;
  autoBlock: boolean;
  revisionStage?: RevisionStage;
  note?: string;
}

export interface WeekPerformance {
  weekStartISO: string;
  label: string;
  range: string;
  completionPercent: number;
  tasksDone: number;
  tasksTotal: number;
  hoursCompleted: number;
  hoursPlanned: number;
}

export interface NativePermissionStatus {
  isNativeAndroid: boolean;
  usageAccess: boolean;
  overlayAccess: boolean;
  notifications: boolean;
  batteryUnrestricted: boolean;
}

export interface ActiveLockInfo {
  active: boolean;
  reason: string;
  untilTimeLabel: string;
  untilTimestampMs: number;
  source: 'auto-slot' | 'manual' | 'none';
}
