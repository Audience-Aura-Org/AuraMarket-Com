"use client";

import { useState, useEffect } from 'react';
import RoleSidebar from './RoleSidebar';
import MobileHeader from './MobileHeader';
import Footer from './Footer';

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
        <main className="flex-1 w-full">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500 relative overflow-hidden">
      <div className="absolute top-[-15%] left-[-15%] size-[700px] bg-[var(--accent)]/5 blur-[150px] rounded-full pointer-events-none transition-colors duration-700 select-none"></div>
      <div className="absolute bottom-[-15%] right-[-15%] size-[600px] bg-indigo-600/5 blur-[150px] rounded-full pointer-events-none transition-colors duration-700 select-none"></div>

      {!hideSidebar && (
        <RoleSidebar 
          role={role} 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
        />
      )}

      <div className={`flex-1 flex flex-col relative z-[210] w-full ${!hideSidebar ? 'lg:pl-[240px]' : ''}`}>
        {!hideSidebar && (
          <MobileHeader 
            isOpen={isSidebarOpen} 
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          />
        )}
        
        <main className="flex-1 relative z-[210] w-full">
          {children}
        </main>

        {!hideSidebar && !hideFooter && <Footer />}
      </div>
    </div>
  );
}
