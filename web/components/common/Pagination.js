"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({ currentPage, totalPages, onPageChange, compact = false, loading = false }) {
  if (totalPages <= 1) return null;

  // Clamp so display is never out of bounds
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  return (
    <div
      className={`flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 ${compact ? 'py-3' : 'py-10'}`}
    >
      <div className="flex gap-0.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-0.5 shadow-sm sm:gap-1 sm:p-1">
        <PaginationButton
          icon={ChevronsLeft}
          onClick={() => onPageChange(1)}
          disabled={loading || safePage === 1}
        />
        <PaginationButton
          icon={ChevronLeft}
          onClick={() => onPageChange(safePage - 1)}
          disabled={loading || safePage === 1}
        />

        <div className="flex items-center px-3 sm:px-6">
          <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)] sm:text-[12px]">
            {safePage}
          </span>
        </div>

        <PaginationButton
          icon={ChevronRight}
          onClick={() => onPageChange(safePage + 1)}
          disabled={loading || safePage >= totalPages}
        />
        <PaginationButton
          icon={ChevronsRight}
          onClick={() => onPageChange(totalPages)}
          disabled={loading || safePage >= totalPages}
        />
      </div>
    </div>
  );
}

function PaginationButton({ icon: Icon, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex size-9 items-center justify-center rounded-xl transition-all sm:size-10 ${disabled ? 'cursor-not-allowed text-[var(--text-secondary)] opacity-10' : 'border border-transparent text-[var(--text-primary)] shadow-sm hover:border-[var(--accent)]/30 hover:bg-[var(--accent)] hover:text-white active:scale-90'}`}
    >
      <Icon className="size-4" />
    </button>
  );
}
