import { NativePermissionStatus, TimetableSlot } from '../types';

interface ThisWeekBlockerPlugin {
  syncScheduleAndLock(options: {
    slotsJson: string;
    manualLockUntilMs: number;
    allowlistPackages: string[];
  }): Promise<void>;
  getPermissionStatus(): Promise<NativePermissionStatus>;
  requestPermission(options: {
    type: 'usage' | 'overlay' | 'notifications' | 'battery';
  }): Promise<void>;
  sendNotificationNow?(options: {
    title: string;
    body: string;
  }): Promise<void>;
}

interface CapacitorWindow extends Window {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      ThisWeekBlocker?: ThisWeekBlockerPlugin;
    };
  };
}

export const SAMSUNG_A07_ALLOWLIST = [
  // Phone & Dialer
  'com.samsung.android.dialer',
  'com.samsung.android.incallui',
  'com.android.incallui',
  'com.google.android.dialer',
  'com.android.dialer',
  'com.android.server.telecom',
  // Contacts
  'com.samsung.android.app.contacts',
  'com.android.contacts',
  'com.google.android.contacts',
  // Calculator
  'com.sec.android.app.popupcalculator',
  'com.samsung.android.calculator',
  'com.google.android.calculator',
  'com.android.calculator2',
  // Settings
  'com.android.settings',
  // This Week App
  'com.risinu.thisweek',
];

function getPlugin(): ThisWeekBlockerPlugin | null {
  const win = window as CapacitorWindow;
  return win.Capacitor?.Plugins?.ThisWeekBlocker ?? null;
}

export function isNativeAndroidApp(): boolean {
  const win = window as CapacitorWindow;
  return Boolean(win.Capacitor?.isNativePlatform?.());
}

export async function syncNativeBlockerAndAlarms(
  slots: TimetableSlot[],
  manualLockUntilMs: number,
): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  try {
    await plugin.syncScheduleAndLock({
      slotsJson: JSON.stringify(slots),
      manualLockUntilMs,
      allowlistPackages: SAMSUNG_A07_ALLOWLIST,
    });
  } catch {
    // Non-fatal in web preview
  }
}

export async function fetchNativePermissions(): Promise<NativePermissionStatus> {
  const plugin = getPlugin();
  if (!plugin) {
    const notifGranted =
      typeof Notification !== 'undefined' && Notification.permission === 'granted';
    return {
      isNativeAndroid: false,
      usageAccess: false,
      overlayAccess: false,
      notifications: notifGranted,
      batteryUnrestricted: false,
    };
  }
  try {
    return await plugin.getPermissionStatus();
  } catch {
    return {
      isNativeAndroid: true,
      usageAccess: false,
      overlayAccess: false,
      notifications: false,
      batteryUnrestricted: false,
    };
  }
}

export async function requestNativePermission(
  type: 'usage' | 'overlay' | 'notifications' | 'battery',
): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) {
    if (type === 'notifications' && typeof Notification !== 'undefined') {
      await Notification.requestPermission();
    }
    return;
  }
  try {
    await plugin.requestPermission({ type });
  } catch {
    // Ignore
  }
}

export async function sendNativeNotification(
  title: string,
  body: string,
): Promise<void> {
  const plugin = getPlugin();
  if (plugin?.sendNotificationNow) {
    try {
      await plugin.sendNotificationNow({ title, body });
      return;
    } catch {
      // Fallback below
    }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore
    }
  }
}
