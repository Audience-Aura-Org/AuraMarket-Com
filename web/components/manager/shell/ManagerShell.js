'use client';

import { usePathname } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';
import ManagerRail from './ManagerRail';
import ManagerMobileBar from './ManagerMobileBar';
import ManagerBottomTabs from './ManagerBottomTabs';
import { workspaceAccountId } from './nav';

/**
 * Chrome for every /manager route. Manager sections get a centred content
 * column; account workspaces render the embedded page full-width (those
 * pages bring their own padding).
 */
export default function ManagerShell({ children }) {
  const pathname = usePathname() || '';
  const switching = useManagerMode((s) => s.switching);
  const inWorkspace = Boolean(workspaceAccountId(pathname));

  return (
    <div className="manager-ui min-h-screen">
      {switching && (
        <div className="fixed inset-x-0 top-0 z-[80] h-0.5 overflow-hidden" role="progressbar" aria-label="Switching account">
          <div className="h-full w-1/3 bg-[var(--accent)] animate-[m-progress_1.1s_ease-in-out_infinite]" />
        </div>
      )}
      <ManagerRail />
      <ManagerMobileBar />
      <main className="md:pl-16 lg:pl-[232px] pt-[var(--manager-mobile-bar-height)] md:pt-0 pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-0 min-h-screen">
        {inWorkspace ? children : (
          <div className="mx-auto w-full max-w-[1600px] px-4 md:px-8 py-5 md:py-8">{children}</div>
        )}
      </main>
      <ManagerBottomTabs />
      <style jsx global>{`
        @keyframes m-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
