import {
  Bell,
  ChevronDown,
  Clock,
  Layers,
  Lock,
  Navigation,
  Plus,
  RefreshCw,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  CLASS_PRESETS,
  DAYS_ORDER,
  LEGACY_PRESET_MAP,
  SUBJECT_META,
} from '../data/previewData';
import {
  ClassMode,
  DayOfWeek,
  SlotCategory,
  SubjectId,
  TimetableSlot,
} from '../types';
import { getDayOfWeek } from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import { computePhysicalTravelVisuals } from '../utils/schedulerEngine';
import { formatDuration, formatTime12h, getDurationMinutes, toMinutes } from '../utils/timeUtils';
import { CrystalSheet, LiquidSwitch } from './FluidControls';
import { GlassTimePicker } from './GlassTimePicker';

interface TimetableViewProps {
  slots: TimetableSlot[];
  isActive?: boolean;
  onAddSlot: (slot: TimetableSlot, triggerReviseLoop?: boolean) => void;
  onUpdateSlot: (slot: TimetableSlot) => void;
  onDeleteSlot: (slotId: string) => void;
  onOpenReviseLoop: (classSlot: TimetableSlot) => void;
  onOpenPlannerForTask?: (taskId: string) => void;
}

const GRID_START_HOUR = 0;
const GRID_END_HOUR = 24;
const HOUR_HEIGHT = 48;

const GLASS_SUBJECT_BLOCK: Record<SubjectId, string> = {
  biology: 'ios-glass-subj-bio text-emerald-950 dark:text-emerald-50',
  physics: 'ios-glass-subj-phy text-orange-950 dark:text-orange-50',
  chemistry: 'ios-glass-subj-chem text-blue-950 dark:text-sky-50',
};

const COMMUTE_OPTIONS = [0, 30, 60, 90, 120, 150];

