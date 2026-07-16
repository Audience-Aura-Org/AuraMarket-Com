"use client";

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '24px',
        background: 'var(--bg-primary, #0f0f0f)',
        color: 'var(--text-primary, #f0f0f0)',
        textAlign: 'center',
      }}
    >
      {/* Signal icon */}
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.25 }}
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill="currentColor" />
      </svg>

      <div style={{ maxWidth: '280px' }}>
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 700,
            marginBottom: '8px',
            letterSpacing: '-0.02em',
          }}
        >
          You&apos;re offline
        </h1>
        <p
          style={{
            fontSize: '13px',
            opacity: 0.5,
            lineHeight: 1.5,
          }}
        >
          Check your connection. Previously browsed pages, statuses, and
          products will load as soon as you&apos;re back online.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '8px',
          padding: '10px 24px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'transparent',
          color: 'var(--text-primary, #f0f0f0)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
