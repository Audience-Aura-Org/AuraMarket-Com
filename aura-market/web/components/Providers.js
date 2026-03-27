'use client';

import { ThemeProvider } from '@/context/ThemeContext';
import SocketProvider from '@/components/SocketProvider';
import CartSidebar from '@/components/CartSidebar';
import OnboardingWatcher from '@/components/layout/OnboardingWatcher';
import TopNav from '@/components/layout/TopNav';
import BottomNav from '@/components/layout/BottomNav';
import Footer from '@/components/layout/Footer';

import PWAInit from '@/components/PWAInit';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <SocketProvider>
        <Toaster position="top-right" />
        <PWAInit />
        <OnboardingWatcher />
        <TopNav />
        <div className="flex flex-row items-stretch w-full">
          <main className="flex-1 flex flex-col min-h-screen min-w-0">
            {children}
            <Footer />
          </main>
          <CartSidebar />
        </div>
        <BottomNav />
      </SocketProvider>
    </ThemeProvider>
  );
}
