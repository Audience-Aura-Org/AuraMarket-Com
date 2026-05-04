"use client";

import { useEffect, useState } from 'react';
import { 
  Zap, Clock, ShoppingBag, ArrowUpRight, 
  Flame, Lock, ShieldCheck, Star, 
  ChevronRight, Timer, Globe, CheckCircle
} from 'lucide-react';
import Link from 'next/link';

const DROPS = [
  {
    id: 'drop-1',
    title: 'Aura Genesis-X',
    description: 'The definitive revision of high-velocity operational hardware. Limited node allocation.',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1200',
    price: '245,000 XAF',
    status: 'Live Now',
    tag: 'Operational',
    timer: '72:00:00'
  },
  {
    id: 'drop-2',
    title: 'Sector 7 Core',
    description: 'Surgical design for regional logistics hubs. Premium fulfillment nodes included.',
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=1200',
    price: '1.2M XAF',
    status: 'Coming Soon',
    tag: 'Infrastructure',
    timer: 'T-Minus 14H'
  }
];

export default function SignatureDropsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black transition-colors duration-500 overflow-hidden relative selection:bg-[var(--accent)] selection:text-white">
      
      {/* Visual Ambient Background */}
      <div className="absolute inset-x-0 top-0 h-[100vh] overflow-hidden pointer-events-none opacity-20">
         <div className="absolute top-[-20%] left-[-10%] size-[800px] bg-indigo-600/30 blur-[180px] rounded-full animate-pulse" />
         <div className="absolute bottom-[-20%] right-[-10%] size-[600px] bg-[var(--accent)]/20 blur-[150px] rounded-full animate-pulse" />
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-32 relative z-10 space-y-40">
        
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000">
           <div className="flex items-center gap-3 text-[var(--accent)] bg-white/5 w-fit px-8 py-3 rounded-full border border-white/10 shadow-2xl backdrop-blur-3xl overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <Flame className="size-5 fill-[var(--accent)]" />
              <span className="text-[10px] font-black  tracking-[0.6em]">High Velocity Drops</span>
           </div>
           <h1 className="text-7xl lg:text-9xl font-black text-white tracking-widest  leading-[0.8] mb-4">
              Signature <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] via-white/80 to-indigo-600">Drops</span>
           </h1>
           <p className="text-white font-medium text-lg lg:text-3xl opacity-40 max-w-4xl tracking-tighter leading-snug">
              Elite inventory. Precise allocation. The definitive standard for global commerce launches.
           </p>
           
           <div className="h-20 w-px bg-gradient-to-b from-white/20 to-transparent mx-auto mt-20" />
        </div>

        {/* Featured Drop */}
        {DROPS.map((drop, i) => (
           <div 
             key={drop.id} 
             className={`flex flex-col lg:flex-row gap-20 items-center justify-between ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-8 duration-1000`}
             style={{ animationDelay: `${i * 300}ms` }}
           >
              <div className="flex-1 space-y-10">
                 <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 bg-white/10 text-white px-5 py-2 rounded-xl border border-white/20 text-[10px] font-black tracking-wide backdrop-blur-xl">
                       <Timer className="size-4 text-[var(--accent)]" /> {drop.status}
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-5 py-2 rounded-xl border border-emerald-500/20 text-[10px] font-black tracking-wide backdrop-blur-xl">
                       <CheckCircle className="size-4" /> SECURE ALLOCATION
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h2 className="text-5xl lg:text-7xl font-black text-white  tracking-tighter leading-none group cursor-pointer">
                       {drop.title.split('-')[0]} <span className="text-[var(--accent)] block lg:inline">{drop.title.split('-')[1]}</span>
                    </h2>
                    <p className="text-white/40 text-lg lg:text-xl font-medium max-w-xl leading-relaxed">
                       {drop.description}
                    </p>
                 </div>

                 <div className="space-y-10">
                    <div className="flex items-center gap-10">
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-white/30 tracking-wide">Entry Price</p>
                          <p className="text-2xl font-black text-white">{drop.price}</p>
                       </div>
                       <div className="h-10 w-px bg-white/10" />
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-white/30 tracking-wide">Time Remaining</p>
                          <p className="text-2xl font-black text-[var(--accent)] font-mono">{drop.timer}</p>
                       </div>
                    </div>

                    <div className="flex items-center gap-6">
                       <Link 
                         href="/shop" 
                         className="h-20 lg:h-24 px-12 lg:px-16 rounded-[2.5rem] bg-white text-black font-black text-xs lg:text-sm  tracking-[0.4em] flex items-center gap-4 transition-all hover:scale-[1.03] active:scale-[0.97] hover:shadow-[0_0_50px_rgba(255,255,255,0.3)] shadow-2xl"
                       >
                          Secure Slot <ArrowUpRight className="size-5" />
                       </Link>
                       <button className="size-20 lg:size-24 rounded-[2.5rem] border-2 border-white/10 hover:border-white/40 text-white flex items-center justify-center transition-all hover:bg-white/5 active:scale-90 shadow-2xl group/share">
                          <ShoppingBag className="size-6 group-hover:scale-110 transition-transform" />
                       </button>
                    </div>
                 </div>
              </div>

              <div className="flex-1 w-full relative group">
                 <div className="absolute inset-0 bg-[var(--accent)]/10 blur-[120px] rounded-full scale-50 group-hover:scale-95 transition-all duration-1000 opacity-60" />
                 <div className="relative h-[600px] w-full rounded-[4rem] overflow-hidden border border-white/10 shadow-2xl transform-gpu transition-all duration-700 group-hover:rotate-1 hover:scale-[1.02]">
                    <img src={drop.image} className="size-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={drop.title} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                    
                    {/* Visual Interface Overlay */}
                    <div className="absolute top-10 right-10 flex flex-col items-end gap-3 text-white/40">
                       <div className="flex items-center gap-2 text-[8px] font-black  tracking-[0.4em] px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-2xl border border-white/10">
                          Live Feed <Globe className="size-3 animate-spin-slow text-[var(--accent)]" />
                       </div>
                       <div className="flex items-center gap-2 text-[8px] font-black  tracking-[0.4em] px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-2xl border border-white/10">
                          Lat. 4.05°N | Lon. 9.7°E
                       </div>
                    </div>

                    <div className="absolute bottom-10 left-10 p-8 glass-panel border border-white/20 rounded-[3rem] bg-black/40 backdrop-blur-3xl space-y-2 max-w-[280px]">
                       <div className="flex items-center gap-2 text-[var(--accent)]">
                          <Star className="size-4 fill-[var(--accent)]" />
                          <span className="text-[10px] font-black  tracking-[0.2em]">{drop.tag} Node</span>
                       </div>
                       <p className="text-white/60 font-medium text-xs leading-relaxed">
                          Synchronizing with global logistics centers for immediate fulfillment at launch.
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        ))}

        {/* Closing CTA Matrix */}
        <div className="text-center space-y-16 pb-40 relative group">
           <div className="absolute inset-0 bg-[var(--accent)]/[0.03] blur-[150px] rounded-full -top-40" />
           <div className="space-y-6">
              <h2 className="text-4xl lg:text-7xl font-black text-white/20 tracking-wide leading-none group-hover:text-white transition-colors duration-1000">Never <span className="text-white">Relay</span> Behind</h2>
              <p className="text-[10px] font-black tracking-[0.8em] text-[var(--accent)]  opacity-60">Join the Elite Distribution Network</p>
           </div>
           
           <Link href="/register" className="h-24 lg:h-32 px-16 lg:px-24 rounded-full border border-white/10 bg-white/5 hover:bg-[var(--accent)] text-white hover:text-black transition-all duration-700 flex items-center justify-center gap-10 hover:scale-110 active:scale-95 group/main">
              <span className="text-lg lg:text-2xl font-black  tracking-[0.5em]">Join the Core</span>
              <ArrowUpRight className="size-8 group-hover/main:translate-x-2 group-hover/main:-translate-y-2 transition-transform" />
           </Link>
        </div>

      </div>
    </div>
  );
}
