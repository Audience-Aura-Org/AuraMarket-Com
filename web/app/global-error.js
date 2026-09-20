'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', fontFamily: '"Poppins", "Inter", system-ui, sans-serif',
          background: '#fafafa', color: '#1e293b', padding: '24px', textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: '#fef3c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', maxWidth: 380, lineHeight: 1.6, margin: '0 0 28px' }}>
            We&apos;re experiencing a temporary issue. Our team has been notified and is working on it.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: '#7c3aed', color: 'white', fontSize: 13, fontWeight: 600,
                transition: 'opacity 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '10px 24px', borderRadius: 12, border: '1px solid #e2e8f0', cursor: 'pointer',
                background: 'white', color: '#475569', fontSize: 13, fontWeight: 600,
                transition: 'opacity 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              Go home
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 32 }}>
            If this persists, contact support at hello@auradime.com
          </p>
        </div>
      </body>
    </html>
  );
}
