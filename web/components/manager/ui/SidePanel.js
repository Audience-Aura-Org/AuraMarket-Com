'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return desktop;
}

/**
 * Detail surface: right-hand panel ≥ 1024px, bottom sheet below.
 * Rendered inside .manager-ui (no portal) so it inherits the tokens.
 * Esc closes; Tab is trapped; focus returns to the opener on close.
 */
export default function SidePanel({ open, onClose, title, children, footer }) {
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    panelRef.current?.querySelector(FOCUSABLE)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [open, onClose]);

  const offscreen = desktop ? { x: '100%' } : { y: '100%' };
  const transition = reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 40 };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={offscreen}
            animate={{ x: 0, y: 0 }}
            exit={offscreen}
            transition={transition}
            className="fixed z-[61] flex flex-col bg-[var(--m-surface-solid)] border-[var(--m-border)]
              inset-x-0 bottom-0 max-h-[88vh] rounded-t-[2rem] border-t shadow-[0_-18px_45px_rgba(0,0,0,0.18)]
              lg:inset-y-3 lg:left-auto lg:right-3 lg:max-h-none lg:w-[440px] lg:rounded-[2rem] lg:border
              pb-[env(safe-area-inset-bottom,0px)]"
          >
            <div className="lg:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-[var(--m-border-strong)]" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
              <div className="min-w-0 m-headline m-fs-15 truncate">{title}</div>
              <button type="button" onClick={onClose} className="m-btn !min-h-9 !w-9 !px-0" aria-label="Close">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
            {footer && <div className="border-t border-[var(--m-border)] px-6 py-4">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
