"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, ShoppingBag, User, House, Store, Truck, ShieldCheck,
  LayoutGrid, LogIn
} from "lucide-react";
import { useAuthStore } from '@/hooks/useAuth';

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isChatPage = pathname?.startsWith('/chat') || pathname?.startsWith('/messages');
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register');

  if (!mounted || isChatPage || isAuthPage) return null;

  const menu = [
    { label: "Discover", href: "/discovery", icon: Compass },
    { label: "Home", href: "/", icon: House },
    { label: "Cart", href: "/cart", icon: ShoppingBag },
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
                <span className={`mt-0.5 text-[10px] font-semibold tracking-tight leading-none ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
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
