import { Bell, X } from 'lucide-react';
import { TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppearanceSheet } from './components/AppearanceSheet';
import { BottomNav } from './components/BottomNav';
import { CountdownView } from './components/CountdownView';
import { DayView } from './components/DayView';
import { LockOverlayPreview } from './components/LockOverlayPreview';
import { PapersView } from './components/PapersView';
import { PermissionsSheet } from './components/PermissionsSheet';
import { PlannerView } from './components/PlannerView';
import { ReviseLoopSheet } from './components/ReviseLoopSheet';
import { TimetableView } from './components/TimetableView';
import { TopBar } from './components/TopBar';
import { useScheduleEngine } from './hooks/useScheduleEngine';
import { fetchNativePermissions, syncNativeBlockerAndAlarms } from './native/thisWeekBridge';
import {
  DayCompletionLog,
  NativePermissionStatus,
  PaperEntry,
  RevisionStage,
  SlotSuggestion,
  StudyTask,
  SubjectId,
  TabId,
  TimetableSlot,
} from './types';
import { getCurrentWeekDays, getDayOfWeek, getTodayISO } from './utils/dateUtils';
import { haptics } from './utils/haptics';
import {
  loadCalmBackdrop,
  loadDailyLogs,
  loadGlassTransparency,
  loadManualLockUntil,
  loadPapers,
  loadSlots,
  loadTasks,
  loadThemeDark,
  saveCalmBackdrop,
  saveDailyLogs,
  saveGlassTransparency,
  saveManualLockUntil,
  savePapers,
  saveSlots,
  saveTasks,
  saveThemeDark,
} from './utils/storage';
import { formatDuration, getDurationMinutes, toMinutes } from './utils/timeUtils';
import {
  applyA07PerfClass,
  applyGlassTransparencyVars,
} from './utils/transparency';

