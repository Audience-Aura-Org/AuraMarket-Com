/**
 * Shared form styles, so every field, label and small action button looks the same
 * across forms and the address components (place search, saved places).
 * One text size for typing (14px), one for labels (12px semibold), one for small
 * actions (12px semibold); placeholders are regular weight and lighter.
 */
export const FIELD = "min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3.5 text-[14px] font-normal text-[var(--text-primary)] outline-none placeholder:text-[13px] placeholder:font-normal placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]";
export const LABEL = "mb-1.5 block text-[12px] font-semibold text-[var(--text-primary)]";
export const SMALL_BUTTON = "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-[12px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/40 disabled:opacity-50";
export const HINT = "text-[11px] font-normal text-[var(--text-secondary)]";
