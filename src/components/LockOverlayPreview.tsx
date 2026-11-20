import {
  Bell,
  BookOpen,
  Calculator,
  CheckCircle2,
  Lock,
  Phone,
  Settings,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ALLOWED_APPS_ON_A07 } from '../data/previewData';
import {
  fetchNativePermissions,
  requestNativePermission,
  sendNativeNotification,
} from '../native/thisWeekBridge';
import { ActiveLockInfo, NativePermissionStatus } from '../types';
import { haptics } from '../utils/haptics';
import { CrystalSheet } from './FluidControls';

interface LockOverlayPreviewProps {
  open: boolean;
  activeLock: ActiveLockInfo;
  onStartManualLock: (durationMinutes: number) => void;
  onOpenGuidedPermissions?: () => void;
  onClose: () => void;
}

const APP_ICONS = [Phone, Users, Calculator, Settings, BookOpen];
const DURATION_OPTIONS = [
  { mins: 30, label: '30m' },
  { mins: 60, label: '1h' },
  { mins: 120, label: '2h' },
  { mins: 180, label: '3h' },
];

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function LockOverlayPreview({
  open,
  activeLock,
  onStartManualLock,
  onOpenGuidedPermissions,
  onClose,
}: LockOverlayPreviewProps) {
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [perms, setPerms] = useState<NativePermissionStatus>({
    isNativeAndroid: false,
    usageAccess: false,
    overlayAccess: false,
    notifications: false,
    batteryUnrestricted: false,
  });

  useEffect(() => {
    if (!open) return;
    const refresh = () => {
      fetchNativePermissions().then(setPerms);
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !activeLock.active) {
      setRemainingMs(0);
      return;
    }
    const update = () => {
      setRemainingMs(Math.max(0, activeLock.untilTimestampMs - Date.now()));
    };
    update();
    const t = window.setInterval(update, 1000);
    return () => window.clearInterval(t);
  }, [open, activeLock]);

  const handleRequestPerm = async (
    type: 'usage' | 'overlay' | 'notifications' | 'battery',
  ) => {
    haptics.tap();
    await requestNativePermission(type);
    const updated = await fetchNativePermissions();
    setPerms(updated);
  };

  return (
    <CrystalSheet open={open} onClose={onClose} maxWidthClass="max-w-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#0B234A]/65 dark:text-sky-200/75">
            Samsung Galaxy A07 · Unlocked in Transit
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
            Absolute Phone Lock
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[30px] border border-sky-300/45 bg-gradient-to-br from-[#0B2D78]/82 via-[#07205E]/82 to-[#03113A]/88 p-5 text-white shadow-inner">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 -top-12 h-48 w-48 rounded-full opacity-80"
          style={{
            background:
              'radial-gradient(circle, rgba(34,211,238,0.46) 0%, rgba(59,130,246,0) 70%)',
          }}
        />
        <div className="relative flex items-center justify-between text-xs text-sky-200/80">
          <span className="tabular-nums font-medium">
            {activeLock.active ? formatRemaining(remainingMs) : 'Standby'}
          </span>
          <span>Focus Shield</span>
        </div>

        <div className="relative mt-5 text-center">
          <div
            className={`ios-glass mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              activeLock.active
                ? 'animate-beacon !border-emerald-400/60 !bg-emerald-500/25 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.4)]'
                : '!border-sky-300/45 !bg-blue-500/20 text-sky-200'
            }`}
          >
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-semibold">
            {activeLock.active ? 'Lock Active' : 'Allowlist Ready'}
          </h3>
          <p className="mt-0.5 text-xs text-sky-100/85">
            {activeLock.active
              ? `${activeLock.reason} · Until ${activeLock.untilTimeLabel}`
              : 'Phone stays unlocked during 2h commutes; locks only on active study slots'}
          </p>
          {activeLock.active && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
              <Lock className="h-3 w-3" />
              <span>Cannot be unlocked until session finishes</span>
            </p>
          )}
        </div>

        <div className="relative mt-5 grid grid-cols-5 gap-2 border-t border-sky-200/20 pt-4">
          {ALLOWED_APPS_ON_A07.map((app, index) => {
            const Icon = APP_ICONS[index] ?? BookOpen;
            return (
              <div key={app.name} className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-200/45 bg-blue-500/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="max-w-full truncate text-[10px] text-sky-100/85">
                  {app.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {!activeLock.active ? (
        <div className="mt-4 space-y-3">
          <div className="ios-glass-control relative grid grid-cols-4 gap-1 rounded-full p-1">
            {DURATION_OPTIONS.map((opt) => {
              const active = selectedDuration === opt.mins;
              return (
                <button
                  key={opt.mins}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setSelectedDuration(opt.mins);
                  }}
                  className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                      : 'text-[#0B234A]/75 dark:text-sky-200/80'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              haptics.lock();
              onStartManualLock(selectedDuration);
            }}
            className="min-h-[48px] w-full rounded-full bg-blue-600 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform duration-100 active:scale-[0.98] dark:bg-blue-500"
          >
            Start Strict {DURATION_OPTIONS.find((d) => d.mins === selectedDuration)?.label} Lock
          </button>
        </div>
      ) : (
        <div className="ios-glass-control mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <Lock className="h-3.5 w-3.5" />
          <span>Locked Until {activeLock.untilTimeLabel} · No Early Unlock</span>
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-white/40 pt-4 dark:border-sky-300/15">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
            {perms.isNativeAndroid ? 'Galaxy A07 Native Permissions' : 'Alerts & APK Permissions'}
          </p>
          {onOpenGuidedPermissions && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onClose();
                onOpenGuidedPermissions();
              }}
              className="text-[11px] font-semibold text-blue-600 dark:text-cyan-300"
            >
              Setup Wizard
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleRequestPerm('notifications')}
            className="ios-glass-control flex min-h-[44px] flex-1 items-center justify-between rounded-full px-4 text-xs transition-transform duration-100 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2 font-medium">
              <Bell className="h-3.5 w-3.5 text-blue-600 dark:text-sky-300" />
              10-Min Slot Notifications
            </span>
            <span
              className={`font-semibold ${
                perms.notifications
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-blue-600 dark:text-sky-300'
              }`}
            >
              {perms.notifications ? 'Allowed' : 'Enable'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              void sendNativeNotification(
                'This Week · Reminder Ready',
                '10-minute system notifications are working on your Galaxy A07.',
              );
            }}
            className="ios-glass-control min-h-[44px] shrink-0 rounded-full px-4 text-xs font-semibold text-blue-700 transition-transform duration-100 active:scale-95 dark:text-sky-200"
          >
            Test
          </button>
        </div>

        {perms.isNativeAndroid && (
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'usage', label: 'Usage Access', ok: perms.usageAccess },
                { id: 'overlay', label: 'Overlay', ok: perms.overlayAccess },
                { id: 'battery', label: 'Battery', ok: perms.batteryUnrestricted },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleRequestPerm(item.id)}
                className="ios-glass-control flex min-h-[40px] items-center justify-center gap-1 rounded-full px-2 text-[11px] font-medium transition-transform duration-100 active:scale-95"
              >
                {item.ok && (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                )}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </CrystalSheet>
  );
}
