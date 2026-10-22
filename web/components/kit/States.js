/** Empty / error / loading states. Skeletons match content size (no layout shift). */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-[var(--accent)]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[11px] lg:text-[13px] text-[var(--text-secondary)] opacity-80">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[1.5rem] border border-rose-500/25 bg-rose-500/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] font-medium text-rose-600 dark:text-rose-400">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 text-[11px] font-semibold">
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-[var(--bg-secondary)] ${className}`} />;
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="divide-y divide-[var(--glass-border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 md:px-6 py-4">
          <Skeleton className="size-9 rounded-[0.875rem]" />
          <Skeleton className="h-3.5 max-w-[240px] flex-1" />
          <Skeleton className="ml-auto h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}