const TAB_ORDER: TabId[] = ['timetable', 'planner', 'day', 'papers', 'countdown'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('day');
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set(['day']));
  const [isDark, setIsDark] = useState<boolean>(() => loadThemeDark());
  const [glassTransparency, setGlassTransparency] = useState<number>(() =>
    loadGlassTransparency(),
  );
  const [calmBackdrop, setCalmBackdrop] = useState<boolean>(() => loadCalmBackdrop());
  const [blockerModalOpen, setBlockerModalOpen] = useState<boolean>(false);
  const [appearanceOpen, setAppearanceOpen] = useState<boolean>(false);
  const [permissionsOpen, setPermissionsOpen] = useState<boolean>(false);
  const [nativePerms, setNativePerms] = useState<NativePermissionStatus | null>(null);

  const [slots, setSlots] = useState<TimetableSlot[]>(() => loadSlots());
  const [papers, setPapers] = useState<PaperEntry[]>(() => loadPapers());
  const [tasks, setTasks] = useState<StudyTask[]>(() => loadTasks());
  const [dailyLogs, setDailyLogs] = useState<Record<string, DayCompletionLog>>(() =>
    loadDailyLogs(),
  );
  const [manualLockUntil, setManualLockUntil] = useState<number>(() =>
    loadManualLockUntil(),
  );

  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [reviseLoopClassSlot, setReviseLoopClassSlot] = useState<TimetableSlot | null>(null);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const handleSelectTab = useCallback((nextTab: TabId) => {
    setActiveTab((prev) => {
      if (prev === nextTab) return prev;
      return nextTab;
    });
    setVisitedTabs((prev) => {
      if (prev.has(nextTab)) return prev;
      const next = new Set(prev);
      next.add(nextTab);
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Direct-DOM Finger-Tracking Swipe (zero React re-renders during touchmove for 60fps on Galaxy A07)
  const mainRef = useRef<HTMLElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number; lockedAxis: 'x' | 'y' | null } | null>(null);

  const resetMainTransform = () => {
    const el = mainRef.current;
    if (!el) return;
    el.style.transition = 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.transform = '';
  };

  const handleTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (activeTab === 'timetable' || e.touches.length !== 1) return;
    if (mainRef.current) {
      mainRef.current.style.transition = 'none';
    }
    swipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      lockedAxis: null,
    };
  };

  const handleTouchMove = (e: TouchEvent<HTMLElement>) => {
    if (activeTab === 'timetable' || !swipeStartRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - swipeStartRef.current.x;
    const dy = e.touches[0].clientY - swipeStartRef.current.y;

    if (!swipeStartRef.current.lockedAxis) {
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        swipeStartRef.current.lockedAxis = 'x';
      } else if (Math.abs(dy) > 14) {
        swipeStartRef.current.lockedAxis = 'y';
      }
    }

    if (swipeStartRef.current.lockedAxis === 'x' && mainRef.current) {
      const currIdx = TAB_ORDER.indexOf(activeTab);
      const atLeftEdge = currIdx === 0 && dx > 0;
      const atRightEdge = currIdx === TAB_ORDER.length - 1 && dx < 0;
      const damped = atLeftEdge || atRightEdge ? dx * 0.22 : dx * 0.55;
      const clamped = Math.max(-110, Math.min(110, damped));
      mainRef.current.style.transform = `translate3d(${clamped}px, 0, 0)`;
    }
  };

  const handleTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (activeTab === 'timetable' || !swipeStartRef.current || e.changedTouches.length !== 1) {
      swipeStartRef.current = null;
      resetMainTransform();
      return;
    }

    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const wasHorizontal = swipeStartRef.current.lockedAxis === 'x';
    swipeStartRef.current = null;
    resetMainTransform();

    if (wasHorizontal && Math.abs(dx) > 56) {
      const currIdx = TAB_ORDER.indexOf(activeTab);
      if (dx < 0 && currIdx < TAB_ORDER.length - 1) {
        haptics.tick();
        handleSelectTab(TAB_ORDER[currIdx + 1]);
      } else if (dx > 0 && currIdx > 0) {
        haptics.tick();
        handleSelectTab(TAB_ORDER[currIdx - 1]);
      }
    }
  };

  const clearExpiredManualLock = useCallback(() => {
    setManualLockUntil(0);
    saveManualLockUntil(0);
  }, []);

  const { now, activeLock, reminderToast, dismissReminderToast } = useScheduleEngine(
    slots,
    manualLockUntil,
    clearExpiredManualLock,
  );

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveThemeDark(isDark);
  }, [isDark]);

  // Live 0–100% transparency synced straight to precomputed numeric CSS vars (zero calc() lag)
  useEffect(() => {
    applyGlassTransparencyVars(glassTransparency);
    const id = window.setTimeout(() => {
      saveGlassTransparency(glassTransparency);
    }, 120);
    return () => window.clearTimeout(id);
  }, [glassTransparency]);

  const handleChangeTransparency = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    applyGlassTransparencyVars(clamped);
    setGlassTransparency(clamped);
  }, []);

  useEffect(() => {
    applyA07PerfClass(calmBackdrop);
    saveCalmBackdrop(calmBackdrop);
  }, [calmBackdrop]);

  // Startup permission check: auto-open PermissionsSheet on Android every time a required permission is missing
  useEffect(() => {
    let active = true;
    fetchNativePermissions().then((status) => {
      if (!active) return;
      setNativePerms(status);
      if (
        status.isNativeAndroid &&
        (!status.notifications ||
          !status.usageAccess ||
          !status.overlayAccess ||
          !status.batteryUnrestricted)
      ) {
        setPermissionsOpen(true);
      }
    });

    const handleResume = () => {
      fetchNativePermissions().then((status) => {
        if (active) setNativePerms(status);
      });
    };
    window.addEventListener('focus', handleResume);
    return () => {
      active = false;
      window.removeEventListener('focus', handleResume);
    };
  }, []);

  useEffect(() => {
    saveSlots(slots);
    syncNativeBlockerAndAlarms(slots, manualLockUntil);
  }, [slots, manualLockUntil]);

  useEffect(() => {
    savePapers(papers);
  }, [papers]);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveDailyLogs(dailyLogs);
  }, [dailyLogs]);

  const liveBanner = useMemo((): { text: string; subject: SubjectId } | null => {
    const todayDow = getDayOfWeek(now);
    const currMin = now.getHours() * 60 + now.getMinutes();
    const todaySlots = slots
      .filter((s) => s.day === todayDow)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    const running = todaySlots.find((s) => {
      const start = toMinutes(s.startTime);
      const end = s.endTime === '00:00' && start > 0 ? 1440 : toMinutes(s.endTime);
      return currMin >= start && currMin < end;
    });

    if (running) {
      const start = toMinutes(running.startTime);
      const end = running.endTime === '00:00' && start > 0 ? 1440 : toMinutes(running.endTime);
      return {
        text: `${running.title} · ${formatDuration(end - currMin)} left`,
        subject: running.subject,
      };
    }

    const upcoming = todaySlots.find((s) => toMinutes(s.startTime) > currMin);
    if (upcoming) {
      const diff = toMinutes(upcoming.startTime) - currMin;
      return {
        text: `Next: ${upcoming.title} in ${formatDuration(diff)}`,
        subject: upcoming.subject,
      };
    }
    return null;
  }, [slots, now]);

  const recalcDayLog = useCallback(
    (
      prev: Record<string, DayCompletionLog>,
      dateISO: string,
      nextCompletedIds: string[],
      nextIncompleteIds: string[],
      nextLoggedMap: Record<string, number>,
    ): Record<string, DayCompletionLog> => {
      const [y, m, d] = dateISO.split('-').map(Number);
      const dow = getDayOfWeek(new Date(y, m - 1, d));
      const daySlots = slotsRef.current.filter((s) => s.day === dow);

      const plannedMinutes = daySlots.reduce(
        (acc, s) => acc + getDurationMinutes(s.startTime, s.endTime),
        0,
      );
      const completedMinutes = daySlots.reduce((acc, s) => {
        if (nextCompletedIds.includes(s.id)) {
          return acc + getDurationMinutes(s.startTime, s.endTime);
        }
        if (nextIncompleteIds.includes(s.id) && nextLoggedMap[s.id]) {
          return acc + nextLoggedMap[s.id];
        }
        return acc;
      }, 0);

      return {
        ...prev,
        [dateISO]: {
          dateISO,
          completedSlotIds: nextCompletedIds,
          incompleteSlotIds: nextIncompleteIds,
          loggedMinutesBySlot: nextLoggedMap,
          plannedMinutes,
          completedMinutes,
          tasksTotal: daySlots.length,
          tasksDone: daySlots.filter((s) => nextCompletedIds.includes(s.id)).length,
        },
      };
    },
    [],
  );

  const handleToggleSlotComplete = useCallback(
    (dateISO: string, slotId: string) => {
      setDailyLogs((prev) => {
        const cur = prev[dateISO];
        const existingCompleted = cur?.completedSlotIds ?? [];
        const existingIncomplete = cur?.incompleteSlotIds ?? [];
        const existingLoggedMap = { ...(cur?.loggedMinutesBySlot ?? {}) };

        const isRemoving = existingCompleted.includes(slotId);
        const nextCompleted = isRemoving
          ? existingCompleted.filter((id) => id !== slotId)
          : [...existingCompleted, slotId];
        const nextIncomplete = existingIncomplete.filter((id) => id !== slotId);
        if (!isRemoving) {
          delete existingLoggedMap[slotId];
        }

        return recalcDayLog(prev, dateISO, nextCompleted, nextIncomplete, existingLoggedMap);
      });
    },
    [recalcDayLog],
  );

  const handleMarkSlotIncomplete = useCallback(
    (dateISO: string, slotId: string, partialMinutes: number) => {
      setDailyLogs((prev) => {
        const cur = prev[dateISO];
        const nextCompleted = (cur?.completedSlotIds ?? []).filter((id) => id !== slotId);
        const existingIncomplete = cur?.incompleteSlotIds ?? [];
        const nextIncomplete = existingIncomplete.includes(slotId)
          ? existingIncomplete
          : [...existingIncomplete, slotId];
        const nextLoggedMap = {
          ...(cur?.loggedMinutesBySlot ?? {}),
          [slotId]: Math.max(0, partialMinutes),
        };

        return recalcDayLog(prev, dateISO, nextCompleted, nextIncomplete, nextLoggedMap);
      });
    },
    [recalcDayLog],
  );

  const resolveDateISOForSlotDay = useCallback((day: TimetableSlot['day']): string => {
    const week = getCurrentWeekDays(new Date());
    return week.find((w) => w.day === day)?.dateISO ?? getTodayISO();
  }, []);

  const handleAddSlot = useCallback((newSlot: TimetableSlot, triggerReviseLoop?: boolean) => {
    setSlots((prev) => [...prev, newSlot]);
    if (triggerReviseLoop && newSlot.category === 'class') {
      setReviseLoopClassSlot(newSlot);
    }
  }, []);

  const handleUpdateSlot = useCallback((updatedSlot: TimetableSlot) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === updatedSlot.id ? updatedSlot : slot)),
    );
  }, []);

  const handleDeleteSlot = useCallback((slotId: string) => {
    setSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  }, []);

  const handleApproveReviseLoop = useCallback(
    (
      classSlot: TimetableSlot,
      stages: Record<RevisionStage, SlotSuggestion>,
    ) => {
      const existingLoop = tasks.find(
        (t) => t.kind === 'revision-loop' && t.sourceClassSlotId === classSlot.id,
      );
      const loopTaskId = existingLoop?.id ?? `task-loop-${Date.now()}`;

      const stageLabels: Record<RevisionStage, string> = {
        r1: 'Quick Revise (R1)',
        r2: 'Deep Revise (R2 · +3d)',
        r3: 'Pre-Class Warm-Up (R3)',
      };

      const newReviseSlots: TimetableSlot[] = (['r1', 'r2', 'r3'] as RevisionStage[]).map(
        (stage, idx) => {
          const sug = stages[stage];
          return {
            id: `slot-rev-${classSlot.id}-${stage}-${Date.now() + idx}`,
            day: sug.day,
            startTime: sug.startTime,
            endTime: sug.endTime,
            category: 'self-study',
            subject: classSlot.subject,
            title: `${classSlot.title}`,
            subtitle: stageLabels[stage],
            autoBlock: sug.autoBlock,
            mode: 'online',
            travelBeforeMins: 0,
            travelAfterMins: 0,
            linkedTaskId: loopTaskId,
            revisionStage: stage,
            sourceClassSlotId: classSlot.id,
          };
        },
      );

      setSlots((prev) => [
        ...prev.filter((s) => !(s.sourceClassSlotId === classSlot.id && s.revisionStage)),
        ...newReviseSlots,
      ]);

      if (!existingLoop) {
        const loopTask: StudyTask = {
          id: loopTaskId,
          title: `${classSlot.title} · 3-Step Revise`,
          subject: classSlot.subject,
          kind: 'revision-loop',
          sourceClassSlotId: classSlot.id,
          defaultSessionMins: 30,
          checklist: [
            { id: `chk-r1-${Date.now()}`, text: 'R1 · Quick recall after class (30m)', done: false },
            { id: `chk-r2-${Date.now() + 1}`, text: 'R2 · Deep revision 3 days later (1h)', done: false },
            { id: `chk-r3-${Date.now() + 2}`, text: 'R3 · Pre-class warm-up day before (30m)', done: false },
          ],
          notes: `Linked to ${classSlot.day} ${classSlot.title}`,
          status: 'active',
          order: tasks.length,
          createdAtISO: getTodayISO(),
          autoBlockDefault: classSlot.autoBlock,
        };
        setTasks((prev) => [...prev, loopTask]);
      }

      setReviseLoopClassSlot(null);
    },
    [tasks],
  );

  const handleAddTask = useCallback((task: StudyTask) => {
    setTasks((prev) => [...prev, task]);
  }, []);

  const handleUpdateTask = useCallback((updated: StudyTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSlots((prev) => prev.filter((s) => s.linkedTaskId !== taskId));
  }, []);

  const handleReorderTasks = useCallback((orderedIds: string[]) => {
    setTasks((prev) =>
      prev.map((t) => {
        const nextOrder = orderedIds.indexOf(t.id);
        return nextOrder >= 0 ? { ...t, order: nextOrder } : t;
      }),
    );
  }, []);

  const handleApproveSuggestedSlot = useCallback((task: StudyTask, sug: SlotSuggestion) => {
    const newSlot: TimetableSlot = {
      id: `slot-task-${Date.now()}`,
      day: sug.day,
      startTime: sug.startTime,
      endTime: sug.endTime,
      category: 'self-study',
      subject: task.subject,
      title: task.title,
      subtitle: sug.reason,
      autoBlock: sug.autoBlock,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
      linkedTaskId: task.id,
      revisionStage: sug.revisionStage,
    };
    setSlots((prev) => [...prev, newSlot]);
  }, []);

  const handleAddPaper = useCallback((entry: PaperEntry) => {
    setPapers((prev) => [...prev, entry]);
  }, []);

  const handleUpdatePaper = useCallback((updated: PaperEntry) => {
    setPapers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleDeletePaper = useCallback((paperId: string) => {
    setPapers((prev) => prev.filter((p) => p.id !== paperId));
  }, []);

  const handleStartManualLock = useCallback((durationMinutes: number) => {
    const untilMs = Date.now() + durationMinutes * 60 * 1000;
    setManualLockUntil(untilMs);
    saveManualLockUntil(untilMs);
    syncNativeBlockerAndAlarms(slotsRef.current, untilMs);
  }, []);

  const openPlannerTask = useCallback(
    (taskId: string) => {
      setFocusedTaskId(taskId);
      handleSelectTab('planner');
    },
    [handleSelectTab],
  );

  const handleToggleTheme = useCallback(() => setIsDark((prev) => !prev), []);
  const handleToggleCalmBackdrop = useCallback(() => setCalmBackdrop((prev) => !prev), []);
  const handleOpenBlocker = useCallback(() => setBlockerModalOpen(true), []);
  const handleCloseBlocker = useCallback(() => setBlockerModalOpen(false), []);
  const handleOpenAppearance = useCallback(() => setAppearanceOpen(true), []);
  const handleCloseAppearance = useCallback(() => setAppearanceOpen(false), []);
  const handleOpenPermissions = useCallback(() => setPermissionsOpen(true), []);
  const handleClosePermissions = useCallback(() => setPermissionsOpen(false), []);
  const handleOpenLiveBanner = useCallback(() => handleSelectTab('day'), [handleSelectTab]);
  const handleGoToTimetable = useCallback(() => handleSelectTab('timetable'), [handleSelectTab]);
  const handleClearFocusedTask = useCallback(() => setFocusedTaskId(null), []);
  const handleToggleLinkedSlotComplete = useCallback(
    (slot: TimetableSlot) =>
      handleToggleSlotComplete(resolveDateISOForSlotDay(slot.day), slot.id),
    [handleToggleSlotComplete, resolveDateISOForSlotDay],
  );
  const handleMarkLinkedSlotIncomplete = useCallback(
    (slot: TimetableSlot, partialMins: number) =>
      handleMarkSlotIncomplete(resolveDateISOForSlotDay(slot.day), slot.id, partialMins),
    [handleMarkSlotIncomplete, resolveDateISOForSlotDay],
  );

  const missingPermCount = useMemo(() => {
    if (!nativePerms) return 0;
    if (!nativePerms.isNativeAndroid) {
      return nativePerms.notifications ? 0 : 1;
    }
    return [
      nativePerms.notifications,
      nativePerms.usageAccess,
      nativePerms.overlayAccess,
      nativePerms.batteryUnrestricted,
    ].filter((granted) => !granted).length;
  }, [nativePerms]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#CFE3FF] text-[#07142B] transition-colors duration-300 dark:bg-[#02071A] dark:text-white">
      {/* GPU-Isolated Spatial Grid & Refractive Aurora Backdrop (static by default on A07 for 60fps) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden [transform:translateZ(0)]"
      >
        <div className="arctic-grid-bg absolute inset-0 opacity-90" />
        {/* Center-viewport Arctic Aurora Wash so 0% <-> 100% transparency pops cleanly right behind cards */}
        <div
          className="absolute inset-0 opacity-85 dark:opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 75% 55% at 50% 42%, rgba(56,189,248,0.28) 0%, rgba(16,185,129,0.14) 45%, rgba(59,130,246,0) 78%)',
          }}
        />
        <div
          className={`${calmBackdrop ? '' : 'animate-orb-a'} absolute -left-24 -top-24 h-[540px] w-[540px] rounded-full opacity-95`}
          style={{
            background:
              'radial-gradient(circle, rgba(37,99,235,0.58) 0%, rgba(56,189,248,0.3) 44%, rgba(59,130,246,0) 72%)',
          }}
        />
        <div
          className={`${calmBackdrop ? '' : 'animate-orb-b'} absolute right-[-90px] top-[12%] h-[490px] w-[490px] rounded-full opacity-90`}
          style={{
            background:
              'radial-gradient(circle, rgba(34,211,238,0.46) 0%, rgba(16,185,129,0.22) 48%, rgba(16,185,129,0) 72%)',
          }}
        />
        <div
          className={`${calmBackdrop ? '' : 'animate-orb-a'} absolute bottom-[-90px] left-[14%] h-[440px] w-[440px] rounded-full opacity-85`}
          style={{
            background:
              'radial-gradient(circle, rgba(29,78,216,0.44) 0%, rgba(249,115,22,0.16) 46%, rgba(249,115,22,0) 74%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-65 dark:opacity-55"
          style={{
            background:
              'linear-gradient(125deg, rgba(255,255,255,0.24) 0%, rgba(56,189,248,0.16) 38%, rgba(255,255,255,0) 68%, rgba(59,130,246,0.16) 100%)',
          }}
        />
      </div>

      <div className="relative z-10">
        <TopBar
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          blockerActive={activeLock.active}
          onOpenBlockerPreview={handleOpenBlocker}
          onOpenAppearance={handleOpenAppearance}
          appearanceOpen={appearanceOpen}
          hasMissingPermissions={missingPermCount > 0}
          liveBannerText={liveBanner?.text ?? null}
          liveBannerSubject={liveBanner?.subject ?? null}
          onOpenLiveBanner={handleOpenLiveBanner}
        />

        {/* Floating 10-Min Pre-Slot Alert Toast */}
        {reminderToast && (
          <div className="animate-sheet-in mx-auto mt-2 max-w-md px-4">
            <div className="ios-glass-modal flex items-center justify-between gap-3 rounded-full px-4 py-2.5 text-xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <Bell className="h-4 w-4 shrink-0 text-blue-600 dark:text-sky-300" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#07142B] dark:text-white">
                    {reminderToast.title}
                  </p>
                  <p className="truncate text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                    {reminderToast.subtitle} · {reminderToast.startTime}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissReminderToast}
                aria-label="Dismiss reminder"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <main
          ref={mainRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {visitedTabs.has('timetable') && (
            <div className={activeTab === 'timetable' ? 'block' : 'hidden'}>
              <TimetableView
                slots={slots}
                isActive={activeTab === 'timetable'}
                onAddSlot={handleAddSlot}
                onUpdateSlot={handleUpdateSlot}
                onDeleteSlot={handleDeleteSlot}
                onOpenReviseLoop={setReviseLoopClassSlot}
                onOpenPlannerForTask={openPlannerTask}
              />
            </div>
          )}

          {visitedTabs.has('planner') && (
            <div className={activeTab === 'planner' ? 'block' : 'hidden'}>
              <PlannerView
                tasks={tasks}
                slots={slots}
                dailyLogs={dailyLogs}
                focusedTaskId={focusedTaskId}
                onClearFocusedTask={handleClearFocusedTask}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onReorderTasks={handleReorderTasks}
                onApproveSuggestedSlot={handleApproveSuggestedSlot}
                onToggleLinkedSlotComplete={handleToggleLinkedSlotComplete}
                onMarkLinkedSlotIncomplete={handleMarkLinkedSlotIncomplete}
                onDeleteLinkedSlot={handleDeleteSlot}
              />
            </div>
          )}

          {visitedTabs.has('day') && (
            <div className={activeTab === 'day' ? 'block' : 'hidden'}>
              <DayView
                slots={slots}
                tasks={tasks}
                dailyLogs={dailyLogs}
                activeLock={activeLock}
                onToggleSlotComplete={handleToggleSlotComplete}
                onMarkSlotIncomplete={handleMarkSlotIncomplete}
                onOpenBlockerPreview={handleOpenBlocker}
                onGoToTimetable={handleGoToTimetable}
                onOpenPlannerForTask={openPlannerTask}
              />
            </div>
          )}

          {visitedTabs.has('papers') && (
            <div className={activeTab === 'papers' ? 'block' : 'hidden'}>
              <PapersView
                papers={papers}
                onAddPaper={handleAddPaper}
                onUpdatePaper={handleUpdatePaper}
                onDeletePaper={handleDeletePaper}
                isDark={isDark}
              />
            </div>
          )}

          {visitedTabs.has('countdown') && (
            <div className={activeTab === 'countdown' ? 'block' : 'hidden'}>
              <CountdownView
                activeLock={activeLock}
                onOpenBlockerPreview={handleOpenBlocker}
                isActive={activeTab === 'countdown'}
                calmBackdrop={calmBackdrop}
              />
            </div>
          )}
        </main>

        <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />

        {blockerModalOpen && (
          <LockOverlayPreview
            open
            activeLock={activeLock}
            onStartManualLock={handleStartManualLock}
            onOpenGuidedPermissions={handleOpenPermissions}
            onClose={handleCloseBlocker}
          />
        )}

        {appearanceOpen && (
          <AppearanceSheet
            open
            transparency={glassTransparency}
            onChangeTransparency={handleChangeTransparency}
            calmBackdrop={calmBackdrop}
            onToggleCalmBackdrop={handleToggleCalmBackdrop}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
            missingPermCount={missingPermCount}
            onOpenPermissions={handleOpenPermissions}
            onClose={handleCloseAppearance}
          />
        )}

        {permissionsOpen && (
          <PermissionsSheet
            open
            initialStatus={nativePerms}
            onStatusUpdated={setNativePerms}
            onClose={handleClosePermissions}
          />
        )}

        {reviseLoopClassSlot !== null && (
          <ReviseLoopSheet
            open
            classSlot={reviseLoopClassSlot}
            allSlots={slots}
            onApproveLoop={handleApproveReviseLoop}
            onClose={() => setReviseLoopClassSlot(null)}
          />
        )}
      </div>
    </div>
  );
}
