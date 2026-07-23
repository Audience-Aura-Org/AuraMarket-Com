"use client";

import { useState, useEffect } from 'react';
import RoleSidebar from './RoleSidebar';
import MobileHeader from './MobileHeader';
import Footer from './Footer';
import Breadcrumbs from './Breadcrumbs';
import SubscriptionAccessNotice from './SubscriptionAccessNotice';

export default function DashboardLayout({ children, role, hideSidebar = false, hideFooter = false }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsSidebarOpen(false);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg-secondary)]">
        <main className="flex w-full min-h-0 flex-1 flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500 relative overflow-x-hidden ${role === 'admin' ? 'admin-no-uppercase' : ''}`}>
      <div className="fixed top-[-15%] left-[-15%] size-[700px] bg-[var(--accent)]/5 blur-[150px] rounded-full pointer-events-none transition-colors duration-700 select-none"></div>
      <div className="fixed bottom-[-15%] right-[-15%] size-[600px] bg-indigo-600/5 blur-[150px] rounded-full pointer-events-none transition-colors duration-700 select-none"></div>

      {!hideSidebar && (
        <RoleSidebar 
          role={role} 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
        />
      )}

      <div className={`flex min-h-0 flex-1 flex-col relative z-10 w-full ${!hideSidebar ? 'lg:pl-[240px]' : ''}`}>
        {!hideSidebar && (
          <MobileHeader 
            isOpen={isSidebarOpen} 
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          />
        )}
        
        <main className={`relative z-10 flex min-h-0 w-full flex-1 flex-col pb-24 lg:pb-8 lg:pt-0 ${!hideSidebar ? 'pt-[calc(56px+env(safe-area-inset-top,0px))]' : ''}`}>
          {!hideSidebar && <SubscriptionAccessNotice disabled />}
          {!hideSidebar && <Breadcrumbs role={role} />}
          {children}
        </main>

        {!hideSidebar && !hideFooter && <Footer />}
      </div>
    </div>
  );
}
