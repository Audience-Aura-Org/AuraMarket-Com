/** Page header: optional eyebrow, headline, subtitle, and right-side actions. */
export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="m-eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="m-headline m-fs-20-28">{title}</h1>
        {subtitle && <p className="m-muted mt-1 m-fs-13 font-medium opacity-70">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
