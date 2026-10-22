/** Empty, error, and loading states shared by every manager view. */

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      <p className="m-headline m-fs-15">{title}</p>
      {description && <p className="m-muted mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between px-4 py-4 m-row border border-[var(--m-border)]">
      <p className="m-bad">{message || 'Something went wrong.'}</p>
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
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className="h-3.5 flex-1 max-w-[240px]" />
          <Skeleton className="h-3.5 w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}
