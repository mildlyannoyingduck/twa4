import { Droplets, ShieldCheck, SunMoon, X, Zap } from 'lucide-react';
import { memo } from 'react';
import { haptics } from '../utils/haptics';
import { CrystalSheet, LiquidSwitch } from './FluidControls';

interface AppearanceSheetProps {
  open: boolean;
  transparency: number;
  onChangeTransparency: (val: number) => void;
  calmBackdrop: boolean;
  onToggleCalmBackdrop: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  missingPermCount: number;
  onOpenPermissions: () => void;
  onClose: () => void;
}

const TRANSPARENCY_PRESETS = [
  { val: 0, label: '0% Solid' },
  { val: 40, label: '40% Soft' },
  { val: 72, label: '72% Frost' },
  { val: 100, label: '100% Clear' },
];

export const AppearanceSheet = memo(function AppearanceSheet({
  open,
  transparency,
  onChangeTransparency,
  calmBackdrop,
  onToggleCalmBackdrop,
  isDark,
  onToggleTheme,
  missingPermCount,
  onOpenPermissions,
  onClose,
}: AppearanceSheetProps) {
  return (
    <CrystalSheet
      open={open}
      onClose={onClose}
      zIndexClass="z-[65]"
      maxWidthClass="max-w-md"
      scrimClassName="bg-transparent sm:bg-[#061A4A]/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-cyan-300">
            Glass &amp; Galaxy A07 Performance
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#07142B] dark:text-white">
            Display &amp; Transparency
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close appearance settings"
          className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Live Mini Preview Strip over Arctic Aurora Grid */}
      <div className="relative mt-3.5 overflow-hidden rounded-[24px] border border-white/60 bg-gradient-to-br from-sky-200 via-blue-100 to-cyan-200 p-3 dark:border-sky-300/25 dark:from-[#061B54] dark:via-[#072C6E] dark:to-[#04143B]">
        <div className="arctic-grid-bg pointer-events-none absolute inset-0 opacity-85" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 -top-6 h-24 w-24 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(34,211,238,0.65) 0%, rgba(16,185,129,0.28) 55%, rgba(16,185,129,0) 75%)',
          }}
        />
        <div className="relative grid grid-cols-2 gap-2">
          <div className="ios-glass-subj-bio rounded-[18px] px-3 py-2">
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              Biology · Live
            </p>
            <p className="truncate text-xs font-semibold text-[#07142B] dark:text-white">
              Sashanka Class
            </p>
          </div>
          <div className="ios-glass-subj-phy rounded-[18px] px-3 py-2">
            <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300">
              Physics · Live
            </p>
            <p className="truncate text-xs font-semibold text-[#07142B] dark:text-white">
              Paper Practice
            </p>
          </div>
        </div>
      </div>

      {/* 0–100% Transparency Slider Card */}
      <div className="ios-glass-control mt-3 rounded-[26px] p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#07142B] dark:text-white">
            <Droplets className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
            <span>Card Transparency</span>
          </span>
          <span className="tabular-nums text-sm font-bold text-blue-700 dark:text-cyan-300">
            {transparency}%
          </span>
        </div>

        <p className="mt-1 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
          {transparency === 0
            ? '0% Solid cards · opaque contrast & zero background bleed'
            : transparency >= 90
              ? 'Ultra-clear crystal prism · subtle specular frames'
              : 'Live surface transparency — updates instantly as you slide'}
        </p>

        <div className="mt-3.5 flex items-center gap-3">
          <span className="tabular-nums text-[10px] font-semibold text-[#0B234A]/65 dark:text-sky-200/70">
            Solid
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={transparency}
            aria-label="Adjust card transparency from 0 to 100 percent"
            onInput={(e) => onChangeTransparency(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => onChangeTransparency(Number(e.target.value))}
            className="h-3 w-full cursor-pointer accent-blue-600 dark:accent-cyan-400"
          />
          <span className="tabular-nums text-[10px] font-semibold text-[#0B234A]/65 dark:text-sky-200/70">
            Clear
          </span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {TRANSPARENCY_PRESETS.map((p) => {
            const active = Math.abs(transparency - p.val) <= 2;
            return (
              <button
                key={p.val}
                type="button"
                onClick={() => {
                  haptics.tick();
                  onChangeTransparency(p.val);
                }}
                className={`min-h-[36px] rounded-full px-2 text-[11px] font-semibold transition-colors duration-150 active:scale-95 ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                    : 'bg-blue-500/12 text-[#0B234A]/80 dark:text-sky-100/85'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* A07 60fps Max Optimization Toggle */}
      <div className="ios-glass-control mt-3 flex items-center justify-between gap-3 rounded-[24px] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#07142B] dark:text-white">
            <Zap className="h-3.5 w-3.5 text-emerald-500" />
            <span>A07 Max 60fps Mode</span>
          </p>
          <p className="mt-0.5 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
            Locks backdrop &amp; removes heavy GPU blurs for zero lag or blink
          </p>
        </div>
        <LiquidSwitch
          checked={calmBackdrop}
          onToggle={onToggleCalmBackdrop}
          ariaLabel="Toggle A07 Max 60fps Mode"
          activeColorClass="bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.4)]"
        />
      </div>

      {/* Dark / Light Theme Quick Row */}
      <div className="ios-glass-control mt-3 flex items-center justify-between gap-3 rounded-[24px] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#07142B] dark:text-white">
            <SunMoon className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-300" />
            <span>Night Arctic Mode</span>
          </p>
          <p className="mt-0.5 text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
            Deep sapphire night canvas for late-night past paper sessions
          </p>
        </div>
        <LiquidSwitch
          checked={isDark}
          onToggle={onToggleTheme}
          ariaLabel="Toggle Night Arctic Mode"
        />
      </div>

      {/* Permissions Check Shortcut */}
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          onClose();
          onOpenPermissions();
        }}
        className="ios-glass-control mt-3 flex min-h-[46px] w-full items-center justify-between rounded-full px-4 text-xs font-semibold transition-transform duration-100 active:scale-[0.98]"
      >
        <span className="inline-flex items-center gap-2 text-[#07142B] dark:text-white">
          <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-cyan-300" />
          <span>Phone Lock &amp; Alarm Permissions</span>
        </span>
        <span
          className={
            missingPermCount > 0
              ? 'text-orange-600 dark:text-orange-300'
              : 'text-emerald-600 dark:text-emerald-300'
          }
        >
          {missingPermCount > 0 ? `${missingPermCount} Missing` : 'All Set'}
        </span>
      </button>
    </CrystalSheet>
  );
});
