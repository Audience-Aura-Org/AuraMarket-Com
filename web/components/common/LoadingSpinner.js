'use client';

import { motion } from 'framer-motion';

export default function LoadingSpinner({ fullScreen = false, text = '' }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-8">
      <div className="relative flex items-center justify-center size-24">
        {/* Pulsing Aura Glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 bg-[var(--accent)] blur-[40px] rounded-full"
        />
        
        {/* Rotating Orbital Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute inset-0 border border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full"
        />

        <motion.img
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          src="/icon-512.png"
          alt="Aura Logo"
          className="size-12 object-contain relative z-10"
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-[10px] lg:text-[12px] font-bold tracking-[0.4em] capitalize text-[var(--text-primary)] opacity-60">
          {text || 'Calibrating'}
        </p>
        <div className="w-20 h-[1px] bg-[var(--glass-border)] relative overflow-hidden">
           <motion.div 
             animate={{ x: ['-100%', '100%'] }}
             transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
             className="absolute inset-0 bg-[var(--accent)] w-1/2"
           />
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[999] bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="absolute inset-0 bg-radial-at-c from-[var(--accent)]/5 to-transparent opacity-50" />
        {content}
      </div>
    );
  }

  return (
    <div className="py-20 md:py-40 flex items-center justify-center w-full">
      {content}
    </div>
  );
}
