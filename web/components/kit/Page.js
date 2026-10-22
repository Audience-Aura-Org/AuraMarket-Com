/**
 * Page scaffolding in the vendor dashboard's language. Plain CSS — no motion
 * library — so pages paint fast; glass blur is desktop-only (globals.css turns
 * backdrop-filter off on phones).
 */

/** Centred content column, comfortable on phones (16px gutters) and wide screens. */
export function PageContainer({ children, className = '' }) {
  return (
    <div className={`mx-auto w-full max-w-[1600px] px-4 md:px-8 py-5 md:py-8 space-y-6 md:space-y-8 ${className}`}>
      {children}
    </div>
  );
}

/** Title block: optional icon tile, eyebrow, title, subtitle; actions on the right. */
export function PageHeader({ icon: Icon, eyebrow, title, subtitle, actions }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        {Icon && (
          <span className="flex size-10 md:size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-gradient-to-br from-[var(--accent)]/20 to-indigo-600/10 text-[var(--accent)]">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-70">{eyebrow}</p>}
          <h1 className="truncate text-base md:text-lg lg:text-xl font-bold tracking-tight text-[var(--text-primary)] font-[Poppins]">{title}</h1>
          {subtitle && <p className="truncate text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-70">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Glass panel (2rem), optional header row with title, subtitle and an action. */
export function Panel({ title, subtitle, action, children, className = '', bodyClassName = '', flush = false }) {
  return (
    <section className={`rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 md:backdrop-blur-xl shadow-sm ${flush ? 'overflow-hidden' : 'p-5 md:p-6'} ${className}`}>
      {(title || action) && (
        <div className={`flex flex-wrap items-start justify-between gap-3 ${flush ? 'px-5 md:px-6 pt-5 pb-3' : 'mb-5'}`}>
          <div className="min-w-0">
            {title && <h2 className="text-sm lg:text-base font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>}
            {subtitle && <p className="text-[10px] lg:text-[12px] font-semibold text-[var(--text-secondary)] opacity-60">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Buttons: accent pill (primary), glass pill (secondary), square icon button. */
export const buttonClass = {
  primary: 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[11px] lg:text-[13px] font-semibold text-white shadow-lg shadow-[var(--accent)]/25 transition active:scale-95 hover:brightness-110 disabled:opacity-50',
  secondary: 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 px-5 text-[11px] lg:text-[13px] font-semibold text-[var(--text-primary)] transition active:scale-95 hover:border-[var(--accent)]/30 hover:text-[var(--accent)] disabled:opacity-50',
  icon: 'inline-flex size-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] transition active:scale-95 hover:border-[var(--accent)]/30 hover:text-[var(--accent)] disabled:opacity-50',
};
