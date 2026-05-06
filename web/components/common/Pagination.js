"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl p-1 gap-1 shadow-sm">
        <PaginationButton 
          icon={ChevronsLeft} 
          onClick={() => onPageChange(1)} 
          disabled={currentPage === 1} 
        />
        <PaginationButton 
          icon={ChevronLeft} 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1} 
        />
        
        <div className="flex items-center px-6 gap-2">
           <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] font-mono">{currentPage}</span>
           <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-20 tracking-tight whitespace-nowrap">Of {totalPages} NODES</span>
        </div>

        <PaginationButton 
          icon={ChevronRight} 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages} 
        />
        <PaginationButton 
          icon={ChevronsRight} 
          onClick={() => onPageChange(totalPages)} 
          disabled={currentPage === totalPages} 
        />
      </div>
    </div>
  );
}

function PaginationButton({ icon: Icon, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`size-10 rounded-xl flex items-center justify-center transition-all ${disabled ? 'text-[var(--text-secondary)] opacity-10 cursor-not-allowed' : 'text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white active:scale-90 shadow-sm border border-transparent hover:border-[var(--accent)]/30'}`}
    >
      <Icon className="size-4" />
    </button>
  );
}
