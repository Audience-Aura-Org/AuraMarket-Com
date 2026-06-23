'use client';

import { Capacitor } from '@capacitor/core';
import { useUploadQueue } from '@/context/UploadQueueContext';

/**
 * FloatingUploadBadge
 * Fixed-position circular progress ring that appears whenever there are
 * active uploads in the global queue. Survives page navigation.
 */
export default function FloatingUploadBadge() {
  const { jobs } = useUploadQueue();
  const isNativeApp = Capacitor?.isNativePlatform?.() === true;
  const activeJobs = jobs.filter((j) => j.status === 'active');

  if (isNativeApp || activeJobs.length === 0) return null;

  const job = activeJobs[0];
  const progress = job.progress || 0;

  // SVG ring geometry
  const SIZE = 58;
  const STROKE = 3.5;
  const RADIUS = (SIZE - STROKE * 2) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const OFFSET = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '76px',   // sits just above the bottom nav
        right: '14px',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
        pointerEvents: 'none',
      }}
    >
      {/* Circular progress ring */}
      <div
        style={{
          position: 'relative',
          width: `${SIZE}px`,
          height: `${SIZE}px`,
          borderRadius: '50%',
          background: 'rgba(10, 5, 20, 0.92)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          boxShadow: '0 4px 24px rgba(168, 85, 247, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: 'rotate(-90deg)',
          }}
        >
          {/* Background track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={STROKE}
          />
          {/* Progress arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="url(#uploadGradient)"
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={OFFSET}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.35s ease' }}
          />
          <defs>
            <linearGradient id="uploadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>

        {/* Upload icon */}
        <span
          className="material-symbols-outlined"
          style={{
            color: '#c084fc',
            fontSize: '20px',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          cloud_upload
        </span>
      </div>

      {/* Phase label */}
      <span
        style={{
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.03em',
          color: 'rgba(192, 132, 252, 0.9)',
          background: 'rgba(10, 5, 20, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          padding: '2px 7px',
          borderRadius: '10px',
          maxWidth: '80px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        {activeJobs.length > 1 ? `${activeJobs.length} uploads` : `${progress}%`}
      </span>
    </div>
  );
}
