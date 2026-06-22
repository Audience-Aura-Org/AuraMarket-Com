"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Shared hero + shortcut row for logistics area pages (dashboard parity).
 */
export function LogisticsSubpageHeader({
  Icon,
  title,
  accentTitle,
  tag,
  hint,
  actions,
}) {
  return (
    <header className="relative z-20 min-w-0 max-w-[100vw] border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 backdrop-blur-xl">
      <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-4 py-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-5 sm:py-5 md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
          {Icon ? (
            <div className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 md:size-12">
              <Icon className="size-5 text-[var(--accent)] md:size-6" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-balance text-xl font-bold tracking-tight md:text-2xl">
              {title}
              {accentTitle ? (
                <>
                  {" "}
                  <span className="text-[var(--accent)]">{accentTitle}</span>
                </>
              ) : null}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {tag ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">
                    {tag}
                  </span>
                </span>
              ) : null}
              {hint ? (
                <>
                  <span className="hidden text-[var(--text-secondary)] opacity-30 sm:inline">
                    ·
                  </span>
                  <span className="line-clamp-3 text-[10px] font-medium text-[var(--text-secondary)] opacity-60 sm:line-clamp-none">
                    {hint}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function LogisticsShortcutsRow({ links }) {
  const router = useRouter();
  if (!links?.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {links.map((item) => (
        <button
          key={item.href}
          type="button"
          onClick={() => router.push(item.href)}
          className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 rounded-2xl sm:rounded-[2rem] border border-[var(--glass-border)] bg-gradient-to-b from-[var(--bg-primary)]/80 to-[var(--bg-secondary)]/30 px-3 py-3 sm:px-5 sm:py-4 text-center sm:text-left transition-all duration-300 hover:border-[var(--accent)]/55 hover:shadow-lg hover:shadow-[var(--accent)]/5 hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <div className="flex size-10 sm:size-12 items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/10 shrink-0">
            <item.icon className="size-5 sm:size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[12px] font-bold tracking-tight text-[var(--text-primary)]">
              {item.label}
            </p>
            <p className="hidden sm:block text-[10px] font-medium text-[var(--text-secondary)] opacity-60 mt-0.5">
              {item.sub}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
