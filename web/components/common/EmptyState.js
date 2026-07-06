export default function EmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <span className="material-symbols-outlined text-4xl text-[var(--text-secondary)]">{icon}</span>
      <p className="font-semibold text-[13px] text-[var(--text-primary)]">{title}</p>
      {description && (
        <p className="text-[11px] text-[var(--text-secondary)] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