function formatMinutesCompact(minutes: number): string {
  if (minutes <= 0) return 'Free';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const TimetableView = memo(function TimetableView({
  slots,
  isActive = true,
  onAddSlot,
  onUpdateSlot,
  onDeleteSlot,
  onOpenReviseLoop,
  onOpenPlannerForTask,
}: TimetableViewProps) {
  const todayDow = getDayOfWeek();
  const [viewMode, setViewMode] = useState<'grid' | 'day'>('grid');
  const [activeDay, setActiveDay] = useState<DayOfWeek>(todayDow);
  const [spotlightSubject, setSpotlightSubject] = useState<'all' | SubjectId>('all');
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    if (!isActive) return;
    const update = () => {
      if (!document.hidden) {
        const d = new Date();
        setNowMinutes(d.getHours() * 60 + d.getMinutes());
      }
    };
    update();
    const t = window.setInterval(update, 30000);
    return () => window.clearInterval(t);
  }, [isActive]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingLinkedTaskId, setEditingLinkedTaskId] = useState<string | undefined>(undefined);
  const [formDay, setFormDay] = useState<DayOfWeek>(todayDow);
  const [category, setCategory] = useState<SlotCategory>('class');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(CLASS_PRESETS[0].id);
  const [classDropdownOpen, setClassDropdownOpen] = useState<boolean>(false);
  const [classMode, setClassMode] = useState<ClassMode>('online');
  const [travelBeforeMins, setTravelBeforeMins] = useState<number>(0);
  const [travelAfterMins, setTravelAfterMins] = useState<number>(0);
  const [planReviseLoop, setPlanReviseLoop] = useState<boolean>(true);

  const [selfSubject, setSelfSubject] = useState<SubjectId>('biology');
  const [selfNote, setSelfNote] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('11:00');
  const [autoBlock, setAutoBlock] = useState(true);

  const [clockTarget, setClockTarget] = useState<'start' | 'end' | null>(null);

  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
    (_, i) => GRID_START_HOUR + i,
  );

  // Weekly Telemetry & Per-Day Totals
  const weeklyTelemetry = useMemo(() => {
    let totalMins = 0;
    let classMins = 0;
    let studyMins = 0;
    let transitMins = 0;
    let transitTrips = 0;
    const perDayMins: Record<DayOfWeek, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };

    for (const s of slots) {
      const dur = getDurationMinutes(s.startTime, s.endTime);
      totalMins += dur;
      perDayMins[s.day] += dur;
      if (s.category === 'class') classMins += dur;
      else studyMins += dur;
    }

    for (const day of DAYS_ORDER) {
      const tvMap = computePhysicalTravelVisuals(slots, day);
      for (const tv of Object.values(tvMap)) {
        if (tv.beforeMins > 0) {
          transitMins += tv.beforeMins;
          transitTrips += 1;
        }
        if (tv.afterMins > 0) {
          transitMins += tv.afterMins;
          transitTrips += 1;
        }
      }
    }

    const spotlightSlots =
      spotlightSubject === 'all'
        ? slots
        : slots.filter((s) => s.subject === spotlightSubject);
    const spotlightMins = spotlightSlots.reduce(
      (acc, s) => acc + getDurationMinutes(s.startTime, s.endTime),
      0,
    );

    const classPct = totalMins > 0 ? Math.round((classMins / totalMins) * 100) : 50;

    return {
      totalMins,
      classMins,
      studyMins,
      classPct,
      transitMins,
      transitTrips,
      perDayMins,
      spotlightCount: spotlightSlots.length,
      spotlightMins,
    };
  }, [slots, spotlightSubject]);

  const daySlots = useMemo(
    () =>
      slots
        .filter((s) => s.day === activeDay)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, activeDay],
  );

  const dayTravelVisuals = useMemo(
    () => computePhysicalTravelVisuals(slots, activeDay),
    [slots, activeDay],
  );

  const activeDayTransitMins = useMemo(
    () =>
      Object.values(dayTravelVisuals).reduce(
        (acc, tv) => acc + tv.beforeMins + tv.afterMins,
        0,
      ),
    [dayTravelVisuals],
  );

  const resolvedPresetId = LEGACY_PRESET_MAP[selectedPresetId] ?? selectedPresetId;
  const selectedPreset =
    CLASS_PRESETS.find((c) => c.id === resolvedPresetId) ?? CLASS_PRESETS[0];

  const previewDuration = getDurationMinutes(startTime, endTime);
  const invalidTimeRange = previewDuration <= 0;

  const applyPresetDefaults = (presetId: string) => {
    const preset = CLASS_PRESETS.find((c) => c.id === presetId) ?? CLASS_PRESETS[0];
    setSelectedPresetId(preset.id);
    setClassMode(preset.defaultMode);
    setTravelBeforeMins(preset.defaultTravelBeforeMins);
    setTravelAfterMins(preset.defaultTravelAfterMins);
    setPlanReviseLoop(preset.supportsReviseLoop);
  };

  const openCreatorForDay = (day: DayOfWeek) => {
    haptics.tap();
    setEditingSlotId(null);
    setEditingLinkedTaskId(undefined);
    setFormDay(day);
    setCategory('class');
    applyPresetDefaults(CLASS_PRESETS[0].id);
    setSelfSubject('biology');
    setSelfNote('');
    setStartTime('08:00');
    setEndTime('11:00');
    setAutoBlock(true);
    setClassDropdownOpen(false);
    setSheetOpen(true);
  };

  const openExistingSlot = (slot: TimetableSlot) => {
    haptics.tap();
    setEditingSlotId(slot.id);
    setEditingLinkedTaskId(slot.linkedTaskId);
    setFormDay(slot.day);
    setCategory(slot.category);
    if (slot.category === 'class') {
      const mapped = LEGACY_PRESET_MAP[slot.classPresetId ?? ''] ?? slot.classPresetId ?? CLASS_PRESETS[0].id;
      const preset = CLASS_PRESETS.find((c) => c.id === mapped) ?? CLASS_PRESETS[0];
      setSelectedPresetId(preset.id);
      setClassMode(slot.mode ?? preset.defaultMode);
      setTravelBeforeMins(slot.travelBeforeMins ?? preset.defaultTravelBeforeMins);
      setTravelAfterMins(slot.travelAfterMins ?? preset.defaultTravelAfterMins);
      setPlanReviseLoop(false);
    } else {
      setSelfSubject(slot.subject);
      setSelfNote(slot.subtitle);
      setClassMode('online');
      setTravelBeforeMins(0);
      setTravelAfterMins(0);
      setPlanReviseLoop(false);
    }
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setAutoBlock(slot.autoBlock);
    setClassDropdownOpen(false);
    setSheetOpen(true);
  };

  const handleSaveSlot = () => {
    if (invalidTimeRange) return;
    haptics.success();

    const existingSlot = editingSlotId ? slots.find((s) => s.id === editingSlotId) : undefined;

    const slotPayload: TimetableSlot =
      category === 'class'
        ? {
            id: editingSlotId ?? `slot-${Date.now()}`,
            day: formDay,
            startTime,
            endTime,
            category: 'class',
            subject: selectedPreset.subject,
            classPresetId: selectedPreset.id,
            title: selectedPreset.title,
            subtitle: selectedPreset.teacher.replace(/\s·\s(Online|Physical)$/, ''),
            autoBlock,
            mode: classMode,
            travelBeforeMins: classMode === 'physical' ? travelBeforeMins : 0,
            travelAfterMins: classMode === 'physical' ? travelAfterMins : 0,
            linkedTaskId: existingSlot?.linkedTaskId,
          }
        : {
            id: editingSlotId ?? `slot-${Date.now()}`,
            day: formDay,
            startTime,
            endTime,
            category: 'self-study',
            subject: selfSubject,
            title: existingSlot?.linkedTaskId
              ? existingSlot.title
              : `Self-Study · ${SUBJECT_META[selfSubject].short}`,
            subtitle: selfNote.trim() || 'Focused revision block',
            autoBlock,
            mode: 'online',
            travelBeforeMins: 0,
            travelAfterMins: 0,
            linkedTaskId: existingSlot?.linkedTaskId,
            revisionStage: existingSlot?.revisionStage,
            sourceClassSlotId: existingSlot?.sourceClassSlotId,
          };

    if (editingSlotId) {
      onUpdateSlot(slotPayload);
    } else {
      onAddSlot(slotPayload, category === 'class' && planReviseLoop);
    }

    setActiveDay(formDay);
    setSheetOpen(false);
  };

  const handleDeleteCurrentSlot = () => {
    if (!editingSlotId) return;
    haptics.tap();
    onDeleteSlot(editingSlotId);
    setSheetOpen(false);
  };

  const nowLineTopPx = (nowMinutes / 60) * HOUR_HEIGHT;
  const nowTimeHHMM = `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(
    nowMinutes % 60,
  ).padStart(2, '0')}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#07142B] dark:text-white">
            Timetable
          </h1>
          <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
            {slots.length === 0
              ? '24h schedule · online & 2h physical transit aware'
              : 'Tap any slot to view, edit or plan revise loops · commutes stay unlocked'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="ios-glass relative grid grid-cols-2 items-center rounded-full p-1">
            {(['grid', 'day'] as const).map((mode) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setViewMode(mode);
                  }}
                  className={`min-h-[34px] rounded-full px-3.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {mode === 'grid' ? 'Week Grid' : 'Day List'}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => openCreatorForDay(activeDay)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-95 dark:bg-blue-500 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Slot</span>
          </button>
        </div>
      </div>

      {/* Weekly Load & Commute Intelligence Bento Row */}
      <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="grid grid-cols-3 gap-2.5 lg:col-span-7">
          {/* Card 1: Total Weekly Load */}
          <div className="ios-glass-tile flex flex-col justify-between rounded-[26px] p-3.5 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700/75 dark:text-cyan-300/80">
              Weekly Load
            </p>
            <div className="mt-2">
              <p className="tabular-nums text-lg font-bold text-[#07142B] dark:text-white sm:text-xl">
                {formatDuration(weeklyTelemetry.totalMins)}
              </p>
              <p className="tabular-nums text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                {slots.length} weekly slots
              </p>
            </div>
          </div>

          {/* Card 2: Class vs Self-Study Balance */}
          <div className="ios-glass-tile flex flex-col justify-between rounded-[26px] p-3.5 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700/75 dark:text-cyan-300/80">
              Class / Study
            </p>
            <div className="mt-2">
              <p className="tabular-nums text-sm font-bold text-[#07142B] dark:text-white sm:text-base">
                {formatDuration(weeklyTelemetry.classMins)} · {formatDuration(weeklyTelemetry.studyMins)}
              </p>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-cyan-400/30">
                <div
                  className="h-full bg-blue-600 transition-[width] duration-300 dark:bg-sky-400"
                  style={{ width: `${weeklyTelemetry.classPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Unlocked Physical Transit */}
          <div className="ios-glass-tile flex flex-col justify-between rounded-[26px] p-3.5 sm:p-4">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">
              <Navigation className="h-2.5 w-2.5" />
              <span>Transit</span>
            </p>
            <div className="mt-2">
              <p className="tabular-nums text-lg font-bold text-[#07142B] dark:text-white sm:text-xl">
                {formatDuration(weeklyTelemetry.transitMins)}
              </p>
              <p className="text-[11px] text-sky-700 dark:text-cyan-300/85">
                {weeklyTelemetry.transitTrips} trips · unlocked
              </p>
            </div>
          </div>
        </div>

        {/* Right: Subject Spotlight Filter Bento Card */}
        <div className="ios-glass-tile flex flex-col justify-between rounded-[26px] p-3.5 sm:p-4 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700/75 dark:text-cyan-300/80">
              Subject Spotlight
            </p>
            <span className="tabular-nums text-[11px] font-semibold text-[#0B234A]/75 dark:text-sky-100/80">
              {formatDuration(weeklyTelemetry.spotlightMins)} · {weeklyTelemetry.spotlightCount} slots
            </span>
          </div>

          <div className="ios-glass-control relative mt-2.5 grid grid-cols-4 gap-1 rounded-full p-1">
            {(['all', 'biology', 'physics', 'chemistry'] as const).map((sub) => {
              const active = spotlightSubject === sub;
              const label = sub === 'all' ? 'All' : SUBJECT_META[sub].short;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setSpotlightSubject(sub);
                  }}
                  className={`min-h-[30px] rounded-full text-[11px] font-semibold transition-colors duration-150 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {viewMode === 'grid' ? (
        <div className="ios-glass-strong mt-4 overflow-hidden rounded-[34px]">
            <div className="max-h-[68vh] overflow-auto no-scrollbar">
              <div className="min-w-[820px]">
                <div className="sticky top-0 z-20 grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-white/40 bg-[#E0EDFF]/95 dark:border-sky-300/15 dark:bg-[#061A4A]/95">
                  <div className="flex flex-col items-center justify-center py-3 text-[11px] font-medium text-[#0B234A]/55 dark:text-sky-200/60">
                    <span>24h</span>
                  </div>
                  {DAYS_ORDER.map((day) => {
                    const dayMins = weeklyTelemetry.perDayMins[day];
                    const isToday = day === todayDow;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => openCreatorForDay(day)}
                        className={`mx-1 my-1.5 flex flex-col items-center justify-center rounded-[20px] py-1.5 text-center transition-colors hover:bg-white/35 dark:hover:bg-blue-400/15 ${
                          isToday
                            ? 'bg-blue-500/20 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:bg-sky-400/20 dark:text-cyan-200'
                            : 'text-[#07142B] dark:text-sky-50'
                        }`}
                      >
                        <span className="flex items-center gap-1 text-xs font-semibold">
                          {isToday && (
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-300" />
                          )}
                          <span>{day}</span>
                        </span>
                        <span className="tabular-nums text-[10px] font-medium opacity-70">
                          {formatMinutesCompact(dayMins)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div
                  className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
                  style={{ height: `${(GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT}px` }}
                >
                  <div className="relative border-r border-white/30 dark:border-sky-300/10">
                    {hours.slice(0, -1).map((hour, i) => (
                      <div
                        key={hour}
                        style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                        className="tabular-nums absolute left-0 right-0 pr-2 pt-1 text-right text-[11px] text-[#0B234A]/60 dark:text-sky-200/60"
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                    <div className="tabular-nums absolute bottom-0.5 left-0 right-0 pr-2 text-right text-[10px] text-[#0B234A]/50 dark:text-sky-200/50">
                      24:00
                    </div>
                  </div>

                  {DAYS_ORDER.map((day) => {
                    const colSlots = slots.filter((s) => s.day === day);
                    const travelVisuals = computePhysicalTravelVisuals(slots, day);
                    const isTodayCol = day === todayDow;

                    return (
                      <div
                        key={day}
                        className={`timetable-grid-lines relative border-r border-white/25 last:border-r-0 dark:border-sky-300/[0.07] ${
                          isTodayCol ? 'bg-blue-400/[0.06] dark:bg-cyan-400/[0.04]' : ''
                        }`}
                      >

                        {/* Live Current Time Crystal Beam with Pulsing Beacon & Timestamp */}
                        {isTodayCol && (
                          <div
                            aria-hidden="true"
                            style={{ top: `${nowLineTopPx}px` }}
                            className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                          >
                            <span className="animate-beacon -ml-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.98)]" />
                            <span className="tabular-nums ml-1 rounded-full bg-cyan-400/90 px-1.5 py-0.5 text-[9px] font-bold text-[#041434] shadow-sm">
                              {formatTime12h(nowTimeHHMM)}
                            </span>
                            <div className="h-[1.5px] flex-1 bg-gradient-to-r from-cyan-400 to-blue-400/35" />
                          </div>
                        )}

                        {/* Diagonal Transit-Hatch Commute Wings (Phone Lock Always Off) */}
                        {colSlots.map((slot) => {
                          const tv = travelVisuals[slot.id];
                          if (!tv) return null;
                          const slotStartMin = toMinutes(slot.startTime);
                          const slotDurMin = getDurationMinutes(slot.startTime, slot.endTime);
                          const slotEndMin = slotStartMin + slotDurMin;

                          return (
                            <div key={`tv-${slot.id}`}>
                              {tv.beforeStartMin !== null && tv.beforeMins > 0 && (
                                <div
                                  style={{
                                    top: `${(tv.beforeStartMin / 60) * HOUR_HEIGHT}px`,
                                    height: `${(tv.beforeMins / 60) * HOUR_HEIGHT}px`,
                                  }}
                                  className="transit-hatch pointer-events-none absolute left-1.5 right-1.5 flex items-center justify-center rounded-t-[14px] border border-dashed border-sky-400/55 px-1.5 text-center dark:border-sky-300/35"
                                >
                                  <span className="truncate text-[9px] font-semibold text-sky-900/80 dark:text-sky-100/85">
                                    {formatDuration(tv.beforeMins)} commute · open
                                  </span>
                                </div>
                              )}

                              {tv.afterEndMin !== null && tv.afterMins > 0 && (
                                <div
                                  style={{
                                    top: `${(slotEndMin / 60) * HOUR_HEIGHT}px`,
                                    height: `${((tv.afterEndMin - slotEndMin) / 60) * HOUR_HEIGHT}px`,
                                  }}
                                  className="transit-hatch pointer-events-none absolute left-1.5 right-1.5 flex items-center justify-center rounded-b-[14px] border border-dashed border-sky-400/55 px-1.5 text-center dark:border-sky-300/35"
                                >
                                  <span className="truncate text-[9px] font-semibold text-sky-900/80 dark:text-sky-100/85">
                                    {formatDuration(tv.afterMins)} return · open
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {colSlots.map((slot) => {
                          const startMin = toMinutes(slot.startTime);
                          const durMin = Math.max(25, getDurationMinutes(slot.startTime, slot.endTime));
                          const topPx = ((startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
                          const heightPx = (durMin / 60) * HOUR_HEIGHT;
                          const compact = durMin <= 45;
                          const dimmed =
                            spotlightSubject !== 'all' && slot.subject !== spotlightSubject;

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => openExistingSlot(slot)}
                              style={{
                                top: `${Math.max(2, topPx + 1)}px`,
                                height: `${Math.max(24, heightPx - 2)}px`,
                              }}
                              className={`absolute left-1 right-1 overflow-hidden rounded-[18px] border px-2.5 py-1.5 text-left transition-opacity duration-150 active:scale-[0.98] ${
                                GLASS_SUBJECT_BLOCK[slot.subject]
                              } ${dimmed ? 'opacity-30' : 'opacity-100'}`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="truncate text-[11px] font-semibold leading-tight">
                                  {slot.revisionStage ? `${slot.revisionStage.toUpperCase()} · ` : ''}
                                  {slot.title}
                                </p>
                                {slot.autoBlock && (
                                  <Lock className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-75" />
                                )}
                              </div>
                              {!compact && (
                                <p className="mt-0.5 truncate text-[10px] opacity-85">
                                  {slot.subtitle}
                                </p>
                              )}
                              {heightPx >= 54 && (
                                <p className="tabular-nums mt-0.5 text-[10px] opacity-75">
                                  {slot.startTime}–{slot.endTime}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            {/* Day Selector Ribbon with Scheduled Load Dots */}
            <div className="ios-glass relative grid grid-cols-7 gap-1 rounded-full p-1.5">
              {DAYS_ORDER.map((day) => {
                const active = activeDay === day;
                const hasSlots = weeklyTelemetry.perDayMins[day] > 0;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setActiveDay(day);
                    }}
                    className={`flex min-h-[44px] flex-col items-center justify-center rounded-full text-xs font-semibold transition-colors duration-150 active:scale-95 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : 'text-[#0B234A]/75 dark:text-sky-200/80'
                    }`}
                  >
                    <span>{day}</span>
                    {hasSlots && (
                      <span
                        className={`mt-0.5 h-1 w-1 rounded-full ${
                          active ? 'bg-cyan-200' : 'bg-blue-500/70 dark:bg-cyan-300/75'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Day Agenda Summary */}
            <div className="ios-glass mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[24px] px-4 py-3 text-xs">
              <span className="font-semibold text-[#07142B] dark:text-white">
                {activeDay} · {formatMinutesCompact(weeklyTelemetry.perDayMins[activeDay])} planned
              </span>
              <span className="tabular-nums text-[#0B234A]/70 dark:text-sky-200/75">
                {daySlots.length} {daySlots.length === 1 ? 'session' : 'sessions'}
                {activeDayTransitMins > 0 &&
                  ` · ${formatDuration(activeDayTransitMins)} unlocked transit`}
              </span>
            </div>

            {daySlots.length === 0 ? (
              <div className="ios-glass mt-4 rounded-[32px] px-6 py-10 text-center">
                <p className="text-sm font-semibold text-[#07142B] dark:text-white">
                  No slots on {activeDay}
                </p>
                <p className="mt-1 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                  Tap Add Slot to schedule a class or self-study block.
                </p>
              </div>
            ) : (
              <div
                key={activeDay}
                className="relative mt-4 space-y-2.5 pl-4 before:absolute before:bottom-4 before:left-1.5 before:top-4 before:w-[2px] before:rounded-full before:bg-gradient-to-b before:from-blue-400/55 before:via-cyan-400/45 before:to-blue-400/15"
              >
                {daySlots.map((slot) => {
                  const mins = getDurationMinutes(slot.startTime, slot.endTime);
                  const subj = SUBJECT_META[slot.subject];
                  const tv = dayTravelVisuals[slot.id];
                  const dimmed =
                    spotlightSubject !== 'all' && slot.subject !== spotlightSubject;

                  return (
                    <div key={slot.id} className="space-y-2">
                      {/* Outbound Physical Transit Card */}
                      {tv && tv.beforeStartMin !== null && tv.beforeMins > 0 && (
                        <div className="transit-hatch relative flex items-center justify-between gap-3 rounded-[22px] border border-dashed border-sky-400/55 px-4 py-2.5 dark:border-sky-300/35">
                          <span
                            aria-hidden="true"
                            className="absolute -left-[15px] h-2 w-2 rounded-full border border-sky-400 bg-sky-200 dark:bg-sky-900"
                          />
                          <div className="flex items-center gap-2 text-xs font-medium text-sky-900 dark:text-sky-100">
                            <Unlock className="h-3.5 w-3.5 text-sky-600 dark:text-cyan-300" />
                            <span>
                              Going Transit to {slot.title} · Phone Unlocked
                            </span>
                          </div>
                          <span className="tabular-nums text-[11px] font-semibold text-sky-800 dark:text-cyan-200">
                            {formatDuration(tv.beforeMins)}
                          </span>
                        </div>
                      )}

                      {/* Main Class or Self-Study Block */}
                      <button
                        type="button"
                        onClick={() => openExistingSlot(slot)}
                        className={`relative flex w-full items-center justify-between gap-4 rounded-[28px] border px-5 py-4 text-left transition-transform duration-100 active:scale-[0.985] ${
                          GLASS_SUBJECT_BLOCK[slot.subject]
                        } ${dimmed ? 'opacity-35' : 'opacity-100'}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute -left-[16px] h-2.5 w-2.5 rounded-full ring-2 ring-white/80 dark:ring-[#061A4A] ${subj.bar}`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`font-semibold ${subj.text}`}>{subj.name}</span>
                            <span className="opacity-50">·</span>
                            <span className="opacity-75">
                              {slot.category === 'class'
                                ? slot.mode === 'physical'
                                  ? 'Physical Class'
                                  : 'Online Class'
                                : slot.revisionStage
                                  ? `Revise ${slot.revisionStage.toUpperCase()}`
                                  : 'Self-Study'}
                            </span>
                            {slot.autoBlock && (
                              <>
                                <span className="opacity-50">·</span>
                                <span className="inline-flex items-center gap-1 opacity-80">
                                  <Lock className="h-3 w-3" />
                                  <span>Locked</span>
                                </span>
                              </>
                            )}
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-[#07142B] dark:text-white">
                            {slot.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                            {slot.subtitle}
                          </p>
                        </div>

                        <div className="shrink-0 text-right tabular-nums">
                          <p className="text-xs font-semibold text-[#07142B] dark:text-white">
                            {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                          </p>
                          <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-100/75">
                            {formatDuration(mins)}
                          </p>
                        </div>
                      </button>

                      {/* Return Physical Transit Card */}
                      {tv && tv.afterEndMin !== null && tv.afterMins > 0 && (
                        <div className="transit-hatch relative flex items-center justify-between gap-3 rounded-[22px] border border-dashed border-sky-400/55 px-4 py-2.5 dark:border-sky-300/35">
                          <span
                            aria-hidden="true"
                            className="absolute -left-[15px] h-2 w-2 rounded-full border border-sky-400 bg-sky-200 dark:bg-sky-900"
                          />
                          <div className="flex items-center gap-2 text-xs font-medium text-sky-900 dark:text-sky-100">
                            <Unlock className="h-3.5 w-3.5 text-sky-600 dark:text-cyan-300" />
                            <span>
                              Return Transit from {slot.title} · Phone Unlocked
                            </span>
                          </div>
                          <span className="tabular-nums text-[11px] font-semibold text-sky-800 dark:text-cyan-200">
                            {formatDuration(tv.afterMins)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {/* Create / View / Edit Slot Sheet */}
      <CrystalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} maxWidthClass="max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#0B234A]/70 dark:text-sky-200/75">
              {formDay} · {invalidTimeRange ? 'Pick valid range' : formatDuration(previewDuration)}
            </p>
            <h2 className="text-lg font-semibold text-[#07142B] dark:text-white">
              {editingSlotId ? 'View & Edit Slot' : 'Add Slot'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            aria-label="Close slot sheet"
            className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {editingLinkedTaskId && onOpenPlannerForTask && (
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setSheetOpen(false);
              onOpenPlannerForTask(editingLinkedTaskId);
            }}
            className="ios-glass-control mt-3 flex min-h-[40px] w-full items-center justify-between rounded-full px-4 text-xs font-semibold text-blue-700 transition-transform duration-100 active:scale-[0.98] dark:text-cyan-200"
          >
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span>Linked to Planner Task · Open Details</span>
            </span>
            <span>View</span>
          </button>
        )}

        <div className="ios-glass-control relative mt-4 grid grid-cols-7 gap-1 rounded-full p-1">
          {DAYS_ORDER.map((day) => {
            const active = formDay === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setFormDay(day);
                }}
                className={`min-h-[36px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                    : 'text-[#07142B] dark:text-sky-100'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="ios-glass-control relative mt-4 grid grid-cols-2 gap-1 rounded-full p-1">
          {(
            [
              { id: 'class', label: 'Class' },
              { id: 'self-study', label: 'Self-Study' },
            ] as { id: SlotCategory; label: string }[]
          ).map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setCategory(cat.id);
                }}
                className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                  active
                    ? 'bg-white/85 text-[#07142B] shadow-sm dark:bg-blue-500 dark:text-white'
                    : 'text-[#0B234A]/75 dark:text-sky-200/80'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {category === 'class' ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                Class
              </label>

              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setClassDropdownOpen((open) => !open);
                }}
                aria-expanded={classDropdownOpen}
                className="ios-glass-control mt-1.5 flex min-h-[54px] w-full items-center justify-between gap-3 rounded-[24px] px-4 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#07142B] dark:text-white">
                    {selectedPreset.title}
                  </p>
                  <p className="truncate text-xs text-[#0B234A]/70 dark:text-sky-200/75">
                    <span className={SUBJECT_META[selectedPreset.subject].text}>
                      {SUBJECT_META[selectedPreset.subject].short}
                    </span>
                    {' · '}
                    {selectedPreset.teacher}
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#0B234A]/70 transition-transform duration-150 dark:text-sky-200 ${
                    classDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {classDropdownOpen && (
                <div className="ios-glass-control mt-2 max-h-60 divide-y divide-white/30 overflow-y-auto rounded-[24px] dark:divide-sky-300/15">
                  {CLASS_PRESETS.map((preset) => {
                    const meta = SUBJECT_META[preset.subject];
                    const active = resolvedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          haptics.tick();
                          applyPresetDefaults(preset.id);
                          setClassDropdownOpen(false);
                        }}
                        className={`flex min-h-[46px] w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
                          active
                            ? 'bg-blue-500/20 font-semibold'
                            : 'hover:bg-white/30 dark:hover:bg-blue-400/10'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#07142B] dark:text-white">
                            {preset.title}
                          </p>
                          <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                            {preset.teacher}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold ${meta.text}`}>
                          {meta.short}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Online vs Physical Mode + Editable Travel Buffers */}
            <div className="ios-glass-control rounded-[24px] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#07142B] dark:text-white">
                  Attendance Mode
                </span>
                <div className="relative flex items-center gap-1 rounded-full bg-blue-500/12 p-1">
                  {(['online', 'physical'] as ClassMode[]).map((m) => {
                    const active = classMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          haptics.tick();
                          setClassMode(m);
                          if (m === 'online') {
                            setTravelBeforeMins(0);
                            setTravelAfterMins(0);
                          } else {
                            if (travelBeforeMins === 0) setTravelBeforeMins(120);
                            if (travelAfterMins === 0) setTravelAfterMins(120);
                          }
                        }}
                        className={`min-h-[30px] rounded-full px-3 text-[11px] font-semibold transition-colors duration-150 ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                            : 'text-[#0B234A]/75 dark:text-sky-200/80'
                        }`}
                      >
                        {m === 'online' ? 'Online · Home' : 'Physical · Commute'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {classMode === 'physical' && (
                <div className="mt-3 grid grid-cols-2 gap-2.5 overflow-hidden border-t border-white/30 pt-3 dark:border-sky-300/15">
                  <div>
                    <label className="block text-[10px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                      Going Commute (Phone Unlocked)
                    </label>
                    <select
                      value={travelBeforeMins}
                      onChange={(e) => setTravelBeforeMins(Number(e.target.value))}
                      className="ios-glass-control mt-1 min-h-[36px] w-full rounded-full px-3 text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
                    >
                      {COMMUTE_OPTIONS.map((m) => (
                        <option
                          key={m}
                          value={m}
                          className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                        >
                          {m === 0 ? 'None' : `${formatDuration(m)} before`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                      Return Commute (Phone Unlocked)
                    </label>
                    <select
                      value={travelAfterMins}
                      onChange={(e) => setTravelAfterMins(Number(e.target.value))}
                      className="ios-glass-control mt-1 min-h-[36px] w-full rounded-full px-3 text-xs font-semibold text-[#07142B] focus:outline-none dark:text-white"
                    >
                      {COMMUTE_OPTIONS.map((m) => (
                        <option
                          key={m}
                          value={m}
                          className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                        >
                          {m === 0 ? 'None' : `${formatDuration(m)} after`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="ios-glass-control relative grid grid-cols-3 gap-1 rounded-full p-1">
              {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
                const meta = SUBJECT_META[subj];
                const active = selfSubject === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setSelfSubject(subj);
                    }}
                    className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                        : meta.text
                    }`}
                  >
                    {meta.name}
                  </button>
                );
              })}
            </div>
            <textarea
              rows={2}
              value={selfNote}
              onChange={(e) => setSelfNote(e.target.value)}
              placeholder="What are you going to do? (questions, recap...)"
              className="ios-glass-control w-full rounded-[24px] px-4 py-3 text-sm text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none dark:text-white dark:placeholder:text-sky-200/45"
            />
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Start Time
            </label>
            <button
              type="button"
              onClick={() => setClockTarget('start')}
              className="ios-glass-control tabular-nums mt-1 flex min-h-[46px] w-full items-center justify-between rounded-full px-4 text-sm font-semibold text-[#07142B] transition-transform duration-100 active:scale-[0.98] dark:text-white"
            >
              <span>{formatTime12h(startTime)}</span>
              <Clock className="h-4 w-4 text-blue-600 dark:text-sky-300" />
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              End Time
            </label>
            <button
              type="button"
              onClick={() => setClockTarget('end')}
              className="ios-glass-control tabular-nums mt-1 flex min-h-[46px] w-full items-center justify-between rounded-full px-4 text-sm font-semibold text-[#07142B] transition-transform duration-100 active:scale-[0.98] dark:text-white"
            >
              <span>{formatTime12h(endTime)}</span>
              <Clock className="h-4 w-4 text-blue-600 dark:text-sky-300" />
            </button>
          </div>
        </div>

        {invalidTimeRange && (
          <p className="mt-2 px-2 text-xs font-medium text-orange-600 dark:text-orange-300">
            End time must be after start time.
          </p>
        )}

        <div className="ios-glass-control mt-4 flex items-center justify-between rounded-full px-4 py-3">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium text-[#07142B] dark:text-white">
              Auto-Lock Phone (Class/Study only)
            </span>
          </div>
          <LiquidSwitch
            checked={autoBlock}
            onToggle={() => setAutoBlock((v) => !v)}
            ariaLabel="Toggle Auto-Lock Phone"
            activeColorClass="bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.45)]"
          />
        </div>

        {/* 3-Step Revise Loop Option on Classes */}
        {category === 'class' && !editingSlotId && (
          <div className="ios-glass-control mt-3 flex items-center justify-between rounded-full px-4 py-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
              <span className="text-xs font-medium text-[#07142B] dark:text-white">
                Suggest 3 Revise Sessions (30m · 1h · 30m)
              </span>
            </div>
            <LiquidSwitch
              checked={planReviseLoop}
              onToggle={() => setPlanReviseLoop((v) => !v)}
              ariaLabel="Toggle 3-Step Revise Loop"
            />
          </div>
        )}

        {category === 'class' && editingSlotId && (
          <button
            type="button"
            onClick={() => {
              const target = slots.find((s) => s.id === editingSlotId);
              if (!target) return;
              haptics.tap();
              setSheetOpen(false);
              onOpenReviseLoop({
                ...target,
                day: formDay,
                startTime,
                endTime,
                mode: classMode,
                travelBeforeMins: classMode === 'physical' ? travelBeforeMins : 0,
                travelAfterMins: classMode === 'physical' ? travelAfterMins : 0,
              });
            }}
            className="ios-glass-control mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-blue-700 transition-transform duration-100 active:scale-[0.98] dark:text-cyan-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Plan / Refresh 3-Step Revise Loop</span>
          </button>
        )}

        <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
          <Bell className="h-3.5 w-3.5 text-blue-600 dark:text-sky-300" />
          <span>10-minute reminder alert before start</span>
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          {editingSlotId && (
            <button
              type="button"
              onClick={handleDeleteCurrentSlot}
              className="ios-glass-control inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full px-5 text-xs font-semibold text-orange-600 transition-transform duration-100 active:scale-95 dark:text-orange-300"
            >
              <Trash2 className="h-4 w-4" />
              <span>Remove</span>
            </button>
          )}
          <button
            type="button"
            disabled={invalidTimeRange}
            onClick={handleSaveSlot}
            className="min-h-[48px] flex-1 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] disabled:opacity-45 dark:bg-blue-500"
          >
            {editingSlotId ? 'Save Changes' : `Add to ${formDay}`}
          </button>
        </div>
      </CrystalSheet>

      {clockTarget !== null && (
        <GlassTimePicker
          open
          label={clockTarget === 'start' ? 'Start Time' : 'End Time'}
          value={clockTarget === 'start' ? startTime : endTime}
          onChange={(newVal) => {
            if (clockTarget === 'start') setStartTime(newVal);
            if (clockTarget === 'end') setEndTime(newVal);
          }}
          onClose={() => setClockTarget(null)}
        />
      )}
    </div>
  );
});
