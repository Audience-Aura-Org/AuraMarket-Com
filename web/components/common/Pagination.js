"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({ currentPage, totalPages, onPageChange, compact = false }) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={`flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 ${compact ? 'py-3' : 'py-10'}`}
    >
      <div className="flex gap-0.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-0.5 shadow-sm sm:gap-1 sm:p-1">
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
        
        <div className="flex items-center gap-1.5 px-3 sm:gap-2 sm:px-6">
          <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)] sm:text-[12px]">
            {currentPage}
          </span>
          <span className="whitespace-nowrap text-[10px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-40 sm:text-[11px]">
            / {totalPages}
          </span>
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
      className={`flex size-9 items-center justify-center rounded-xl transition-all sm:size-10 ${disabled ? 'cursor-not-allowed text-[var(--text-secondary)] opacity-10' : 'border border-transparent text-[var(--text-primary)] shadow-sm hover:border-[var(--accent)]/30 hover:bg-[var(--accent)] hover:text-white active:scale-90'}`}
    >
      <Icon className="size-4" />
    </button>
  );
}
