import { Droplets, Moon, Shield, ShieldCheck, Sun } from 'lucide-react';
import { memo } from 'react';
import { SUBJECT_META } from '../data/previewData';
import { SubjectId } from '../types';
import { haptics } from '../utils/haptics';

interface TopBarProps {
  isDark: boolean;
  onToggleTheme: () => void;
  blockerActive: boolean;
  onOpenBlockerPreview: () => void;
  onOpenAppearance: () => void;
  appearanceOpen?: boolean;
  hasMissingPermissions?: boolean;
  liveBannerText?: string | null;
  liveBannerSubject?: SubjectId | null;
  onOpenLiveBanner?: () => void;
}

export const TopBar = memo(function TopBar({
  isDark,
  onToggleTheme,
  blockerActive,
  onOpenBlockerPreview,
  onOpenAppearance,
  appearanceOpen = false,
  hasMissingPermissions = false,
  liveBannerText,
  liveBannerSubject,
  onOpenLiveBanner,
}: TopBarProps) {
  const subjMeta = liveBannerSubject ? SUBJECT_META[liveBannerSubject] : null;

  return (
    <header className="ios-glass-topbar sticky top-0 z-30 h-14 transition-colors duration-200">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-brand bg-gradient-to-r from-[#071F4D] via-blue-700 to-cyan-500 bg-clip-text text-[19px] font-bold tracking-tight text-transparent dark:from-white dark:via-sky-200 dark:to-cyan-300 whitespace-nowrap shrink-0">
            This Week
          </span>

          {liveBannerText && onOpenLiveBanner && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenLiveBanner();
              }}
              className="hidden min-w-0 items-center gap-1.5 text-left text-xs font-medium text-[#0B234A]/80 transition-opacity hover:opacity-100 dark:text-sky-100/85 sm:inline-flex"
            >
              <span className="text-[#0B234A]/35 dark:text-sky-300/40">/</span>
              <span className={`truncate max-w-[220px] ${subjMeta ? subjMeta.text : ''}`}>
                {liveBannerText}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onOpenBlockerPreview();
            }}
            className={`ios-glass relative inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0 ${
              blockerActive
                ? '!border-emerald-400/70 !bg-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                : 'text-[#07142B] dark:text-sky-50'
            }`}
          >
            {blockerActive ? (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <Shield className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{blockerActive ? 'Lock On' : 'Phone Lock'}</span>
            {hasMissingPermissions && !blockerActive && (
              <span
                aria-label="Permissions needed"
                className="h-1.5 w-1.5 rounded-full bg-orange-500"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tick();
              onOpenAppearance();
            }}
            aria-label="Transparency and display settings"
            aria-pressed={appearanceOpen}
            className={`ios-glass inline-flex h-[38px] w-[38px] items-center justify-center rounded-full transition-transform duration-100 active:scale-90 ${
              appearanceOpen
                ? '!border-blue-500/80 !bg-blue-600 text-white dark:!border-cyan-300/80 dark:!bg-cyan-400 dark:text-[#04143B]'
                : 'text-blue-700 dark:text-cyan-200'
            }`}
          >
            <Droplets className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tick();
              onToggleTheme();
            }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to night mode'}
            className="ios-glass relative inline-flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-sky-50"
          >
            {isDark ? <Sun className="h-4 w-4 text-sky-200" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
});
