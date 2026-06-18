'use client';

import { usePathname } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import MessagingHub from '@/components/hub/MessagingHub';
import { AnimatePresence, motion } from 'framer-motion';

export default function GlobalChatOverlay() {
  const pathname = usePathname();
  const { isOpen, activePartnerId, contextProduct, initialPartnerData, notificationTitle, closeChat } = useChat();
  const onFullPageChat = pathname?.startsWith('/chat');
  const showOverlay = isOpen && !onFullPageChat;

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
