"use client";
/**
 * Top of every rider tab: one full-width band with an avatar or icon, the title,
 * a short line under it and an optional action (e.g. call the agency).
 * RIDER_PAGE is the shared page container: full width on phones (sizes in px, so
 * the app's font-size setting never squeezes the page), centred on wide screens.
 */
export const RIDER_PAGE = "w-full space-y-4 px-3 pb-28 pt-3 text-[var(--text-primary)] sm:px-5 lg:mx-auto lg:max-w-[880px]";

export default function RiderPageHeader({ title, subtitle, initial, icon: Icon, action = null }) {
  return (
    <header className="flex items-center gap-3 rounded-[24px] bg-gradient-to-br from-[var(--accent)] to-[color-mix(in_srgb,var(--accent)_70%,#6d28d9)] p-4 text-white shadow-sm">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-[18px] font-bold">
        {Icon ? <Icon className="size-6" aria-hidden="true" /> : (initial || "R").toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[18px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="truncate text-[12px] text-white/85">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
