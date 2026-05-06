"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Package, Truck, ArrowRight, 
  ShoppingBag, ShieldCheck, Heart, Share2, Sparkles,
  PartyPopper, ChevronRight
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { cartStore } from '@/services/cartStore';

export default function OrderConfirmationPage() {
  const { id } = useParams();

  useEffect(() => {
    // Refresh cart store to sync with backend after items are pruned/ordered
    cartStore.refresh();
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[var(--bg-secondary)] px-8 py-24 overflow-hidden selection:bg-[var(--accent)]/30 transition-colors duration-500">
      
      {/* Dynamic Celebration Blobs */}
      <div className="absolute top-[-10%] right-[-5%] size-[600px] bg-[var(--accent)]/10 rounded-full blur-[140px] pointer-events-none transition-colors"></div>
      <div className="absolute bottom-[-10%] left-[-5%] size-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none transition-colors"></div>
      
      <main className="relative z-10 w-full max-w-3xl text-center">
        <div className="glass-panel p-12 md:p-20 rounded-[80px] border border-[var(--glass-border)] shadow-3xl relative overflow-hidden group bg-[var(--bg-primary)]/80 backdrop-blur-3xl">
           {/* Success Halo */}
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_4px_10px_rgba(16,185,129,0.3)]"></div>
           
           <div className="size-32 rounded-[48px] bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center mx-auto mb-16 shadow-2xl rotate-6 group-hover:rotate-12 transition-transform duration-700">
             <CheckCircle2 className="size-16" />
           </div>

           <h1 className="text-5xl md:text-8xl font-bold text-[var(--text-primary)] tracking-tighter leading-[0.9] mb-8 ">
             Protocol <br /> <span className="text-[var(--accent)]">Executed.</span>
           </h1>
           
           <p className="text-[var(--text-secondary)] font-medium text-xl mb-16 max-w-md mx-auto leading-relaxed opacity-60">
             Your high-value transaction <span className="font-bold text-[var(--text-primary)] opacity-100">#{id || '8812'}</span> is now secured in the Aura Escrow sanctuary.
           </p>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-16 px-4">
              <div className="p-10 rounded-[40px] bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex flex-col items-center gap-4 group/stat hover:bg-[var(--bg-primary)] hover:border-[var(--accent)]/20 transition-all shadow-inner">
                 <Package className="size-8 text-[var(--text-secondary)] group-hover/stat:text-[var(--accent)] transition-colors opacity-40 group-hover/stat:opacity-100" />
                 <div>
                    <span className="text-[11px] lg:text-[12px] font-bold tracking-[0.4em] text-[var(--text-secondary)]  opacity-30">Sanctuary Stash</span>
                    <p className="text-sm font-bold text-[var(--text-primary)] mt-1 ">2 Assets Verified</p>
                 </div>
              </div>
              <div className="p-10 rounded-[40px] bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex flex-col items-center gap-4 group/stat hover:bg-[var(--bg-primary)] hover:border-indigo-500/20 transition-all shadow-inner">
                 <Truck className="size-8 text-[var(--text-secondary)] group-hover/stat:text-indigo-500 transition-colors opacity-40 group-hover/stat:opacity-100" />
                 <div>
                    <span className="text-[11px] lg:text-[12px] font-bold tracking-[0.4em] text-[var(--text-secondary)]  opacity-30">Arrival Horizon</span>
                    <p className="text-sm font-bold text-[var(--text-primary)] mt-1 ">Oct 26-28 Cycle</p>
                 </div>
              </div>
           </div>

           <div className="flex flex-col gap-6 px-4">
              <Link href={`/orders/${id}/tracking`} className="w-full py-7 rounded-[32px] bg-[var(--accent)] text-white font-bold text-2xl flex items-center justify-center gap-4 shadow-2xl shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 hover:-translate-y-2 transition-all active:scale-95 group">
                Trace Signal <ChevronRight className="size-8 group-hover:translate-x-2 transition-transform" />
              </Link>
              <Link href="/discovery" className="w-full py-6 rounded-[32px] bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] font-bold text-xs tracking-[0.3em] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-all ">
                Return to Discovery
              </Link>
           </div>

           <div className="mt-20 flex items-center justify-center gap-12 opacity-30">
             <div className="flex items-center gap-3 text-[11px] lg:text-[12px] font-bold tracking-[0.3em] text-[var(--text-secondary)] "><ShieldCheck className="size-4 text-emerald-500" /> Vault Active</div>
             <div className="size-1.5 rounded-full bg-[var(--glass-border)]"></div>
             <div className="flex items-center gap-3 text-[11px] lg:text-[12px] font-bold tracking-[0.3em] text-[var(--text-secondary)] "><Sparkles className="size-4 text-indigo-500" /> Fully Encrypted</div>
           </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-8">
           <p className="text-[var(--text-secondary)] font-bold text-[10px] lg:text-[12px] tracking-[0.5em]  opacity-40">Broadcast Transmission</p>
           <div className="flex gap-6">
              <button className="size-16 rounded-[24px] bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-all flex items-center justify-center shadow-sm group">
                <Share2 className="size-6 group-hover:scale-110 transition-transform" />
              </button>
              <button className="size-16 rounded-[24px] bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-all flex items-center justify-center shadow-sm group">
                <Heart className="size-6 group-hover:scale-110 transition-transform" />
              </button>
           </div>
        </div>
      </main>

    </div>
  );
}
