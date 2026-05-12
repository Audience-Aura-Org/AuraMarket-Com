'use client';

import { useChat } from '@/context/ChatContext';
import MessagingHub from '@/components/hub/MessagingHub';
import { AnimatePresence, motion } from 'framer-motion';

export default function GlobalChatOverlay() {
  const { isOpen, activePartnerId, contextProduct, initialPartnerData, closeChat, openChat } = useChat();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for Mobile/Desktop click-outside */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeChat}
            className="fixed inset-0 z-[590] cursor-pointer bg-black/50 backdrop-blur-[3px] md:bg-black/35"
          />
          
          <MessagingHub 
            vendorId={activePartnerId}
            product={contextProduct}
            initialData={initialPartnerData}
            onClose={closeChat}
          />
        </>
      )}
    </AnimatePresence>
  );
}
