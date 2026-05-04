'use client';

import { motion } from 'framer-motion';

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        transition: { duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a050a]"
    >
      {/* Central Logo with Premium Animation */}
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            transition: { 
              duration: 1.2, 
              ease: [0.16, 1, 0.3, 1] 
            }
          }}
          className="relative size-32 md:size-40"
        >
          {/* Subtle Outer Glow */}
          <div className="absolute inset-0 bg-[var(--accent)] blur-[60px] opacity-20 rounded-full animate-pulse" />
          
          <img 
            src="/icon-512.png" 
            alt="Aura Market" 
            className="size-full object-contain relative z-10"
          />
        </motion.div>
      </div>

      {/* Minimalist Progress Indicator */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-white/5 overflow-hidden rounded-full">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ 
            repeat: Infinity, 
            duration: 1.5, 
            ease: "easeInOut" 
          }}
          className="w-full h-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
        />
      </div>
    </motion.div>
  );
}
