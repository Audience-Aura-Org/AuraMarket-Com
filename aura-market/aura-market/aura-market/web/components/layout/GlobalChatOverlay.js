'use client';

import { useChat } from '@/context/ChatContext';
import ChatSlideOverlay from '@/components/hub/ChatSlideOverlay';
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
            className="fixed inset-0 z-[440] bg-black/40 backdrop-blur-[2px] cursor-pointer"
          />
          
          <ChatSlideOverlay 
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
