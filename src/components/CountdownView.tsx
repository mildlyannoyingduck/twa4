import { CalendarCheck2, Lock, ShieldCheck } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { ActiveLockInfo } from '../types';
import { haptics } from '../utils/haptics';
import { getExamCountdown } from '../utils/timeUtils';

interface CountdownViewProps {
  activeLock: ActiveLockInfo;
  onOpenBlockerPreview: () => void;
  isActive?: boolean;
  calmBackdrop?: boolean;
}

export const CountdownView = memo(function CountdownView({
  activeLock,
  onOpenBlockerPreview,
  isActive = true,
  calmBackdrop = true,
}: CountdownViewProps) {
  const [countdown, setCountdown] = useState(() => getExamCountdown());

  useEffect(() => {
    if (!isActive) return;
    const update = () => {
      if (!document.hidden) {
        setCountdown(getExamCountdown());
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    const onVis = () => {
      if (!document.hidden) setCountdown(getExamCountdown());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isActive]);

  const ringRadius = 108;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset =
    ringCircumference - (countdown.prepProgressPercent / 100) * ringCircumference;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pt-6">
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        {/* Main Spatial Observatory Ring Bento */}
        <section className="ios-glass-strong relative flex flex-col justify-between overflow-hidden rounded-[38px] p-6 sm:p-8 lg:col-span-7">
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full opacity-85 ${
              isActive && !calmBackdrop ? 'animate-orb-a' : ''
            }`}
            style={{
              background:
                'radial-gradient(circle, rgba(59,130,246,0.48) 0%, rgba(59,130,246,0) 70%)',
            }}
          />
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute -bottom-24 right-[-20px] h-72 w-72 rounded-full opacity-75 ${
              isActive && !calmBackdrop ? 'animate-orb-b' : ''
            }`}
            style={{
              background:
                'radial-gradient(circle, rgba(34,211,238,0.38) 0%, rgba(34,211,238,0) 70%)',
            }}
          />

          <div className="relative flex flex-wrap items-center justify-between gap-2 text-xs text-[#0B234A]/75 dark:text-sky-100/80">
            <span className="font-semibold tracking-tight text-[#07142B] dark:text-white">
              G.C.E. A/L Biology Exam
            </span>
            <span className="tabular-nums">August 3 – 28, 2027 · SLST</span>
          </div>

          <div className="relative my-4 flex flex-col items-center justify-center py-2">
            <div className="relative flex h-[272px] w-[272px] items-center justify-center sm:h-[296px] sm:w-[296px]">
              {/* Outer Precision Tick Horizon */}
              <svg
                viewBox="0 0 280 280"
                className={`pointer-events-none absolute inset-0 h-full w-full opacity-65 ${
                  isActive && !calmBackdrop ? 'animate-spin-cw' : ''
                }`}
                aria-hidden="true"
              >
                <circle
                  cx="140"
                  cy="140"
                  r="134"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="24 18 8 18"
                  className="text-sky-500/45 dark:text-cyan-300/40"
                />
              </svg>

              {/* Inner Counter-Rotating Halo */}
              <svg
                viewBox="0 0 280 280"
                className={`pointer-events-none absolute inset-0 h-full w-full opacity-55 ${
                  isActive && !calmBackdrop ? 'animate-spin-ccw' : ''
                }`}
                aria-hidden="true"
              >
                <circle
                  cx="140"
                  cy="140"
                  r="90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeDasharray="8 12"
                  className="text-blue-600/35 dark:text-sky-200/30"
                />
              </svg>

              {/* Primary Prep Progress Ring */}
              <svg
                viewBox="0 0 260 260"
                className="h-full w-full -rotate-90 p-2"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="orbitalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="52%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#34D399" />
                  </linearGradient>
                </defs>
                <circle
                  cx="130"
                  cy="130"
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-blue-500/15 dark:text-sky-300/12"
                />
                <circle
                  cx="130"
                  cy="130"
                  r={ringRadius}
                  fill="none"
                  stroke="url(#orbitalGrad)"
                  strokeWidth="8.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-[stroke-dashoffset] duration-500 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-medium tracking-wide text-[#0B234A]/65 dark:text-sky-200/75">
                  Days Remaining
                </span>
                <span className="font-brand tabular-nums mt-1 bg-gradient-to-b from-[#07142B] via-blue-800 to-cyan-600 bg-clip-text text-6xl font-bold tracking-tight text-transparent dark:from-white dark:via-sky-100 dark:to-cyan-300 sm:text-7xl">
                  {countdown.days}
                </span>
                <span className="tabular-nums mt-2 text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/80">
                  {countdown.prepProgressPercent}% prep elapsed
                </span>
              </div>
            </div>

            <div className="ios-glass-tile mt-5 grid w-full max-w-md grid-cols-3 divide-x divide-white/40 rounded-[28px] py-3.5 text-center dark:divide-sky-300/20">
              <div>
                <p className="tabular-nums text-2xl font-bold text-[#07142B] dark:text-white sm:text-3xl">
                  {String(countdown.hours).padStart(2, '0')}
                </p>
                <p className="text-[11px] text-[#0B234A]/65 dark:text-sky-200/75">hours</p>
              </div>
              <div>
                <p className="tabular-nums text-2xl font-bold text-[#07142B] dark:text-white sm:text-3xl">
                  {String(countdown.minutes).padStart(2, '0')}
                </p>
                <p className="text-[11px] text-[#0B234A]/65 dark:text-sky-200/75">minutes</p>
              </div>
              <div>
                <p className="tabular-nums text-2xl font-bold text-blue-600 dark:text-cyan-300 sm:text-3xl">
                  {String(countdown.seconds).padStart(2, '0')}
                </p>
                <p className="text-[11px] text-[#0B234A]/65 dark:text-sky-200/75">seconds</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Horizon & Study Runway Bento Deck */}
        <div className="flex flex-col justify-between gap-4 lg:col-span-5">
          {/* Prep Horizon Bar Card */}
          <section className="ios-glass-strong rounded-[34px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
                <h2 className="text-sm font-semibold text-[#07142B] dark:text-white">
                  2027 Preparation Horizon
                </h2>
              </div>
              <span className="tabular-nums text-xs font-bold text-blue-700 dark:text-cyan-300">
                {countdown.prepProgressPercent}%
              </span>
            </div>

            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-blue-500/15 p-0.5 dark:bg-sky-300/15">
              <div
                style={{ width: `${countdown.prepProgressPercent}%` }}
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 transition-[width] duration-500 ease-out"
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
              <span>Prep Timeline Start</span>
              <span>First Paper · Aug 3, 2027</span>
            </div>
          </section>

          {/* 3-Metric Study Runway Bento */}
          <section className="ios-glass grid grid-cols-3 divide-x divide-white/40 rounded-[32px] py-5 text-center dark:divide-sky-300/18">
            <div className="px-2">
              <p className="tabular-nums text-2xl font-bold text-[#07142B] dark:text-white">
                {countdown.weeks}
              </p>
              <p className="mt-0.5 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                Weeks Left
              </p>
            </div>
            <div className="px-2">
              <p className="tabular-nums text-2xl font-bold text-blue-700 dark:text-cyan-300">
                {countdown.weekends}
              </p>
              <p className="mt-0.5 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                Weekends
              </p>
            </div>
            <div className="px-2">
              <p className="tabular-nums text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {countdown.totalHours.toLocaleString()}
              </p>
              <p className="mt-0.5 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                Total Hours
              </p>
            </div>
          </section>

          {/* Galaxy A07 Focus Shield Launchpad Bento */}
          <section className="ios-glass flex flex-1 flex-col justify-between gap-4 rounded-[34px] p-5 sm:p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#07142B] dark:text-white">
                  Galaxy A07 Focus Shield
                </h2>
                <span
                  className={`text-xs font-semibold ${
                    activeLock.active
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-blue-700 dark:text-cyan-300'
                  }`}
                >
                  {activeLock.active ? 'Enforcing Lock' : 'Standing By'}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#0B234A]/75 dark:text-sky-100/80">
                {activeLock.active
                  ? `${activeLock.reason} · Strict phone lock active until ${activeLock.untilTimeLabel}.`
                  : 'Locks distracting apps only during Class & Self-Study blocks—automatically unlocked during 2h physical commutes.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenBlockerPreview();
              }}
              className={`inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full text-xs font-semibold shadow-lg transition-transform duration-100 active:scale-[0.98] ${
                activeLock.active
                  ? 'bg-emerald-600 text-white shadow-emerald-600/25 dark:bg-emerald-500'
                  : 'bg-blue-600 text-white shadow-blue-600/25 dark:bg-blue-500'
              }`}
            >
              {activeLock.active ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              <span>
                {activeLock.active
                  ? `Locked Until ${activeLock.untilTimeLabel}`
                  : 'Configure or Start Strict Lock'}
              </span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
});
