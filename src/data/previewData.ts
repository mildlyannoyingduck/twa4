import { ClassPreset, DayOfWeek, SubjectId } from '../types';

export const SUBJECT_META: Record<
  SubjectId,
  {
    name: string;
    short: string;
    text: string;
    bgSoft: string;
    borderSoft: string;
    bar: string;
    strokeHex: string;
    strokeDarkHex: string;
    accentHex: string;
  }
> = {
  biology: {
    name: 'Biology',
    short: 'Bio',
    text: 'text-emerald-700 dark:text-emerald-300',
    bgSoft: 'bg-emerald-500/10 dark:bg-emerald-400/12',
    borderSoft: 'border-emerald-500/30 dark:border-emerald-400/30',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    strokeHex: '#059669',
    strokeDarkHex: '#34D399',
    accentHex: '#10B981',
  },
  physics: {
    name: 'Physics',
    short: 'Phy',
    text: 'text-orange-700 dark:text-orange-300',
    bgSoft: 'bg-orange-500/10 dark:bg-orange-400/12',
    borderSoft: 'border-orange-500/30 dark:border-orange-400/30',
    bar: 'bg-orange-500 dark:bg-orange-400',
    strokeHex: '#EA580C',
    strokeDarkHex: '#FB923C',
    accentHex: '#F97316',
  },
  chemistry: {
    name: 'Chemistry',
    short: 'Chem',
    text: 'text-blue-700 dark:text-cyan-300',
    bgSoft: 'bg-blue-500/10 dark:bg-cyan-400/12',
    borderSoft: 'border-blue-500/30 dark:border-cyan-400/30',
    bar: 'bg-blue-600 dark:bg-cyan-400',
    strokeHex: '#2563EB',
    strokeDarkHex: '#38BDF8',
    accentHex: '#3B82F6',
  },
};

export const CLASS_PRESETS: ClassPreset[] = [
  {
    id: 'bio-theory',
    subject: 'biology',
    title: 'Biology Theory',
    teacher: 'Sashanka Dhanujaya · Online',
    kind: 'Theory',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
  {
    id: 'bio-paper-write',
    subject: 'biology',
    title: 'Biology Paper Writing',
    teacher: 'Sashanka Dhanujaya · Physical',
    kind: 'Paper',
    defaultMode: 'physical',
    defaultTravelBeforeMins: 120,
    defaultTravelAfterMins: 120,
    supportsReviseLoop: false,
  },
  {
    id: 'bio-paper-disc',
    subject: 'biology',
    title: 'Biology Paper Discussion',
    teacher: 'Sashanka Dhanujaya · Online',
    kind: 'Paper',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
  {
    id: 'phy-theory-rev',
    subject: 'physics',
    title: 'Physics Theory & Revision',
    teacher: 'Samitha Rathnayake · Online',
    kind: 'Revision',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
  {
    id: 'phy-paper',
    subject: 'physics',
    title: 'Physics Paper & Discussion',
    teacher: 'Sujith Liyanage · Physical',
    kind: 'Paper',
    defaultMode: 'physical',
    defaultTravelBeforeMins: 120,
    defaultTravelAfterMins: 120,
    supportsReviseLoop: true,
  },
  {
    id: 'chem-theory',
    subject: 'chemistry',
    title: 'Chemistry Theory',
    teacher: 'Amila Dasanayake · Online',
    kind: 'Theory',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
  {
    id: 'chem-paper-write',
    subject: 'chemistry',
    title: 'Chemistry Paper Writing',
    teacher: 'Amila Dasanayake · Physical',
    kind: 'Paper',
    defaultMode: 'physical',
    defaultTravelBeforeMins: 120,
    defaultTravelAfterMins: 120,
    supportsReviseLoop: false,
  },
  {
    id: 'chem-paper-disc',
    subject: 'chemistry',
    title: 'Chemistry Paper Discussion',
    teacher: 'Amila Dasanayake · Online',
    kind: 'Paper',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
];

export const LEGACY_PRESET_MAP: Record<string, string> = {
  'bio-paper': 'bio-paper-write',
  'chem-paper': 'chem-paper-write',
};

export const DAYS_ORDER: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ALLOWED_APPS_ON_A07 = [
  { name: 'Phone', packageHint: 'com.samsung.android.dialer' },
  { name: 'Contacts', packageHint: 'com.samsung.android.app.contacts' },
  { name: 'Calculator', packageHint: 'com.sec.android.app.popupcalculator' },
  { name: 'Settings', packageHint: 'com.android.settings' },
  { name: 'This Week', packageHint: 'com.risinu.thisweek' },
];
