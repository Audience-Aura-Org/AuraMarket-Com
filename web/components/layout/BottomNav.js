"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, ShoppingBag, User, House, Store, Truck, ShieldCheck,
  LayoutGrid, LogIn
} from "lucide-react";
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import { MessageCircle } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { openChat } = useChat();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isChatPage = pathname?.startsWith('/chat') || pathname?.startsWith('/messages') || pathname?.startsWith('/admin/messages');
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/onboarding');
  const isRolePage = pathname?.startsWith('/wallet') || pathname?.startsWith('/admin') || pathname?.startsWith('/vendor') || pathname?.startsWith('/logistics');
  const isDiscoveryPage = pathname?.startsWith('/discovery');

  if (!mounted || isChatPage || isAuthPage || isRolePage || isDiscoveryPage) return null;

  const menu = [
    { label: "Discover", href: "/discovery", icon: Compass },
    { label: "Home", href: "/", icon: House },
    { label: "Chats", onClick: () => openChat(null), icon: MessageCircle },
    { label: "Shop", href: "/shop", icon: LayoutGrid },
  ];

  // Role-based center destination/icon
  if (user?.role === 'vendor') {
    menu[1] = { label: "Store", href: "/vendor/dashboard", icon: Store };
  } else if (user?.role === 'admin') {
    menu[1] = { label: "Admin", href: "/admin/dashboard", icon: ShieldCheck };
  } else if (user?.role === 'logistics') {
    menu[1] = { label: "Delivery", href: "/logistics/dashboard", icon: Truck };
  }

  // Right-most item changes based on auth state
  if (user?._id) {
    menu.push({ label: "Profile", href: "/profile", icon: User });
  } else {
    menu.push({ label: "Login", href: "/login", icon: LogIn });
  }

  return (
    <>
      <div className="h-[72px] sm:hidden pointer-events-none" />
      <nav className="fixed bottom-0 left-0 right-0 w-full z-50 sm:hidden backdrop-blur-2xl bg-white/[0.02] border-t border-white/[0.08] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] transition-all duration-500 rounded-t-[32px] overflow-hidden">
        <div className="flex items-center justify-around h-[70px] pb-2 pt-1 relative w-full px-1">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

              const itemContent = (
                <>
                  <div className={`p-1.5 rounded-xl transition-all duration-300 relative ${
                    isActive ? 'bg-[var(--accent)]/10 scale-105 shadow-lg shadow-[var(--accent)]/10' : ''
                  }`}>
                    <Icon className={`size-5 transition-all ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                    {isActive && (
                      <div className="absolute -top-1 -right-1 size-1.5 bg-[var(--accent)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent)]"></div>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold mt-1 transition-all ${
                    isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-60'
                  }`}>
                    {item.label}
                  </span>
                </>
              );

              if (item.onClick) {
                return (
                  <button 
                    key={item.label} 
                    onClick={item.onClick}
                    className="flex flex-col items-center justify-center w-full h-full transition-all duration-300 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {itemContent}
                  </button>
                );
              }

              return (
                <Link 
                  key={item.label} 
                  href={item.href}
                  className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${
                    isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {itemContent}
                </Link>
              );
          })}
        </div>
      </nav>
    </>
  );
}
