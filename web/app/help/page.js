"use client";

import { useState, useEffect } from 'react';
import { 
  Search, MessageCircle, HelpCircle, ShieldCheck, Truck, 
  CreditCard, UserCheck, ArrowRight, LifeBuoy, Zap, Mail,
  ExternalLink, ChevronRight, Globe, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';

const CATEGORIES = [
  { icon: HelpCircle, title: 'Purchasing', count: 12 },
  { icon: Truck, title: 'Logistics', count: 8 },
  { icon: ShieldCheck, title: 'Security', count: 5 },
  { icon: UserCheck, title: 'Vendor Hub', count: 15 }
];

export default function HelpHubPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoadingAdmin(false);
      return;
    }

    const fetchAdmin = async () => {
      try {
        const res = await api.get('/auth/admin-info');
        if (res.data?.success) setAdmin(res.data.data.admin);
      } catch (err) { console.error(err); }
      finally { setLoadingAdmin(false); }
    };
    fetchAdmin();
  }, [user]);

  const handleMessageAdmin = () => {
    if (!user) return router.push('/login?redirect=/help');
    if (admin) router.push(`/chat?vendorId=${admin._id}`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-12 px-6 md:px-12 transition-all duration-300">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Slim Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
           <div className="space-y-2">
              <h1 className="text-4xl font-bold text-[var(--text-primary)] tracking-tight">Help <span className="text-[var(--accent)]">Hub</span></h1>
              <p className="text-xs font-medium text-[var(--text-secondary)] opacity-40 tracking-tight">Aura Support Matrix v2.0</p>
           </div>
           
           <div className="relative group w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-30" />
              <input 
                type="text" 
                placeholder="Search resources..." 
                className="w-full h-12 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl pl-12 pr-4 text-sm focus:border-[var(--accent)]/50 focus:ring-4 focus:ring-[var(--accent)]/5 transition-all outline-none"
              />
           </div>
        </div>

        {/* Quick Node Grid (Slim Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {CATEGORIES.map((cat) => (
              <button key={cat.title} className="p-5 rounded-2xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] hover:bg-[var(--bg-primary)] hover:border-[var(--accent)]/30 transition-all text-left space-y-4 group">
                 <div className="size-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--accent)] group-hover:scale-110 transition-transform">
                    <cat.icon className="size-5" />
                 </div>
                 <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-tight">{cat.title}</h3>
                    <p className="text-[9px] font-medium text-[var(--text-secondary)] opacity-40 tracking-tight">{cat.count} articles</p>
                 </div>
              </button>
           ))}
        </div>

        {/* Admin Messaging (Unified Hub) */}
        <div className="p-6 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/5 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2" />
           <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="flex items-center gap-6">
                 <div className="size-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[var(--accent)] p-0.5">
                    {loadingAdmin ? (
                       <Loader2 className="size-5 animate-spin opacity-20" />
                    ) : (
                       <img src={admin?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=Admin&backgroundColor=var(--accent)`} className="size-full object-cover rounded-xl shadow-sm" alt="" />
                    )}
                 </div>
                 <div className="space-y-1">
                    <p className="text-[9px] font-bold tracking-[0.2em] text-[var(--accent)] ">Platform Core</p>
                    <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Direct Support Node</h2>
                    <p className="text-xs font-medium text-[var(--text-secondary)] opacity-40">Average latency: 4 Solar Cycles</p>
                 </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                 {!user ? (
                   <button 
                     onClick={() => router.push('/login?redirect=/help')}
                     className="h-12 px-8 flex-1 md:flex-none border border-[var(--accent)]/40 text-[var(--accent)] rounded-xl text-[10px] font-bold tracking-tight flex items-center justify-center gap-3 hover:bg-[var(--accent)]/5 transition-all"
                   >
                     Login to Sync <ArrowRight className="size-3" />
                   </button>
                 ) : loadingAdmin ? (
                   <div className="h-12 px-8 bg-[var(--bg-secondary)] rounded-xl flex items-center justify-center">
                     <Loader2 className="size-4 animate-spin opacity-20" />
                   </div>
                 ) : (
                   <button 
                     onClick={handleMessageAdmin}
                     className="h-12 px-8 flex-1 md:flex-none bg-[var(--accent)] text-white rounded-xl text-[10px] font-bold tracking-tight flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[var(--accent)]/20"
                   >
                      Start Transmission <Zap className="size-3 fill-white" />
                   </button>
                 )}
                 <a href="mailto:support@auramarket.global" className="size-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-white/10 transition-all">
                    <Mail className="size-5" />
                 </a>
              </div>
           </div>
        </div>

        {/* Dynamic resource stream */}
        <div className="space-y-4">
           <h4 className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40  tracking-[0.4em] px-1">Definitive Guides</h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: 'The Escrow Cycle Explained', tag: 'Protocol' },
                { title: 'Merchant Rating Standards', tag: 'Trust' },
                { title: 'Global Delivery Latency Map', tag: 'Flow' },
                { title: 'Secure Cryptographic Settlement', tag: 'Security' }
              ].map(guide => (
                 <button key={guide.title} className="p-4 rounded-xl bg-white/5 border border-[var(--glass-border)] flex items-center justify-between hover:bg-white/10 transition-all group">
                    <div className="flex flex-col text-left">
                       <span className="text-[8px] font-bold text-[var(--accent)] tracking-tight mb-1">{guide.tag}</span>
                       <span className="text-xs font-bold text-[var(--text-primary)]">{guide.title}</span>
                    </div>
                    <ChevronRight className="size-4 text-[var(--text-secondary)] opacity-20 group-hover:translate-x-1 transition-all" />
                 </button>
              ))}
           </div>
        </div>

        {/* Slim Legal Footnote */}
        <div className="pt-12 text-center">
           <p className="text-[8px] font-medium text-[var(--text-secondary)] opacity-20 tracking-[0.3em] ">
              Operated via Aura Global Systems Node // Douala, CM
           </p>
        </div>

      </div>
    </div>
  );
}
