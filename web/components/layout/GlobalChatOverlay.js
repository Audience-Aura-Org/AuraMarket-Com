'use client';

import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import MessagingHub from '@/components/hub/MessagingHub';
import { AnimatePresence, motion } from 'framer-motion';

export default function GlobalChatOverlay() {
  const pathname = usePathname();
  const { isOpen, activePartnerId, contextProduct, initialPartnerData, notificationTitle, closeChat } = useChat();
  const onFullPageChat = pathname?.startsWith('/chat');

  // Suppress the overlay for one render when leaving /chat.
  // Next.js App Router renders the new page before unmounting the old one,
  // so pathname updates (onFullPageChat → false) before /chat's cleanup
  // closeChat() fires — producing a one-frame flash of the overlay.
  const prevOnFullPageChatRef = useRef(onFullPageChat);
  const justLeftChat = prevOnFullPageChatRef.current && !onFullPageChat;
  prevOnFullPageChatRef.current = onFullPageChat;

  const showOverlay = isOpen && !onFullPageChat && !justLeftChat;

  return (
    <AnimatePresence>
      {showOverlay && (
        <>
          {/* Backdrop for Mobile/Desktop click-outside */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeChat}
            className="fixed inset-0 z-[590] cursor-pointer bg-black/55 backdrop-blur-[4px] max-md:bg-[var(--bg-secondary)] max-md:backdrop-blur-none md:bg-black/35"
          />
          
          <MessagingHub 
            vendorId={activePartnerId}
            product={contextProduct}
            initialData={initialPartnerData}
            notificationTitle={notificationTitle}
            onClose={closeChat}
          />
        </>
      )}
    </AnimatePresence>
  );
}
