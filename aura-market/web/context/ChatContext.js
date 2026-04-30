'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePartnerId, setActivePartnerId] = useState(null);
  const [contextProduct, setContextProduct] = useState(null);
  const [initialPartnerData, setInitialPartnerData] = useState(null);
  const [isSystemWide, setIsSystemWide] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();

  const openChat = useCallback((partnerId, product = null, partnerData = null, global = false) => {
    if (!user) {
      router.push('/login?from=chat');
      return;
    }
    setActivePartnerId(partnerId);
    setContextProduct(product);
    setInitialPartnerData(partnerData);
    setIsSystemWide(global);
    setIsOpen(true);
  }, [user, router]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    setIsSystemWide(false);
  }, []);

  return (
    <ChatContext.Provider value={{ 
      isOpen, 
      activePartnerId, 
      contextProduct, 
      initialPartnerData,
      isSystemWide,
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
