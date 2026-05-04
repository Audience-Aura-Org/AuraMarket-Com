export default function LoadingSpinner({ fullScreen = false, text = '' }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-6">
      <div className="relative flex items-center justify-center">
        <img src="/icon-512.png" alt="Aura Logo" className="h-10 opacity-50" />
      </div>
      <div className="size-12 rounded-full border-4 border-[var(--accent)]/10 border-t-[var(--accent)] animate-spin" />
      {text && <p className="text-[10px] font-black  tracking-[0.3em] text-[var(--text-secondary)] opacity-40">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="py-20 md:py-40 flex items-center justify-center">
      {content}
    </div>
  );
}
