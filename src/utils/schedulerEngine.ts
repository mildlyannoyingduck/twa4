import { DAYS_ORDER } from '../data/previewData';
import {
  DayOfWeek,
  RevisionStage,
  SlotSuggestion,
  SubjectId,
  TimePreference,
  TimetableSlot,
} from '../types';
import { getDayOfWeek } from './dateUtils';
import { formatDuration, formatTime12h, toMinutes } from './timeUtils';

export interface BusyInterval {
  startMin: number;
  endMin: number;
  kind: 'slot' | 'transit';
  slotId?: string;
}

export interface SlotTravelVisual {
  slotId: string;
  beforeStartMin: number | null;
  beforeMins: number;
  afterEndMin: number | null;
  afterMins: number;
}

export function minutesToHHMM(totalMins: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(totalMins)));
  if (clamped >= 1440) return '00:00';
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getEffectiveEndMin(slot: TimetableSlot): number {
  const s = toMinutes(slot.startTime);
  let e = toMinutes(slot.endTime);
  if (slot.endTime === '00:00' && s > 0) e = 1440;
  return Math.max(s, e);
}

export function computePhysicalTravelVisuals(
  slots: TimetableSlot[],
  day: DayOfWeek,
): Record<string, SlotTravelVisual> {
  const physicalSlots = slots
    .filter((s) => s.day === day && s.mode === 'physical')
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  const visuals: Record<string, SlotTravelVisual> = {};

  for (let i = 0; i < physicalSlots.length; i++) {
    const curr = physicalSlots[i];
    const prev = i > 0 ? physicalSlots[i - 1] : null;
    const next = i < physicalSlots.length - 1 ? physicalSlots[i + 1] : null;

    const currStart = toMinutes(curr.startTime);
    const currEnd = getEffectiveEndMin(curr);

    const chainedFromPrev =
      prev !== null && currStart - getEffectiveEndMin(prev) <= 120;
    const chainedToNext =
      next !== null && toMinutes(next.startTime) - currEnd <= 120;

    const beforeMins = chainedFromPrev ? 0 : (curr.travelBeforeMins ?? 120);
    const afterMins = chainedToNext ? 0 : (curr.travelAfterMins ?? 120);

    visuals[curr.id] = {
      slotId: curr.id,
      beforeStartMin: beforeMins > 0 ? Math.max(0, currStart - beforeMins) : null,
      beforeMins,
      afterEndMin: afterMins > 0 ? Math.min(1440, currEnd + afterMins) : null,
      afterMins,
    };
  }

  return visuals;
}

