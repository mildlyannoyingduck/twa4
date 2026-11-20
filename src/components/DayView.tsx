import { ArrowRight, CalendarPlus, Check, Clock, Lock, RotateCcw, X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { SUBJECT_META } from '../data/previewData';
import {
  ActiveLockInfo,
  DayCompletionLog,
  StudyTask,
  SubjectId,
  TimetableSlot,
  WeekPerformance,
} from '../types';
import {
  formatWeekRange,
  getCurrentWeekDays,
  getMondayOfWeek,
  getTodayISO,
  toISODate,
} from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import { formatDuration, formatTime12h, getDurationMinutes, toMinutes } from '../utils/timeUtils';
import { CrystalSheet } from './FluidControls';

interface DayViewProps {
  slots: TimetableSlot[];
  tasks: StudyTask[];
  dailyLogs: Record<string, DayCompletionLog>;
  activeLock: ActiveLockInfo;
  onToggleSlotComplete: (dateISO: string, slotId: string) => void;
  onMarkSlotIncomplete: (dateISO: string, slotId: string, partialMinutes: number) => void;
  onOpenBlockerPreview: () => void;
  onGoToTimetable: () => void;
  onOpenPlannerForTask?: (taskId: string) => void;
}

const SUBJECT_GLASS_ROW: Record<SubjectId, string> = {
  biology: 'ios-glass-subj-bio',
  physics: 'ios-glass-subj-phy',
  chemistry: 'ios-glass-subj-chem',
};

const SUBJECT_CHECK_STYLE: Record<SubjectId, { checked: string; unchecked: string; dot: string }> = {
  biology: {
    checked: 'border-emerald-500 bg-emerald-500 text-white shadow-[0_0_14px_rgba(16,185,129,0.45)]',
    unchecked: 'border-emerald-600/55 bg-emerald-500/10 dark:border-emerald-400/55',
    dot: 'bg-emerald-500',
  },
  physics: {
    checked: 'border-orange-500 bg-orange-500 text-white shadow-[0_0_14px_rgba(249,115,22,0.45)]',
    unchecked: 'border-orange-600/55 bg-orange-500/10 dark:border-orange-400/55',
    dot: 'bg-orange-500',
  },
  chemistry: {
    checked: 'border-blue-500 bg-blue-500 text-white shadow-[0_0_14px_rgba(59,130,246,0.45)]',
    unchecked: 'border-blue-600/55 bg-blue-500/10 dark:border-sky-400/55',
    dot: 'bg-blue-500 dark:bg-cyan-400',
  },
};

type DayChapter = 'Morning' | 'Afternoon' | 'Night';

function getDayChapter(hhmm: string): DayChapter {
  const m = toMinutes(hhmm);
  if (m < 720) return 'Morning';
  if (m < 1080) return 'Afternoon';
  return 'Night';
}

export const DayView = memo(function DayView({
  slots,
  tasks,
  dailyLogs,
  activeLock,
  onToggleSlotComplete,
  onMarkSlotIncomplete,
  onOpenBlockerPreview,
  onGoToTimetable,
  onOpenPlannerForTask,
}: DayViewProps) {
  const [section, setSection] = useState<'today' | 'history'>('today');
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);

  const weekDays = useMemo(() => getCurrentWeekDays(new Date()), []);
  const todayISO = useMemo(() => getTodayISO(new Date()), []);
  const [selectedDateISO, setSelectedDateISO] = useState<string>(todayISO);
  const [partialModalSlot, setPartialModalSlot] = useState<TimetableSlot | null>(null);
  const [partialMinsInput, setPartialMinsInput] = useState<number>(30);

  const selectedDayInfo =
    weekDays.find((d) => d.dateISO === selectedDateISO) ??
    weekDays.find((d) => d.isToday) ??
    weekDays[0];

  const daySlots = useMemo(
    () =>
      slots
        .filter((s) => s.day === selectedDayInfo.day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, selectedDayInfo.day],
  );

  const dayLog = dailyLogs[selectedDayInfo.dateISO];
  const completedIds = dayLog?.completedSlotIds ?? [];
  const incompleteIds = dayLog?.incompleteSlotIds ?? [];
  const loggedBySlot = dayLog?.loggedMinutesBySlot ?? {};

  const totalTasks = daySlots.length;
  const doneTasks = daySlots.filter((s) => completedIds.includes(s.id)).length;

  const totalMinutes = daySlots.reduce(
    (acc, s) => acc + getDurationMinutes(s.startTime, s.endTime),
    0,
  );
  const doneMinutes = daySlots.reduce((acc, s) => {
    if (completedIds.includes(s.id)) {
      return acc + getDurationMinutes(s.startTime, s.endTime);
    }
    if (incompleteIds.includes(s.id) && loggedBySlot[s.id]) {
      return acc + loggedBySlot[s.id];
    }
    return acc;
  }, 0);

  const completionPercent =
    totalMinutes > 0 ? Math.min(100, Math.round((doneMinutes / totalMinutes) * 100)) : 0;

  // Per-subject breakdown for the day
  const subjectBreakdown = useMemo(() => {
    return (['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
      const subSlots = daySlots.filter((s) => s.subject === subj);
      const planned = subSlots.reduce(
        (acc, s) => acc + getDurationMinutes(s.startTime, s.endTime),
        0,
      );
      const done = subSlots.reduce((acc, s) => {
        if (completedIds.includes(s.id)) {
          return acc + getDurationMinutes(s.startTime, s.endTime);
        }
        if (incompleteIds.includes(s.id) && loggedBySlot[s.id]) {
          return acc + loggedBySlot[s.id];
        }
        return acc;
      }, 0);
      return {
        subj,
        planned,
        done,
        pct: planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0,
      };
    });
  }, [daySlots, completedIds, incompleteIds, loggedBySlot]);

  const now = new Date();
  const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();

  // Live Active or Next Spotlight Slot for Selected Day
  const spotlight = useMemo(() => {
    if (!selectedDayInfo.isToday) {
      const firstOpen = daySlots.find((s) => !completedIds.includes(s.id));
      return firstOpen
        ? { kind: 'planned' as const, slot: firstOpen, elapsedPct: 0, minsRemaining: 0 }
        : null;
    }

    const activeNow = daySlots.find((s) => {
      const start = toMinutes(s.startTime);
      const end = s.endTime === '00:00' && start > 0 ? 1440 : toMinutes(s.endTime);
      return currentMinuteOfDay >= start && currentMinuteOfDay < end;
    });

    if (activeNow) {
      const start = toMinutes(activeNow.startTime);
      const end = activeNow.endTime === '00:00' && start > 0 ? 1440 : toMinutes(activeNow.endTime);
      const total = Math.max(1, end - start);
      const elapsed = currentMinuteOfDay - start;
      return {
        kind: 'live' as const,
        slot: activeNow,
        elapsedPct: Math.min(100, Math.max(2, Math.round((elapsed / total) * 100))),
        minsRemaining: end - currentMinuteOfDay,
      };
    }

    const nextUp = daySlots.find((s) => toMinutes(s.startTime) > currentMinuteOfDay);
    if (nextUp) {
      return {
        kind: 'next' as const,
        slot: nextUp,
        elapsedPct: 0,
        minsRemaining: toMinutes(nextUp.startTime) - currentMinuteOfDay,
      };
    }
    return null;
  }, [daySlots, selectedDayInfo.isToday, currentMinuteOfDay, completedIds]);

  const groupedChapters = useMemo(() => {
    const order: DayChapter[] = ['Morning', 'Afternoon', 'Night'];
    return order
      .map((chapter) => ({
        chapter,
        items: daySlots.filter((s) => getDayChapter(s.startTime) === chapter),
      }))
      .filter((g) => g.items.length > 0);
  }, [daySlots]);

  const pastWeeks: WeekPerformance[] = useMemo(() => {
    const currentMondayISO = toISODate(getMondayOfWeek(new Date()));
    const weekBuckets: Record<
      string,
      { plannedMins: number; doneMins: number; tasksDone: number; tasksTotal: number }
    > = {};

    for (const [dateISO, log] of Object.entries(dailyLogs)) {
      const [y, m, d] = dateISO.split('-').map(Number);
      const monISO = toISODate(getMondayOfWeek(new Date(y, m - 1, d)));
      if (monISO >= currentMondayISO) continue;
      if (!weekBuckets[monISO]) {
        weekBuckets[monISO] = { plannedMins: 0, doneMins: 0, tasksDone: 0, tasksTotal: 0 };
      }
      weekBuckets[monISO].plannedMins += log.plannedMinutes;
      weekBuckets[monISO].doneMins += log.completedMinutes;
      weekBuckets[monISO].tasksDone += log.tasksDone;
      weekBuckets[monISO].tasksTotal += log.tasksTotal;
    }

    return Object.entries(weekBuckets)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 8)
      .map(([weekStartISO, stats], idx) => {
        const pct =
          stats.plannedMins > 0
            ? Math.round((stats.doneMins / stats.plannedMins) * 100)
            : 0;
        return {
          weekStartISO,
          label: idx === 0 ? 'Last Week' : `${idx + 1} Weeks Ago`,
          range: formatWeekRange(weekStartISO),
          completionPercent: pct,
          tasksDone: stats.tasksDone,
          tasksTotal: stats.tasksTotal,
          hoursCompleted: Number((stats.doneMins / 60).toFixed(1)),
          hoursPlanned: Number((stats.plannedMins / 60).toFixed(1)),
        };
      });
  }, [dailyLogs]);

  const ringRadius = 33;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (completionPercent / 100) * ringCircumference;

  const triggerCompleteToggle = (slotId: string, currentlyDone: boolean) => {
    if (!currentlyDone) {
      haptics.success();
      setJustCompletedId(slotId);
      window.setTimeout(() => {
        setJustCompletedId((cur) => (cur === slotId ? null : cur));
      }, 760);
    } else {
      haptics.tick();
    }
    onToggleSlotComplete(selectedDayInfo.dateISO, slotId);
  };

  const openPartialDialog = (slot: TimetableSlot) => {
    haptics.tap();
    const full = getDurationMinutes(slot.startTime, slot.endTime);
    const existingLogged = loggedBySlot[slot.id] ?? Math.max(15, Math.round(full / 2));
    setPartialMinsInput(existingLogged);
    setPartialModalSlot(slot);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#07142B] dark:text-white">
            {section === 'today' ? (selectedDayInfo.isToday ? 'Today' : selectedDayInfo.day) : 'Past Weeks'}
          </h1>
          <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
            {section === 'today' ? selectedDayInfo.fullLabel : 'Weekly completion history'}
          </p>
        </div>

        <div className="ios-glass relative grid grid-cols-2 items-center rounded-full p-1">
          {(['today', 'history'] as const).map((tab) => {
            const active = section === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setSection(tab);
                }}
                className={`min-h-[36px] rounded-full px-4 text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] dark:bg-blue-500'
                    : 'text-[#0B234A]/75 dark:text-sky-200/80'
                }`}
              >
                {tab === 'today' ? 'Day Command' : 'Past Weeks'}
              </button>
            );
          })}
        </div>
      </div>

      {section === 'today' ? (
        <div className="mt-4 space-y-4">
            {/* Bento Command Row */}
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
              {/* Spotlight Active / Next Session Bento */}
              <section className="ios-glass-strong relative flex flex-col justify-between overflow-hidden rounded-[34px] p-5 sm:p-6 lg:col-span-7">
                {spotlight ? (() => {
                  const s = spotlight.slot;
                  const subj = SUBJECT_META[s.subject];
                  const isSpotDone = completedIds.includes(s.id);
                  const dur = getDurationMinutes(s.startTime, s.endTime);

                  return (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`font-bold ${subj.text}`}>{subj.name}</span>
                            <span className="opacity-45">·</span>
                            <span className="font-semibold text-blue-700 dark:text-cyan-300">
                              {spotlight.kind === 'live'
                                ? `Happening Now · ${formatDuration(spotlight.minsRemaining)} left`
                                : spotlight.kind === 'next'
                                  ? `Up Next in ${formatDuration(spotlight.minsRemaining)}`
                                  : `Focus Window · ${selectedDayInfo.day}`}
                            </span>
                          </div>
                          <h2 className="mt-1.5 truncate text-xl font-bold tracking-tight text-[#07142B] dark:text-white sm:text-2xl">
                            {s.title}
                          </h2>
                          <p className="mt-0.5 truncate text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                            {s.subtitle} · {formatTime12h(s.startTime)} – {formatTime12h(s.endTime)} ({formatDuration(dur)})
                            {s.mode === 'physical' && ' · Commute unlocked'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            haptics.tap();
                            onOpenBlockerPreview();
                          }}
                          className="ios-glass inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-[#07142B] transition-transform duration-100 active:scale-95 dark:text-sky-50"
                        >
                          <Lock
                            className={`h-3 w-3 ${
                              activeLock.active ? 'text-emerald-500' : 'text-blue-600 dark:text-sky-300'
                            }`}
                          />
                          <span>{activeLock.active ? 'Lock On' : 'Shield'}</span>
                        </button>
                      </div>

                      {spotlight.kind === 'live' && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[11px] text-[#0B234A]/75 dark:text-sky-200/80">
                            <span>Session progress</span>
                            <span className="tabular-nums font-semibold">{spotlight.elapsedPct}%</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                            <div
                              style={{ width: `${spotlight.elapsedPct}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 transition-[width] duration-500 ease-out"
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => triggerCompleteToggle(s.id, isSpotDone)}
                          className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold shadow-md transition-transform duration-100 active:scale-95 ${
                            isSpotDone
                              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                              : 'bg-blue-600 text-white shadow-blue-600/25 dark:bg-blue-500'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{isSpotDone ? 'Completed' : 'Mark Complete'}</span>
                        </button>

                        {!isSpotDone && (
                          <button
                            type="button"
                            onClick={() => openPartialDialog(s)}
                            className="ios-glass-tile inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-[#07142B] transition-transform duration-100 active:scale-95 dark:text-white"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-orange-600 dark:text-orange-300" />
                            <span>Log Partial</span>
                          </button>
                        )}

                        {s.linkedTaskId && onOpenPlannerForTask && (
                          <button
                            type="button"
                            onClick={() => {
                              haptics.tap();
                              onOpenPlannerForTask(s.linkedTaskId!);
                            }}
                            className="ios-glass-tile inline-flex min-h-[42px] items-center gap-1 rounded-full px-4 text-xs font-semibold text-blue-700 transition-transform duration-100 active:scale-95 dark:text-cyan-300"
                          >
                            <span>Task Notes</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  );
                })() : (
                  <div className="flex flex-1 flex-col justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        All Clear · {selectedDayInfo.day}
                      </p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight text-[#07142B] dark:text-white">
                        {daySlots.length > 0
                          ? `You finished all ${daySlots.length} sessions`
                          : `Open day on ${selectedDayInfo.day}`}
                      </h2>
                      <p className="mt-1 text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                        {daySlots.length > 0
                          ? `${formatDuration(doneMinutes)} of study locked in today.`
                          : 'Add a class or pull a study task from Planner into an open gap.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onGoToTimetable}
                        className="ios-glass-tile inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-[#07142B] transition-transform duration-100 active:scale-95 dark:text-white"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                        <span>Open Timetable</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          haptics.tap();
                          onOpenBlockerPreview();
                        }}
                        className="ios-glass-tile inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-[#07142B] transition-transform duration-100 active:scale-95 dark:text-white"
                      >
                        <Lock className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
                        <span>Focus Shield</span>
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Progress Ring + Subject Breakdown Bento */}
              <section className="ios-glass flex flex-col justify-between gap-4 rounded-[34px] p-5 sm:p-6 lg:col-span-5">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                    <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" aria-hidden="true">
                      <defs>
                        <linearGradient id="dayRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#22D3EE" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="38"
                        cy="38"
                        r={ringRadius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-blue-500/15 dark:text-sky-300/15"
                      />
                      <circle
                        cx="38"
                        cy="38"
                        r={ringRadius}
                        fill="none"
                        stroke="url(#dayRingGrad)"
                        strokeWidth="6.5"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        className="transition-[stroke-dashoffset] duration-300 ease-out"
                      />
                    </svg>
                    <span className="tabular-nums absolute text-base font-bold text-[#07142B] dark:text-white">
                      {completionPercent}%
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="tabular-nums text-lg font-bold tracking-tight text-[#07142B] dark:text-white">
                      {doneTasks}/{totalTasks} sessions
                    </p>
                    <p className="tabular-nums mt-0.5 text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                      {formatDuration(doneMinutes)} / {formatDuration(totalMinutes)} studied
                    </p>
                  </div>
                </div>

                {/* Subject Fill Telemetry */}
                <div className="space-y-2 border-t border-white/35 pt-3 dark:border-sky-300/15">
                  {subjectBreakdown.map((item) => {
                    const meta = SUBJECT_META[item.subj];
                    return (
                      <div key={item.subj} className="flex items-center gap-2.5 text-[11px]">
                        <span className={`w-10 shrink-0 font-semibold ${meta.text}`}>
                          {meta.short}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                          <div
                            style={{ width: `${item.pct}%` }}
                            className={`h-full rounded-full transition-[width] duration-300 ease-out ${meta.bar}`}
                          />
                        </div>
                        <span className="tabular-nums w-16 text-right text-[#0B234A]/75 dark:text-sky-100/80">
                          {item.planned > 0
                            ? `${formatDuration(item.done)}/${formatDuration(item.planned)}`
                            : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Focus Ribbon with Individual Day Micro-Arcs */}
            <div className="ios-glass-strong grid grid-cols-7 gap-1 rounded-full p-1.5">
              {weekDays.map((item) => {
                const active = item.dateISO === selectedDayInfo.dateISO;
                const dSlots = slots.filter((s) => s.day === item.day);
                const dDone = (dailyLogs[item.dateISO]?.completedSlotIds ?? []).length;
                const dRatio = dSlots.length > 0 ? Math.min(1, dDone / dSlots.length) : 0;
                const miniR = 13;
                const miniC = 2 * Math.PI * miniR;

                return (
                  <button
                    key={item.dateISO}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setSelectedDateISO(item.dateISO);
                    }}
                    className={`flex min-h-[58px] flex-col items-center justify-center rounded-full text-xs transition-colors duration-150 active:scale-95 ${
                      active
                        ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[0_6px_18px_rgba(37,99,235,0.38),inset_0_1px_0_rgba(255,255,255,0.45)] dark:from-sky-400 dark:to-blue-600'
                        : 'text-[#07142B] dark:text-sky-100'
                    }`}
                  >
                    <span className="text-[9.5px] opacity-80">{item.day}</span>
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center">
                      {dSlots.length > 0 && (
                        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                          <circle
                            cx="16"
                            cy="16"
                            r={miniR}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={active ? 'text-white/25' : 'text-blue-500/20 dark:text-sky-300/20'}
                          />
                          {dRatio > 0 && (
                            <circle
                              cx="16"
                              cy="16"
                              r={miniR}
                              fill="none"
                              stroke={active ? '#FFFFFF' : '#10B981'}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeDasharray={miniC}
                              strokeDashoffset={miniC * (1 - dRatio)}
                            />
                          )}
                        </svg>
                      )}
                      <span className="tabular-nums text-[11px] font-bold">{item.dateNum}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {daySlots.length === 0 ? (
              <section className="ios-glass flex flex-col items-center justify-center rounded-[32px] px-6 py-10 text-center">
                <CalendarPlus className="h-7 w-7 text-blue-600 dark:text-sky-300" />
                <p className="mt-3 text-sm font-semibold text-[#07142B] dark:text-white">
                  Nothing scheduled for {selectedDayInfo.day}
                </p>
                <p className="mt-1 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                  Add classes in Timetable or suggest slots from Planner.
                </p>
                <button
                  type="button"
                  onClick={onGoToTimetable}
                  className="mt-4 min-h-[44px] rounded-full bg-blue-600 px-5 text-xs font-semibold text-white shadow-md shadow-blue-600/25 transition-transform duration-100 active:scale-95 dark:bg-blue-500"
                >
                  Open Timetable
                </button>
              </section>
            ) : (
              <div key={selectedDayInfo.dateISO} className="space-y-5">
                {groupedChapters.map((group) => (
                  <section key={group.chapter}>
                    <div className="mb-2.5 flex items-center gap-3 px-1">
                      <span className="text-xs font-semibold tracking-tight text-[#0B234A]/75 dark:text-sky-200/80">
                        {group.chapter}
                      </span>
                      <div className="h-[1px] flex-1 bg-white/45 dark:bg-sky-300/18" />
                      <span className="tabular-nums text-[11px] text-[#0B234A]/60 dark:text-sky-200/65">
                        {group.items.length} {group.items.length === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>

                    <div className="relative space-y-3 pl-5">
                      <div
                        aria-hidden="true"
                        className="absolute bottom-5 left-[9px] top-5 w-[1.5px] bg-gradient-to-b from-blue-400/55 via-cyan-400/45 to-blue-400/15 dark:from-sky-300/45 dark:via-cyan-400/40 dark:to-blue-500/15"
                      />

                      {group.items.map((slot) => {
                        const subj = SUBJECT_META[slot.subject];
                        const isDone = completedIds.includes(slot.id);
                        const isIncomplete = !isDone && incompleteIds.includes(slot.id);
                        const isSweeping = justCompletedId === slot.id;
                        const mins = getDurationMinutes(slot.startTime, slot.endTime);
                        const partialLogged = loggedBySlot[slot.id];
                        const checkStyle = SUBJECT_CHECK_STYLE[slot.subject];
                        const startMin = toMinutes(slot.startTime);
                        const endMin =
                          slot.endTime === '00:00' && startMin > 0 ? 1440 : toMinutes(slot.endTime);
                        const isLiveNow =
                          selectedDayInfo.isToday &&
                          currentMinuteOfDay >= startMin &&
                          currentMinuteOfDay < endMin;

                        const linkedTask = slot.linkedTaskId
                          ? tasks.find((t) => t.id === slot.linkedTaskId)
                          : undefined;
                        const linkedSubDone = linkedTask
                          ? linkedTask.checklist.filter((c) => c.done).length
                          : 0;
                        const linkedSubTotal = linkedTask ? linkedTask.checklist.length : 0;

                        const globalIdx = daySlots.findIndex((d) => d.id === slot.id);
                        const prevEnd =
                          globalIdx > 0 ? toMinutes(daySlots[globalIdx - 1].endTime) : -1;
                        const showNowDivider =
                          selectedDayInfo.isToday &&
                          !isLiveNow &&
                          currentMinuteOfDay < startMin &&
                          currentMinuteOfDay >= prevEnd;

                        return (
                          <div key={slot.id} className="relative">
                            {showNowDivider && (
                              <div className="relative -ml-5 mb-3 flex items-center gap-2 pl-5">
                                <span className="animate-beacon -ml-[25px] h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.95)]" />
                                <div className="h-[1.5px] flex-1 bg-gradient-to-r from-cyan-400/80 to-transparent" />
                                <span className="tabular-nums text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">
                                  Now · {formatTime12h(
                                    `${String(now.getHours()).padStart(2, '0')}:${String(
                                      now.getMinutes(),
                                    ).padStart(2, '0')}`,
                                  )}
                                </span>
                              </div>
                            )}

                            <span
                              aria-hidden="true"
                              className={`absolute -left-[15px] top-6 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#041238] ${
                                isLiveNow
                                  ? 'animate-beacon bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.95)]'
                                  : isDone
                                    ? 'bg-emerald-500'
                                    : checkStyle.dot
                              }`}
                            />

                            <div
                              className={`relative flex items-center gap-3 overflow-hidden rounded-[28px] border px-4 py-3.5 transition-opacity duration-200 ${
                                SUBJECT_GLASS_ROW[slot.subject]
                              } ${isDone ? 'opacity-76' : 'opacity-100'}`}
                            >
                              {isSweeping && (
                                <span
                                  aria-hidden="true"
                                  className="animate-crystal-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-cyan-200/35"
                                />
                              )}

                              <button
                                type="button"
                                onClick={() => triggerCompleteToggle(slot.id, isDone)}
                                aria-label={`Toggle complete for ${slot.title}`}
                                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 active:scale-90 ${
                                  isDone ? checkStyle.checked : checkStyle.unchecked
                                }`}
                              >
                                {isDone && <Check className="h-4 w-4 stroke-[3]" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (slot.linkedTaskId && onOpenPlannerForTask) {
                                    haptics.tap();
                                    onOpenPlannerForTask(slot.linkedTaskId);
                                  } else {
                                    triggerCompleteToggle(slot.id, isDone);
                                  }
                                }}
                                className="relative z-10 min-w-0 flex-1 text-left"
                              >
                                <div className="flex items-center gap-1.5">
                                  <p
                                    className={`truncate text-sm font-semibold text-[#07142B] dark:text-white ${
                                      isDone ? 'line-through opacity-75' : ''
                                    }`}
                                  >
                                    {slot.title}
                                  </p>
                                  {slot.revisionStage && (
                                    <span className={`text-[11px] font-bold ${subj.text} shrink-0`}>
                                      · {slot.revisionStage.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 truncate text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                                  <span className={`font-semibold ${subj.text}`}>{subj.short}</span>
                                  {' · '}
                                  {slot.subtitle}
                                  {slot.mode === 'physical' && ' · Physical (2h transit unlocked)'}
                                  {isIncomplete &&
                                    ` · Incomplete (${formatDuration(partialLogged ?? 0)} logged)`}
                                </p>

                                {linkedSubTotal > 0 && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                                      <div
                                        className={`h-full rounded-full ${subj.bar}`}
                                        style={{
                                          width: `${Math.round(
                                            (linkedSubDone / linkedSubTotal) * 100,
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="tabular-nums text-[10px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                                      {linkedSubDone}/{linkedSubTotal} sub-items
                                    </span>
                                  </div>
                                )}
                              </button>

                              <div className="relative z-10 flex shrink-0 items-center gap-2">
                                {!isDone && (
                                  <button
                                    type="button"
                                    onClick={() => openPartialDialog(slot)}
                                    title="Mark incomplete & log partial time"
                                    aria-label={`Mark ${slot.title} incomplete`}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[#0B234A]/70 transition-transform duration-100 active:scale-90 dark:text-sky-200/80 ${
                                      isIncomplete
                                        ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
                                        : 'bg-blue-500/12 hover:bg-blue-500/20'
                                    }`}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <div className="text-right tabular-nums">
                                  <p className="text-xs font-semibold text-[#07142B] dark:text-white">
                                    {formatTime12h(slot.startTime)}
                                  </p>
                                  <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-100/75">
                                    {formatDuration(mins)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {pastWeeks.length === 0 ? (
              <section className="ios-glass rounded-[32px] px-6 py-12 text-center">
                <p className="text-sm font-semibold text-[#07142B] dark:text-white">
                  No past weeks recorded yet
                </p>
                <p className="mt-1 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                  As you tick off daily slots each week, your weekly completion percentages will build here automatically.
                </p>
              </section>
            ) : (
              <>
                <section className="ios-glass-strong rounded-[34px] p-5 sm:p-6">
                  <div className="grid grid-cols-4 gap-3">
                    {[...pastWeeks]
                      .slice(0, 4)
                      .reverse()
                      .map((wk) => (
                        <div key={wk.weekStartISO} className="flex flex-col items-center gap-2">
                          <span className="tabular-nums text-xs font-semibold text-[#07142B] dark:text-white">
                            {wk.completionPercent}%
                          </span>
                          <div className="flex h-28 w-full items-end rounded-full bg-blue-500/15 p-1.5 dark:bg-sky-400/18">
                            <div
                              className="w-full rounded-full bg-gradient-to-t from-blue-600 to-cyan-400 shadow-sm transition-[height] duration-300 dark:from-blue-500 dark:to-cyan-300"
                              style={{ height: `${wk.completionPercent}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                            {wk.range.split('–')[0].trim()}
                          </span>
                        </div>
                      ))}
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {pastWeeks.map((wk) => (
                    <div
                      key={wk.weekStartISO}
                      className="ios-glass flex items-center justify-between gap-4 rounded-[28px] px-5 py-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#07142B] dark:text-white">
                          {wk.label} · {wk.range}
                        </p>
                        <p className="tabular-nums mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                          {wk.tasksDone}/{wk.tasksTotal} tasks · {wk.hoursCompleted}h / {wk.hoursPlanned}h
                        </p>
                      </div>

                      <span className="tabular-nums text-xl font-bold text-blue-700 dark:text-cyan-300">
                        {wk.completionPercent}%
                      </span>
                    </div>
                  ))}
                </section>
              </>
            )}
          </div>
        )}

      <CrystalSheet
        open={partialModalSlot !== null}
        onClose={() => setPartialModalSlot(null)}
        maxWidthClass="max-w-md"
      >
        {partialModalSlot && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                  Session Incomplete / Cut Short
                </p>
                <h3 className="mt-0.5 text-lg font-semibold">{partialModalSlot.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPartialModalSlot(null)}
                aria-label="Close incomplete sheet"
                className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-100 active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-[#0B234A]/75 dark:text-sky-200/80">
                How many minutes did you get done?
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600 dark:text-sky-300" />
                <input
                  type="range"
                  min={0}
                  max={getDurationMinutes(partialModalSlot.startTime, partialModalSlot.endTime)}
                  step={5}
                  value={partialMinsInput}
                  onChange={(e) => setPartialMinsInput(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <span className="tabular-nums min-w-[54px] text-right text-sm font-bold">
                  {formatDuration(partialMinsInput)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setPartialModalSlot(null)}
                className="ios-glass-control min-h-[46px] rounded-full px-5 text-xs font-semibold transition-transform duration-100 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  onMarkSlotIncomplete(
                    selectedDayInfo.dateISO,
                    partialModalSlot.id,
                    partialMinsInput,
                  );
                  const linkedId = partialModalSlot.linkedTaskId;
                  setPartialModalSlot(null);
                  if (linkedId && onOpenPlannerForTask) {
                    onOpenPlannerForTask(linkedId);
                  }
                }}
                className="min-h-[46px] flex-1 rounded-full bg-orange-500 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 transition-transform duration-100 active:scale-[0.98]"
              >
                {partialModalSlot.linkedTaskId
                  ? 'Save Incomplete & Suggest Next Slot'
                  : 'Save Incomplete'}
              </button>
            </div>
          </>
        )}
      </CrystalSheet>
    </div>
  );
});
