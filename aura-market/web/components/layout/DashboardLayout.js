"use client";

import { useState } from 'react';
import RoleSidebar from './RoleSidebar';
import MobileHeader from './MobileHeader';

export default function DashboardLayout({ children, role, hideSidebar = false }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500 relative">
      <div className="absolute top-[-15%] left-[-15%] size-[700px] bg-[var(--accent)]/5 blur-[150px] rounded-full pointer-events-none transition-colors duration-700 select-none"></div>
      <div className="absolute bottom-[-15%] right-[-15%] size-[600px] bg-indigo-600/5 blur-[150px] rounded-full pointer-events-none transition-colors duration-700 select-none"></div>

      {!hideSidebar && (
        <RoleSidebar 
          role={role} 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative z-10 w-full">
        {!hideSidebar && (
          <MobileHeader 
            isOpen={isSidebarOpen} 
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          />
        )}
        
        <main className="flex-1 overflow-y-auto no-scrollbar relative pb-20 sm:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
