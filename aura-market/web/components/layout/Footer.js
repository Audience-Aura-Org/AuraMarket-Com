"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Facebook, Instagram, Twitter, Github, Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function Footer() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const currentYear = new Date().getFullYear();

  // Hide on auth, admin, vendor, logistics pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/vendor') || pathname?.startsWith('/logistics') || pathname === '/login' || pathname === '/register') return null;

  return (
    <footer className="relative bg-[var(--bg-primary)] border-t border-[var(--glass-border)] pt-20 pb-10 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] opacity-10 pointer-events-none" style={{background:'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter:'blur(80px)'}} />

      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          
          {/* Brand Info */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-8 w-auto flex items-center justify-center transition-all group-hover:scale-110">
                 <img 
                    src={theme === 'dark' ? '/logo-white.png' : '/logo-black.png'} 
                   alt="Aura Market" 
                   className="h-6 w-auto object-contain"
                 />
              </div>
              <h1 className="text-xl font-black tracking-tighter text-[var(--text-primary)] uppercase">
                Aura <span className="text-[var(--accent)]">Market</span>
              </h1>
            </Link>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs">
              The world's leading marketplace for premium digital and physical assets, wrapped in a stunning liquid-glass interface for the modern node.
            </p>
            <div className="flex items-center gap-4">
              {[Facebook, Instagram, Twitter, Github].map((Icon, i) => (
                <Link key={i} href="#" className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all">
                  <Icon className="size-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Marketplace</h4>
            <ul className="space-y-4">
              <li><Link href="/shop" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Explore All Assets</Link></li>
              <li><Link href="/discovery" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Daily Discovery</Link></li>
              <li><Link href="/stores" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Verified Artisans</Link></li>
              <li><Link href="/register?vendor=true" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors text-[var(--accent)] font-bold">Become a Vendor</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Resources</h4>
            <ul className="space-y-4">
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Help Center</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Dispute Resolution</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Stay in the Loop</h4>
            <p className="text-sm text-[var(--text-secondary)]">Get weekly drops of premium assets and marketplace updates.</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="node@aura.market"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-[var(--accent)]/50 transition-all"
              />
              <button className="bg-[var(--accent)] text-white p-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[var(--accent)]/20">
                <ArrowRight className="size-5" />
              </button>
            </div>
            <div className="flex items-center gap-4 pt-2 text-[10px] uppercase font-black tracking-widest text-[var(--text-secondary)] opacity-40">
              <div className="flex items-center gap-1"><Shield className="size-3" /> Encrypted</div>
              <div className="flex items-center gap-1"><Sparkles className="size-3" /> Premium</div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[var(--glass-border)] flex flex-col md:flex-row items-center justify-between gap-6 opacity-60">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]">
            © {currentYear} Aura Market. Designed for Excellence.
          </p>
          <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest">
             <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Network Status: Optimal
             </div>
             <div className="flex items-center gap-2">
                Server: EU-West-Node
             </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Shield({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
