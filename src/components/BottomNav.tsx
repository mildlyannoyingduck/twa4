import { CalendarRange, CheckCircle2, FileBarChart2, Hourglass, Layers } from 'lucide-react';
import { memo } from 'react';
import { TabId } from '../types';
import { haptics } from '../utils/haptics';

interface BottomNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

const NAV_ITEMS: { id: TabId; label: string; icon: typeof CalendarRange }[] = [
  { id: 'timetable', label: 'Timetable', icon: CalendarRange },
  { id: 'planner', label: 'Planner', icon: Layers },
  { id: 'day', label: 'Day', icon: CheckCircle2 },
  { id: 'papers', label: 'Papers', icon: FileBarChart2 },
  { id: 'countdown', label: 'Exam', icon: Hourglass },
];

export const BottomNav = memo(function BottomNav({
  activeTab,
  onSelectTab,
}: BottomNavProps) {
  const activeIdx = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.id === activeTab),
  );

  return (
    <div className="pointer-events-none fixed bottom-3 left-0 right-0 z-40 px-3 sm:px-4">
      <nav
        aria-label="Primary navigation"
        className="ios-glass-dock pointer-events-auto relative mx-auto grid h-[64px] max-w-lg grid-cols-5 items-center rounded-full p-1.5"
      >
        {/* Single GPU-composited sliding dock lens (zero layoutId reflow) */}
        <div
          aria-hidden="true"
          style={{
            transform: `translate3d(${activeIdx * 100}%, 0, 0)`,
          }}
          className="pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-12px)/5)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        >
          <div className="h-full w-full rounded-full border border-white/90 bg-gradient-to-b from-white/75 via-sky-100/35 to-blue-200/20 shadow-[0_4px_12px_rgba(37,99,235,0.20),inset_0_1px_0_rgba(255,255,255,0.95)] dark:border-sky-200/45 dark:from-sky-300/26 dark:via-blue-500/14 dark:to-cyan-400/12 dark:shadow-[0_4px_12px_rgba(56,189,248,0.28),inset_0_1px_0_rgba(255,255,255,0.45)]" />
        </div>

        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (activeTab !== id) {
                  haptics.tick();
                  onSelectTab(id);
                }
              }}
              className={`relative z-10 flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 transition-colors duration-150 active:scale-95 ${
                isActive
                  ? 'text-[#052052] dark:text-white'
                  : 'text-[#0B2B66]/65 hover:text-[#052052] dark:text-sky-200/70 dark:hover:text-white'
              }`}
            >
              <span
                className={`flex items-center justify-center transition-transform duration-150 ${
                  isActive ? '-translate-y-0.5 scale-110' : 'scale-95'
                }`}
              >
                <Icon
                  className={`h-[17px] w-[17px] transition-colors duration-150 ${
                    isActive
                      ? 'stroke-[2.3] text-blue-700 dark:text-cyan-200'
                      : 'stroke-[1.7]'
                  }`}
                />
              </span>

              <span
                className={`max-w-full truncate text-[9.5px] tracking-tight whitespace-nowrap transition-opacity duration-150 ${
                  isActive ? 'font-semibold opacity-100' : 'font-medium opacity-80'
                }`}
              >
                {label}
              </span>

              {isActive && (
                <span className="mt-0.5 h-[2.5px] w-4 rounded-full bg-blue-600 dark:bg-cyan-300" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
});
