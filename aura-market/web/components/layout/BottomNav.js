"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, ShoppingBag, Store, User, 
  MessageCircle, LayoutGrid, Heart,
  Zap, Shield, Sparkles
} from "lucide-react";
import { useAuthStore } from '@/hooks/useAuth';

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isChatPage = pathname?.startsWith('/chat');

  if (!mounted || isChatPage) return null;

  const menu = [
    { label: "Market", href: "/discovery", icon: Compass },
    { label: "Home", href: "/", icon: Sparkles },
    { label: "Cart", href: "/cart", icon: ShoppingBag },
    { label: "Chat", href: "/chat", icon: MessageCircle },
    { label: "Node", href: "/profile", icon: User },
  ];

  // Role based overrides for the center icon
  if (user?.role === 'vendor') {
    menu[1] = { label: "Sales", href: "/vendor/dashboard", icon: Zap };
  } else if (user?.role === 'admin') {
    menu[1] = { label: "High Command", href: "/admin/dashboard", icon: Shield };
  }

  return (
    <>
      <div className="h-28 sm:hidden" /> 
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50 sm:hidden glass-panel backdrop-blur-3xl rounded-[32px] p-2 shadow-2xl border border-[var(--glass-border)] transition-colors duration-500 bg-[var(--bg-primary)]/80">
        <div className="flex items-center justify-around h-16 relative">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

            return (
              <Link 
                key={item.label} 
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${
                  isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <div className={`p-2.5 rounded-[18px] transition-all duration-500 relative ${
                  isActive ? 'bg-[var(--accent)]/10 scale-110 shadow-lg shadow-[var(--accent)]/10' : ''
                }`}>
                  <Icon className={`size-5 transition-all ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                  {isActive && (
                    <div className="absolute -top-1 -right-1 size-1.5 bg-[var(--accent)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent)]"></div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