export function getDayBusyIntervals(
  slots: TimetableSlot[],
  day: DayOfWeek,
  extraBusy: BusyInterval[] = [],
): BusyInterval[] {
  const daySlots = slots.filter((s) => s.day === day);
  const travelVisuals = computePhysicalTravelVisuals(slots, day);
  const raw: BusyInterval[] = [...extraBusy];

  for (const slot of daySlots) {
    const startMin = toMinutes(slot.startTime);
    const endMin = getEffectiveEndMin(slot);
    raw.push({ startMin, endMin, kind: 'slot', slotId: slot.id });

    const tv = travelVisuals[slot.id];
    if (tv) {
      if (tv.beforeStartMin !== null && tv.beforeMins > 0) {
        raw.push({
          startMin: tv.beforeStartMin,
          endMin: startMin,
          kind: 'transit',
          slotId: slot.id,
        });
      }
      if (tv.afterEndMin !== null && tv.afterMins > 0) {
        raw.push({
          startMin: endMin,
          endMin: tv.afterEndMin,
          kind: 'transit',
          slotId: slot.id,
        });
      }
    }
  }

  if (raw.length === 0) return [];
  raw.sort((a, b) => a.startMin - b.startMin);

  const merged: BusyInterval[] = [{ ...raw[0] }];
  for (let i = 1; i < raw.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = raw[i];
    if (curr.startMin <= prev.endMin) {
      prev.endMin = Math.max(prev.endMin, curr.endMin);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

function getWindowBounds(pref: TimePreference): { min: number; max: number } {
  switch (pref) {
    case 'morning':
      return { min: 5 * 60 + 30, max: 12 * 60 };
    case 'afternoon':
      return { min: 12 * 60, max: 18 * 60 };
    case 'night':
      return { min: 18 * 60, max: 23 * 60 + 30 };
    default:
      return { min: 5 * 60 + 30, max: 23 * 60 + 30 };
  }
}

function findDayCandidates(
  slots: TimetableSlot[],
  day: DayOfWeek,
  durationMins: number,
  pref: TimePreference,
  minStartAfterMin: number = 0,
  extraBusy: BusyInterval[] = [],
): { startMin: number; endMin: number; reason: string; score: number }[] {
  const bounds = getWindowBounds(pref);
  const searchMin = Math.max(bounds.min, minStartAfterMin);
  const searchMax = bounds.max;
  if (searchMax - searchMin < durationMins) return [];

  const busy = getDayBusyIntervals(slots, day, extraBusy);
  const gaps: { start: number; end: number }[] = [];

  let cursor = searchMin;
  for (const block of busy) {
    if (block.endMin <= cursor) continue;
    if (block.startMin >= searchMax) break;
    if (block.startMin > cursor) {
      gaps.push({ start: cursor, end: Math.min(block.startMin, searchMax) });
    }
    const breather = block.kind === 'transit' ? 20 : 15;
    cursor = Math.max(cursor, block.endMin + breather);
  }
  if (cursor < searchMax) {
    gaps.push({ start: cursor, end: searchMax });
  }

  const daySlots = slots.filter((s) => s.day === day);
  const dayLoadMins = daySlots.reduce(
    (acc, s) => acc + (getEffectiveEndMin(s) - toMinutes(s.startTime)),
    0,
  );

  const candidates: { startMin: number; endMin: number; reason: string; score: number }[] = [];

  for (const gap of gaps) {
    if (gap.end - gap.start < durationMins) continue;
    const snappedStart = Math.ceil(gap.start / 5) * 5;
    const endMin = snappedStart + durationMins;
    if (endMin > gap.end) continue;

    const priorBlock = daySlots
      .filter((s) => getEffectiveEndMin(s) <= snappedStart)
      .sort((a, b) => getEffectiveEndMin(b) - getEffectiveEndMin(a))[0];

    let reason = `Free ${formatDuration(gap.end - gap.start)} window`;
    if (priorBlock) {
      reason = `Open gap after ${priorBlock.title}`;
    } else if (dayLoadMins <= 120) {
      reason = `Light study day · clean ${formatDuration(durationMins)} focus window`;
    } else if (snappedStart < 12 * 60) {
      reason = `Fresh morning window`;
    } else if (snappedStart >= 18 * 60) {
      reason = `Quiet evening focus block`;
    }

    const loadPenalty = dayLoadMins / 60;
    const score = 100 - loadPenalty * 4 - snappedStart / 180;
    candidates.push({ startMin: snappedStart, endMin, reason, score });
  }

  return candidates;
}

export function suggestSlotsForTask(options: {
  slots: TimetableSlot[];
  subject: SubjectId;
  durationMins: number;
  timePreference: TimePreference;
  autoBlockDefault: boolean;
  startFromDay?: DayOfWeek;
  now?: Date;
}): SlotSuggestion[] {
  const {
    slots,
    durationMins,
    timePreference,
    autoBlockDefault,
    now = new Date(),
  } = options;
  const todayDow = options.startFromDay ?? getDayOfWeek(now);
  const todayIdx = DAYS_ORDER.indexOf(todayDow);
  const currentMin = options.startFromDay ? 0 : now.getHours() * 60 + now.getMinutes() + 15;

  const results: SlotSuggestion[] = [];

  for (let offset = 0; offset < 7; offset++) {
    const day = DAYS_ORDER[(todayIdx + offset) % 7];
    const minAfter = offset === 0 ? currentMin : 0;
    const dayCands = findDayCandidates(slots, day, durationMins, timePreference, minAfter);

    for (const cand of dayCands) {
      results.push({
        id: `sug-${day}-${cand.startMin}-${results.length}`,
        day,
        startTime: minutesToHHMM(cand.startMin),
        endTime: minutesToHHMM(cand.endMin),
        durationMins,
        reason: offset === 0 ? `Today · ${cand.reason}` : `${day} · ${cand.reason}`,
        autoBlock: autoBlockDefault,
      });
    }
  }

  if (results.length === 0 && timePreference !== 'any') {
    return suggestSlotsForTask({ ...options, timePreference: 'any' });
  }

  const picked: SlotSuggestion[] = [];
  const usedDays = new Set<DayOfWeek>();
  for (const item of results) {
    if (picked.length >= 3) break;
    if (!usedDays.has(item.day) || results.length <= 3) {
      picked.push(item);
      usedDays.add(item.day);
    }
  }
  for (const item of results) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.id === item.id)) picked.push(item);
  }

  return picked;
}

