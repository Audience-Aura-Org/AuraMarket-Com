/** Empty, error, and loading states shared by every manager view. */

export function EmptyState({ title, description, action, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      {Icon && <span className="m-icon-tile m-tone-accent mb-4"><Icon className="size-5" aria-hidden="true" /></span>}
      <p className="m-headline m-fs-15">{title}</p>
      {description && <p className="m-muted mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between px-5 py-4 rounded-[1.5rem] border border-[color-mix(in_srgb,var(--m-bad)_25%,transparent)] bg-[var(--m-bad-soft)]">
      <p className="m-bad font-medium">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="m-btn shrink-0">
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`m-skeleton ${className}`} />;
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="m-divide">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-6 py-4">
          <Skeleton className="size-9 rounded-[0.875rem]" />
          <Skeleton className="h-3.5 flex-1 max-w-[240px]" />
          <Skeleton className="h-3.5 w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}
