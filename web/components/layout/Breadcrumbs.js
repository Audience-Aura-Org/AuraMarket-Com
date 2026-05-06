"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumbs({ role }) {
  const pathname = usePathname();
  
  if (!pathname || pathname === '/' || pathname === `/${role}/dashboard`) return null;

  // Split path and filter out empty strings
  const paths = pathname.split('/').filter(p => p);
  
  // Create breadcrumb items
  const breadcrumbs = paths.map((path, index) => {
    const href = `/${paths.slice(0, index + 1).join('/')}`;
    
    // Format label: capitalize, replace hyphens/underscores with spaces
    let label = path.charAt(0).toUpperCase() + path.slice(1).replace(/[-_]/g, ' ');
    
    // Special handling for common technical IDs or UUIDs (usually longer than 20 chars)
    if (path.length > 20) label = 'Detail';
    if (path === role) label = role.charAt(0).toUpperCase() + role.slice(1);
    
    return { label, href, isLast: index === paths.length - 1 };
  });

  return (
    <nav className="flex items-center gap-2 px-6 py-4 overflow-x-auto no-scrollbar animate-in fade-in slide-in-from-left-2 duration-500">
      <Link 
        href={`/${role}/dashboard`}
        className="size-8 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shrink-0 shadow-sm"
      >
        <Home className="size-4" />
      </Link>
      
      {breadcrumbs.slice(1).map((crumb, idx) => (
        <div key={crumb.href} className="flex items-center gap-2 shrink-0">
          <ChevronRight className="size-3.5 text-[var(--text-secondary)] opacity-30" />
          {crumb.isLast ? (
            <span className="text-[11px] lg:text-[12px] font-bold tracking-tight text-[var(--text-primary)] px-3 py-1.5 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/10">
              {crumb.label}
            </span>
          ) : (
            <Link 
              href={crumb.href}
              className="text-[11px] lg:text-[12px] font-bold tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