export function suggestThreeStepRevisionLoop(options: {
  classSlot: TimetableSlot;
  allSlots: TimetableSlot[];
  r1Mins: number;
  r2Mins: number;
  r3Mins: number;
  autoBlockDefault: boolean;
}): Record<RevisionStage, SlotSuggestion> {
  const { classSlot, allSlots, r1Mins, r2Mins, r3Mins, autoBlockDefault } = options;

  const classIdx = DAYS_ORDER.indexOf(classSlot.day);
  const classEndMin = getEffectiveEndMin(classSlot);
  const afterCommuteMins =
    classSlot.mode === 'physical' ? (classSlot.travelAfterMins ?? 120) : 0;
  const r1ReadyMin = classEndMin + afterCommuteMins + 15;

  let r1Day = classSlot.day;
  let r1Cands = findDayCandidates(allSlots, r1Day, r1Mins, 'any', r1ReadyMin);
  let r1Note =
    classSlot.mode === 'physical'
      ? `After ${formatDuration(afterCommuteMins)} commute home`
      : 'Right after online class finishes';

  if (r1Cands.length === 0) {
    r1Day = DAYS_ORDER[(classIdx + 1) % 7];
    r1Cands = findDayCandidates(allSlots, r1Day, r1Mins, 'morning', 5 * 60 + 30);
    if (r1Cands.length === 0) {
      r1Cands = findDayCandidates(allSlots, r1Day, r1Mins, 'any', 0);
    }
    r1Note = 'Next morning after getting home late';
  }

  const r1Picked = r1Cands[0] ?? {
    startMin: Math.min(22 * 60, Math.max(6 * 60, r1ReadyMin)),
    endMin: Math.min(22 * 60 + r1Mins, Math.max(6 * 60, r1ReadyMin) + r1Mins),
    reason: r1Note,
  };

  const extraBusyByDay: Partial<Record<DayOfWeek, BusyInterval[]>> = {
    [r1Day]: [
      {
        startMin: r1Picked.startMin,
        endMin: r1Picked.endMin,
        kind: 'slot',
      },
    ],
  };

  const r2Day = DAYS_ORDER[(classIdx + 3) % 7];
  let r2Cands = findDayCandidates(
    allSlots,
    r2Day,
    r2Mins,
    'any',
    0,
    extraBusyByDay[r2Day] ?? [],
  );
  if (r2Cands.length === 0) {
    const fallbackDay = DAYS_ORDER[(classIdx + 4) % 7];
    r2Cands = findDayCandidates(allSlots, fallbackDay, r2Mins, 'any', 0);
  }
  const r2Picked = r2Cands[0] ?? {
    startMin: 16 * 60,
    endMin: 16 * 60 + r2Mins,
    reason: `${r2Day} · 3 days after class`,
  };
  extraBusyByDay[r2Day] = [
    ...(extraBusyByDay[r2Day] ?? []),
    { startMin: r2Picked.startMin, endMin: r2Picked.endMin, kind: 'slot' },
  ];

  const r3Day = DAYS_ORDER[(classIdx + 6) % 7];
  const r3Cands = findDayCandidates(
    allSlots,
    r3Day,
    r3Mins,
    'any',
    0,
    extraBusyByDay[r3Day] ?? [],
  );
  const r3Picked = r3Cands[0] ?? {
    startMin: 19 * 60,
    endMin: 19 * 60 + r3Mins,
    reason: `${r3Day} · Day before next class`,
  };

  return {
    r1: {
      id: `r1-${Date.now()}`,
      day: r1Day,
      startTime: minutesToHHMM(r1Picked.startMin),
      endTime: minutesToHHMM(r1Picked.endMin),
      durationMins: r1Mins,
      reason: `Quick R1 · ${r1Note} (${formatTime12h(minutesToHHMM(r1Picked.startMin))})`,
      autoBlock: autoBlockDefault,
      revisionStage: 'r1',
      note: r1Note,
    },
    r2: {
      id: `r2-${Date.now() + 1}`,
      day: r2Day,
      startTime: minutesToHHMM(r2Picked.startMin),
      endTime: minutesToHHMM(r2Picked.endMin),
      durationMins: r2Mins,
      reason: `Deep R2 (3 days later) · ${r2Picked.reason}`,
      autoBlock: autoBlockDefault,
      revisionStage: 'r2',
    },
    r3: {
      id: `r3-${Date.now() + 2}`,
      day: r3Day,
      startTime: minutesToHHMM(r3Picked.startMin),
      endTime: minutesToHHMM(r3Picked.endMin),
      durationMins: r3Mins,
      reason: `Warm-Up R3 (day before class) · ${r3Picked.reason}`,
      autoBlock: autoBlockDefault,
      revisionStage: 'r3',
    },
  };
}
