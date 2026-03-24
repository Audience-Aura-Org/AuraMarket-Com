"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, ShoppingBag, User,
  MessageCircle,
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
    { label: "Discover", href: "/discovery", icon: Compass },
    { label: "Home", href: "/", icon: Sparkles },
    { label: "Cart", href: "/cart", icon: ShoppingBag },
    { label: "Messages", href: "/chat", icon: MessageCircle },
    { label: "Profile", href: "/profile", icon: User },
  ];

  // Role based overrides for the center icon
  if (user?.role === 'vendor') {
    menu[1] = { label: "Dashboard", href: "/vendor/dashboard", icon: Zap };
  } else if (user?.role === 'admin') {
    menu[1] = { label: "Admin", href: "/admin/dashboard", icon: Shield };
  }

  return (
    <>
      <div className="h-20 sm:hidden" />
      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden px-3 pb-3 pt-2 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/85 to-transparent">
        <div className="glass-panel backdrop-blur-2xl rounded-2xl p-2 shadow-xl border border-[var(--glass-border)] transition-colors duration-500 bg-[var(--bg-primary)]/85">
          <div className="flex items-center justify-around h-14 relative">
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
                <div className={`p-1.5 rounded-xl transition-all duration-300 relative ${
                  isActive ? 'bg-[var(--accent)]/10 scale-105 shadow-lg shadow-[var(--accent)]/10' : ''
                }`}>
                  <Icon className={`size-4.5 transition-all ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                  {isActive && (
                    <div className="absolute -top-1 -right-1 size-1.5 bg-[var(--accent)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent)]"></div>
                  )}
                </div>
                <span className={`mt-0.5 text-[10px] font-black tracking-wide uppercase leading-none ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
        </div>
      </nav>
    </>
  );
}
