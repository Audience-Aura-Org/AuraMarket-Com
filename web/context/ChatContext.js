'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState(null);
  const [contextProduct, setContextProduct] = useState(null);
  const [initialPartnerData, setInitialPartnerData] = useState(null);

  const openChat = useCallback((partnerId, product = null, partnerData = null) => {
    setActivePartnerId(partnerId);
    setContextProduct(product);
    setInitialPartnerData(partnerData);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <ChatContext.Provider value={{ 
      isOpen, 
      activePartnerId, 
      contextProduct, 
      initialPartnerData,
      openChat, 
      closeChat 
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};
