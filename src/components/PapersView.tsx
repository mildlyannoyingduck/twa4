import { Award, Plus, Trash2, TrendingUp, X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { SUBJECT_META } from '../data/previewData';
import { PaperEntry, PaperFormat, SubjectId } from '../types';
import { getTodayISO } from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import { CrystalSheet } from './FluidControls';

interface PapersViewProps {
  papers: PaperEntry[];
  onAddPaper: (entry: PaperEntry) => void;
  onUpdatePaper: (entry: PaperEntry) => void;
  onDeletePaper: (paperId: string) => void;
  isDark: boolean;
}

const CLASS_OPTIONS_BY_SUBJECT: Record<SubjectId, string[]> = {
  biology: ['Sashanka Dhanujaya · Paper', 'Past Paper', 'School Term Test'],
  physics: ['Sujith Liyanage · Paper', 'Samitha Rathnayake · Revision', 'Past Paper', 'School Term Test'],
  chemistry: ['Amila Dasanayake · Paper', 'Past Paper', 'School Term Test'],
};

const SUBJECT_GLASS_SURFACE: Record<SubjectId, string> = {
  biology: 'ios-glass-subj-bio',
  physics: 'ios-glass-subj-phy',
  chemistry: 'ios-glass-subj-chem',
};

const SUBJECT_ACTIVE_BTN: Record<SubjectId, string> = {
  biology: 'bg-emerald-600/92 text-white shadow-lg shadow-emerald-600/25 dark:bg-emerald-500/92',
  physics: 'bg-orange-600/92 text-white shadow-lg shadow-orange-600/25 dark:bg-orange-500/92',
  chemistry: 'bg-blue-600/92 text-white shadow-lg shadow-blue-600/25 dark:bg-blue-500/92',
};

type SeriesMode = 'combined' | 'part1' | 'part2';

function buildSmoothSpline(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    path += ` C ${midX.toFixed(1)} ${p0.y.toFixed(1)}, ${midX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return path;
}

function getGradeLabel(pct: number): { grade: string; note: string } {
  if (pct >= 75) return { grade: 'A', note: 'Distinction Zone' };
  if (pct >= 65) return { grade: 'B', note: `${75 - pct}% to Grade A` };
  if (pct >= 55) return { grade: 'C', note: `${75 - pct}% to Grade A` };
  if (pct >= 35) return { grade: 'S', note: 'Pass Band' };
  return { grade: '—', note: 'Log marks to track' };
}

export const PapersView = memo(function PapersView({
  papers,
  onAddPaper,
  onUpdatePaper,
  onDeletePaper,
  isDark,
}: PapersViewProps) {
  const [subjectFilter, setSubjectFilter] = useState<SubjectId>('biology');
  const [seriesMode, setSeriesMode] = useState<SeriesMode>('combined');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);

  const [paperName, setPaperName] = useState('');
  const [formSubject, setFormSubject] = useState<SubjectId>('biology');
  const [formClass, setFormClass] = useState<string>(CLASS_OPTIONS_BY_SUBJECT.biology[0]);
  const [formDate, setFormDate] = useState<string>(getTodayISO());
  const [formFormat, setFormFormat] = useState<PaperFormat>('both');
  const [part1Score, setPart1Score] = useState('');
  const [part1Max, setPart1Max] = useState('50');
  const [part2Score, setPart2Score] = useState('');
  const [part2Max, setPart2Max] = useState('100');
  const [formNote, setFormNote] = useState('');

  const filteredPapers = useMemo(() => {
    return papers
      .filter((p) => p.subject === subjectFilter)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [papers, subjectFilter]);

  const chartPoints = useMemo(() => {
    return filteredPapers
      .map((p) => {
        let value: number | null = p.combinedPercent;
        if (seriesMode === 'part1') {
          value =
            p.part1Score !== undefined && p.part1Max
              ? Math.round((p.part1Score / p.part1Max) * 100)
              : null;
        } else if (seriesMode === 'part2') {
          value =
            p.part2Score !== undefined && p.part2Max
              ? Math.round((p.part2Score / p.part2Max) * 100)
              : null;
        }
        return value !== null ? { paper: p, value } : null;
      })
      .filter((item): item is { paper: PaperEntry; value: number } => item !== null);
  }, [filteredPapers, seriesMode]);

  const activePoint =
    chartPoints.find((pt) => pt.paper.id === selectedPointId) ??
    chartPoints[chartPoints.length - 1] ??
    null;

  const avgPercent = chartPoints.length
    ? Math.round(chartPoints.reduce((acc, p) => acc + p.value, 0) / chartPoints.length)
    : 0;
  const bestPercent = chartPoints.length
    ? Math.max(...chartPoints.map((p) => p.value))
    : 0;
  const latestDelta =
    chartPoints.length >= 2
      ? chartPoints[chartPoints.length - 1].value - chartPoints[chartPoints.length - 2].value
      : 0;

  // Part I vs Part II average split across filtered papers
  const { p1Avg, p2Avg } = useMemo(() => {
    const p1List = filteredPapers
      .filter((p) => p.part1Score !== undefined && p.part1Max)
      .map((p) => Math.round(((p.part1Score ?? 0) / (p.part1Max || 50)) * 100));
    const p2List = filteredPapers
      .filter((p) => p.part2Score !== undefined && p.part2Max)
      .map((p) => Math.round(((p.part2Score ?? 0) / (p.part2Max || 100)) * 100));

    return {
      p1Avg: p1List.length ? Math.round(p1List.reduce((a, b) => a + b, 0) / p1List.length) : 0,
      p2Avg: p2List.length ? Math.round(p2List.reduce((a, b) => a + b, 0) / p2List.length) : 0,
    };
  }, [filteredPapers]);

  const gradeInfo = chartPoints.length > 0 ? getGradeLabel(avgPercent) : getGradeLabel(0);

  const meta = SUBJECT_META[subjectFilter];
  const strokeColor = isDark ? meta.strokeDarkHex : meta.strokeHex;

  const svgW = 540;
  const svgH = 216;
  const padL = 38;
  const padR = 18;
  const padT = 18;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const mappedCoords = chartPoints.map((pt, idx) => {
    const x =
      chartPoints.length === 1
        ? padL + plotW / 2
        : padL + (idx / (chartPoints.length - 1)) * plotW;
    const y = padT + (1 - pt.value / 100) * plotH;
    return { ...pt, x, y };
  });

  const activeCoord =
    mappedCoords.find((pt) => pt.paper.id === activePoint?.paper.id) ?? null;

  const smoothLinePath = buildSmoothSpline(mappedCoords);
  const areaPath =
    mappedCoords.length > 1
      ? `${smoothLinePath} L ${mappedCoords[mappedCoords.length - 1].x.toFixed(1)} ${(
          padT + plotH
        ).toFixed(1)} L ${mappedCoords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const aGradeTopY = padT;
  const aGradeBottomY = padT + (1 - 75 / 100) * plotH;

  const openNewPaperModal = () => {
    haptics.tap();
    setEditingPaperId(null);
    setPaperName('');
    setFormSubject(subjectFilter);
    setFormClass(CLASS_OPTIONS_BY_SUBJECT[subjectFilter][0]);
    setFormDate(getTodayISO());
    setFormFormat('both');
    setPart1Score('');
    setPart1Max('50');
    setPart2Score('');
    setPart2Max('100');
    setFormNote('');
    setSheetOpen(true);
  };

  const openEditPaperModal = (entry: PaperEntry) => {
    haptics.tap();
    setEditingPaperId(entry.id);
    setPaperName(entry.paperName);
    setFormSubject(entry.subject);
    setFormClass(entry.classLabel);
    setFormDate(entry.date);
    setFormFormat(entry.format);
    setPart1Score(entry.part1Score !== undefined ? String(entry.part1Score) : '');
    setPart1Max(entry.part1Max !== undefined ? String(entry.part1Max) : '50');
    setPart2Score(entry.part2Score !== undefined ? String(entry.part2Score) : '');
    setPart2Max(entry.part2Max !== undefined ? String(entry.part2Max) : '100');
    setFormNote(entry.note ?? '');
    setSheetOpen(true);
  };

  const handleSubjectInFormChange = (subj: SubjectId) => {
    haptics.tick();
    setFormSubject(subj);
    setFormClass(CLASS_OPTIONS_BY_SUBJECT[subj][0]);
  };

  const handleSavePaper = () => {
    haptics.success();
    const p1 = Number(part1Score) || 0;
    const p1Max = Math.max(1, Number(part1Max) || 50);
    const p2 = Number(part2Score) || 0;
    const p2Max = Math.max(1, Number(part2Max) || 100);

    let combined = 0;
    if (formFormat === 'both') {
      combined = Math.round(((p1 / p1Max) * 100 + (p2 / p2Max) * 100) / 2);
    } else if (formFormat === 'part1') {
      combined = Math.round((p1 / p1Max) * 100);
    } else {
      combined = Math.round((p2 / p2Max) * 100);
    }

    const entry: PaperEntry = {
      id: editingPaperId ?? `paper-${Date.now()}`,
      paperName: paperName.trim() || `${SUBJECT_META[formSubject].short} Paper`,
      subject: formSubject,
      classLabel: formClass,
      date: formDate || getTodayISO(),
      format: formFormat,
      part1Score: formFormat !== 'part2' ? p1 : undefined,
      part1Max: formFormat !== 'part2' ? p1Max : undefined,
      part2Score: formFormat !== 'part1' ? p2 : undefined,
      part2Max: formFormat !== 'part1' ? p2Max : undefined,
      combinedPercent: Math.min(100, Math.max(0, combined)),
      note: formNote.trim() || undefined,
    };

    if (editingPaperId) {
      onUpdatePaper(entry);
    } else {
      onAddPaper(entry);
    }

    setSubjectFilter(formSubject);
    setSelectedPointId(entry.id);
    setSheetOpen(false);
  };

  const chartAnimKey = `${subjectFilter}-${seriesMode}-${mappedCoords.length}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#07142B] dark:text-white">
            Papers
          </h1>
          <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
            Spectral trend analytics &amp; Part I / II scores
          </p>
        </div>

        <button
          type="button"
          onClick={openNewPaperModal}
          className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0 ${SUBJECT_ACTIVE_BTN[subjectFilter]}`}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Marks</span>
        </button>
      </div>

      <div className="ios-glass relative mt-4 grid grid-cols-3 gap-1 rounded-full p-1">
        {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
          const item = SUBJECT_META[subj];
          const active = subjectFilter === subj;
          return (
            <button
              key={subj}
              type="button"
              onClick={() => {
                haptics.tick();
                setSubjectFilter(subj);
                setSelectedPointId(null);
              }}
              className={`min-h-[40px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                active ? SUBJECT_ACTIVE_BTN[subj] : item.text
              }`}
            >
              {item.name}
            </button>
          );
        })}
      </div>

      {/* Bento Analytics Grid */}
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        {/* Left Main Chart */}
        <section
          className={`flex flex-col justify-between rounded-[34px] border p-5 transition-colors duration-200 sm:p-6 lg:col-span-8 ${SUBJECT_GLASS_SURFACE[subjectFilter]}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {activePoint ? (
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className={`tabular-nums text-3xl font-bold ${meta.text}`}>
                    {activePoint.value}%
                  </span>
                  <span className="text-xs font-semibold text-[#07142B] dark:text-sky-50">
                    {activePoint.paper.paperName}
                  </span>
                  <span className="text-[11px] text-[#0B234A]/65 dark:text-sky-200/70">
                    {activePoint.paper.date}
                  </span>
                </div>
              ) : (
                <span className={`text-xs font-semibold ${meta.text}`}>
                  {meta.name} Progress
                </span>
              )}
            </div>

            <div className="ios-glass relative flex items-center gap-1 rounded-full p-1">
              {(
                [
                  { id: 'combined', label: 'All' },
                  { id: 'part1', label: 'Part I' },
                  { id: 'part2', label: 'Part II' },
                ] as { id: SeriesMode; label: string }[]
              ).map((mode) => {
                const active = seriesMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setSeriesMode(mode.id);
                    }}
                    className={`min-h-[30px] rounded-full px-3 text-[11px] font-semibold transition-colors duration-150 ${
                      active
                        ? SUBJECT_ACTIVE_BTN[subjectFilter]
                        : 'text-[#0B234A]/70 dark:text-sky-100/80'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            {mappedCoords.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-[#0B234A]/65 dark:text-sky-200/70">
                No {meta.name} papers logged yet — tap Add Marks to start tracking.
              </div>
            ) : (
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-auto w-full overflow-visible">
                <defs>
                  <linearGradient id={`glassGrad-${subjectFilter}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Distinction A-Grade Zone (75% - 100%) */}
                <rect
                  x={padL}
                  y={aGradeTopY}
                  width={plotW}
                  height={aGradeBottomY - aGradeTopY}
                  rx={10}
                  fill="#10B981"
                  fillOpacity={isDark ? 0.08 : 0.07}
                />

                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = padT + (1 - tick / 100) * plotH;
                  const isAGrade = tick === 75;
                  return (
                    <g key={tick}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={svgW - padR}
                        y2={y}
                        stroke="currentColor"
                        strokeDasharray={isAGrade ? '5 3' : '3 4'}
                        className={
                          isAGrade
                            ? 'text-emerald-500/55 dark:text-emerald-300/45'
                            : 'text-blue-500/20 dark:text-sky-200/15'
                        }
                      />
                      <text
                        x={padL - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        className={`tabular-nums text-[10px] ${
                          isAGrade
                            ? 'fill-emerald-700 font-semibold dark:fill-emerald-300'
                            : 'fill-[#0B234A]/60 dark:fill-sky-200/65'
                        }`}
                      >
                        {isAGrade ? '75 A' : `${tick}%`}
                      </text>
                    </g>
                  );
                })}

                {/* Interactive Crosshair Guideline on Active Score */}
                {activeCoord && (
                  <line
                    x1={activeCoord.x}
                    y1={padT}
                    x2={activeCoord.x}
                    y2={padT + plotH}
                    stroke={strokeColor}
                    strokeOpacity="0.4"
                    strokeDasharray="3 3"
                  />
                )}

                {areaPath && (
                  <path
                    d={areaPath}
                    fill={`url(#glassGrad-${subjectFilter})`}
                  />
                )}

                {mappedCoords.length > 1 && (
                  <path
                    d={smoothLinePath}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                )}

                {mappedCoords.map((pt) => {
                  const isActive = activePoint?.paper.id === pt.paper.id;
                  return (
                    <g
                      key={pt.paper.id}
                      className="cursor-pointer"
                      onClick={() => {
                        haptics.tick();
                        setSelectedPointId(pt.paper.id);
                      }}
                    >
                      {isActive && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={11}
                          fill="none"
                          stroke={strokeColor}
                          strokeOpacity={0.38}
                          strokeWidth={1.8}
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? 6.5 : 4.5}
                        fill={isDark ? '#061028' : '#FFFFFF'}
                        stroke={strokeColor}
                        strokeWidth={isActive ? 3 : 2.2}
                      />
                      <text
                        x={pt.x}
                        y={svgH - 6}
                        textAnchor="middle"
                        className="fill-[#0B234A]/75 text-[10px] dark:fill-sky-100/80"
                      >
                        {pt.paper.paperName.replace(`${meta.short} `, '').slice(0, 11)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </section>

        {/* Right Analytics Telemetry Bento Deck */}
        <div className="flex flex-col justify-between gap-4 lg:col-span-4">
          {/* Projected Grade Band Card */}
          <section className="ios-glass-strong flex items-center justify-between gap-4 rounded-[32px] p-5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                <Award className={`h-3.5 w-3.5 ${meta.text}`} />
                <span>Projected Band</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2.5">
                <span className={`font-brand text-4xl font-bold ${meta.text}`}>
                  {gradeInfo.grade}
                </span>
                <span className="text-xs font-medium text-[#07142B] dark:text-sky-50">
                  {gradeInfo.note}
                </span>
              </div>
            </div>

            <div className="text-right tabular-nums">
              <p className="text-xs text-[#0B234A]/70 dark:text-sky-200/75">Average</p>
              <p className="text-2xl font-bold text-[#07142B] dark:text-white">
                {avgPercent}%
              </p>
            </div>
          </section>

          {/* Momentum & Best Card */}
          <section className="ios-glass grid grid-cols-2 divide-x divide-white/35 rounded-[30px] py-4 text-center dark:divide-sky-300/18">
            <div>
              <p className="tabular-nums text-xl font-bold text-[#07142B] dark:text-white">
                {bestPercent}%
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Peak Score</p>
            </div>
            <div>
              <p
                className={`tabular-nums inline-flex items-center justify-center gap-1 text-xl font-bold ${
                  latestDelta >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-orange-600 dark:text-orange-300'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>{latestDelta >= 0 ? `+${latestDelta}%` : `${latestDelta}%`}</span>
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Last Change</p>
            </div>
          </section>

          {/* Part I MCQ vs Part II Essay Split */}
          <section className="ios-glass flex flex-1 flex-col justify-between gap-3 rounded-[32px] p-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#07142B] dark:text-white">
                Part I vs Part II Balance
              </span>
              <span className="tabular-nums text-[#0B234A]/70 dark:text-sky-200/75">
                {filteredPapers.length} papers
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] text-[#0B234A]/75 dark:text-sky-100/80">
                  <span>Part I · MCQ</span>
                  <span className="tabular-nums font-semibold">{p1Avg}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                  <div
                    style={{ width: `${p1Avg}%` }}
                    className={`h-full rounded-full transition-[width] duration-300 ease-out ${meta.bar}`}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#0B234A]/75 dark:text-sky-100/80">
                  <span>Part II · Structured / Essay</span>
                  <span className="tabular-nums font-semibold">{p2Avg}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                  <div
                    style={{ width: `${p2Avg}%` }}
                    className={`h-full rounded-full transition-[width] duration-300 ease-out ${meta.bar}`}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* 2-Column Paper Archive Grid */}
      {filteredPapers.length > 0 && (
        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...filteredPapers].reverse().map((entry) => {
            const p1Pct =
              entry.part1Score !== undefined && entry.part1Max
                ? Math.round((entry.part1Score / entry.part1Max) * 100)
                : null;
            const p2Pct =
              entry.part2Score !== undefined && entry.part2Max
                ? Math.round((entry.part2Score / entry.part2Max) * 100)
                : null;

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => openEditPaperModal(entry)}
                className={`flex flex-col justify-between gap-3 rounded-[28px] border p-5 text-left transition-transform duration-100 active:scale-[0.985] ${SUBJECT_GLASS_SURFACE[entry.subject]}`}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#07142B] dark:text-white">
                      {entry.paperName}
                    </p>
                    <p className="tabular-nums mt-0.5 truncate text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                      {entry.classLabel} · {entry.date}
                    </p>
                  </div>
                  <span className={`tabular-nums shrink-0 text-2xl font-bold ${meta.text}`}>
                    {entry.combinedPercent}%
                  </span>
                </div>

                {(p1Pct !== null || p2Pct !== null) && (
                  <div className="grid w-full grid-cols-2 gap-3 border-t border-white/30 pt-2.5 text-[11px] dark:border-sky-300/15">
                    {p1Pct !== null && (
                      <div>
                        <div className="flex justify-between text-[#0B234A]/75 dark:text-sky-100/80">
                          <span>P1</span>
                          <span className="tabular-nums font-semibold">
                            {entry.part1Score}/{entry.part1Max}
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                          <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${p1Pct}%` }} />
                        </div>
                      </div>
                    )}
                    {p2Pct !== null && (
                      <div>
                        <div className="flex justify-between text-[#0B234A]/75 dark:text-sky-100/80">
                          <span>P2</span>
                          <span className="tabular-nums font-semibold">
                            {entry.part2Score}/{entry.part2Max}
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                          <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${p2Pct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </section>
      )}

      <CrystalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} maxWidthClass="max-w-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#07142B] dark:text-white">
            {editingPaperId ? 'Edit Paper Marks' : 'Add Paper Marks'}
          </h2>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            aria-label="Close add marks modal"
            className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Paper Name
            </label>
            <input
              type="text"
              value={paperName}
              onChange={(e) => setPaperName(e.target.value)}
              placeholder="e.g., Bio Paper 17 or 2023 A/L"
              className="ios-glass-control mt-1 min-h-[44px] w-full rounded-full px-4 text-sm text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none dark:text-white dark:placeholder:text-sky-200/45"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Subject &amp; Class
            </label>
            <div className="ios-glass-control relative mt-1 grid grid-cols-3 gap-1 rounded-full p-1">
              {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
                const item = SUBJECT_META[subj];
                const active = formSubject === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => handleSubjectInFormChange(subj)}
                    className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active ? SUBJECT_ACTIVE_BTN[subj] : item.text
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            <select
              value={formClass}
              onChange={(e) => setFormClass(e.target.value)}
              className="ios-glass-control mt-2 min-h-[44px] w-full rounded-full px-4 text-sm text-[#07142B] focus:outline-none dark:text-white"
            >
              {CLASS_OPTIONS_BY_SUBJECT[formSubject].map((cls) => (
                <option
                  key={cls}
                  value={cls}
                  className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                >
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Paper Mode
            </label>
            <div className="ios-glass-control relative mt-1 grid grid-cols-3 gap-1 rounded-full p-1">
              {(
                [
                  { id: 'both', label: 'Paper I & II' },
                  { id: 'part1', label: 'Paper I Only' },
                  { id: 'part2', label: 'Paper II Only' },
                ] as { id: PaperFormat; label: string }[]
              ).map((opt) => {
                const active = formFormat === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setFormFormat(opt.id);
                    }}
                    className={`min-h-[36px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? SUBJECT_ACTIVE_BTN[formSubject]
                        : 'text-[#0B234A]/75 dark:text-sky-200/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {formFormat !== 'part2' && (
            <div className="ios-glass-control grid grid-cols-2 gap-3 rounded-[26px] p-3.5">
              <div>
                <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Paper I Score
                </label>
                <input
                  type="number"
                  value={part1Score}
                  onChange={(e) => setPart1Score(e.target.value)}
                  placeholder="0"
                  className="ios-glass-control tabular-nums mt-1 min-h-[40px] w-full rounded-full px-3.5 text-sm text-[#07142B] focus:outline-none dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Out Of
                </label>
                <input
                  type="number"
                  value={part1Max}
                  onChange={(e) => setPart1Max(e.target.value)}
                  className="ios-glass-control tabular-nums mt-1 min-h-[40px] w-full rounded-full px-3.5 text-sm text-[#07142B] focus:outline-none dark:text-white"
                />
              </div>
            </div>
          )}

          {formFormat !== 'part1' && (
            <div className="ios-glass-control grid grid-cols-2 gap-3 rounded-[26px] p-3.5">
              <div>
                <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Paper II Score
                </label>
                <input
                  type="number"
                  value={part2Score}
                  onChange={(e) => setPart2Score(e.target.value)}
                  placeholder="0"
                  className="ios-glass-control tabular-nums mt-1 min-h-[40px] w-full rounded-full px-3.5 text-sm text-[#07142B] focus:outline-none dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Out Of
                </label>
                <input
                  type="number"
                  value={part2Max}
                  onChange={(e) => setPart2Max(e.target.value)}
                  className="ios-glass-control tabular-nums mt-1 min-h-[40px] w-full rounded-full px-3.5 text-sm text-[#07142B] focus:outline-none dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                Date
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="ios-glass-control tabular-nums mt-1 min-h-[42px] w-full rounded-full px-3.5 text-xs text-[#07142B] focus:outline-none dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                Note (Optional)
              </label>
              <input
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Mistakes..."
                className="ios-glass-control mt-1 min-h-[42px] w-full rounded-full px-3.5 text-xs text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none dark:text-white dark:placeholder:text-sky-200/45"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          {editingPaperId && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onDeletePaper(editingPaperId);
                setSheetOpen(false);
              }}
              className="ios-glass-control inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full px-5 text-xs font-semibold text-orange-600 transition-transform duration-100 active:scale-95 dark:text-orange-300"
            >
              <Trash2 className="h-4 w-4" />
              <span>Remove</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSavePaper}
            className={`min-h-[48px] flex-1 rounded-full text-sm font-semibold transition-transform duration-100 active:scale-[0.98] ${SUBJECT_ACTIVE_BTN[formSubject]}`}
          >
            {editingPaperId ? 'Save Changes' : 'Save Marks'}
          </button>
        </div>
      </CrystalSheet>
    </div>
  );
});
