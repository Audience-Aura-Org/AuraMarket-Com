"use client";

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { 
  ArrowLeft, Bell, Tag, Truck, Gift, Users, 
  Copy, Share2, PlusCircle, MinusCircle 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RewardsPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const referralCode = "AURA-X94B";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-hidden pb-24 transition-colors duration-500">
      {/* Gradients */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--accent)]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-[var(--accent-light)]/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="sticky top-0 z-50 bg-[var(--bg-secondary)]/80 backdrop-blur-xl px-8 py-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.back()} className="size-12 flex items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-4xl font-black tracking-tighter  text-[var(--text-primary)]">Aura Rewards</h1>
          </div>
          <button className="size-12 flex items-center justify-center rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/50 transition-all shadow-sm">
            <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        <main className="px-8 space-y-12 mt-4">
          
          {/* Balance Card */}
          <section className="relative overflow-hidden p-12 rounded-[48px] bg-[var(--bg-primary)]/80 border border-[var(--accent)]/20 shadow-2xl glass-panel">
            <div className="relative z-10">
              <p className="text-[10px] font-black text-[var(--accent)] tracking-[0.4em] mb-4  opacity-80">Accumulated Points</p>
              <div className="flex items-baseline gap-3">
                <h2 className="text-7xl font-black text-[var(--text-primary)] tracking-tighter font-mono">2,840</h2>
                <span className="text-3xl font-black text-[var(--accent)]">AUR</span>
              </div>
              <div className="mt-12 flex items-center gap-6">
                <div className="flex-1 h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--glass-border)] shadow-inner">
                  <div className="h-full bg-[var(--accent)] w-[70%] rounded-full shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)] animate-pulse" />
                </div>
                <span className="text-[10px] font-black tracking-widest text-[var(--text-secondary)] whitespace-nowrap ">70% to Gold Tier</span>
              </div>
            </div>
            <div className="absolute -right-16 -top-16 size-64 bg-[var(--accent)]/10 blur-[80px] rounded-full" />
          </section>

          {/* Redeem */}
          <section>
            <div className="flex items-center justify-between mb-8 px-2">
              <h3 className="text-2xl font-black tracking-tight ">Redeem Nexus</h3>
              <button className="text-[10px] font-black tracking-[0.2em] text-[var(--accent)] hover:underline transition-all ">View Matrix</button>
            </div>
            <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
              <RewardCard icon={Tag} title="15% Off Total" points="500" action="Redeem" color="bg-[var(--accent)] text-white" />
              <RewardCard icon={Truck} title="Free Express" points="250" action="Redeem" color="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]" />
              <RewardCard icon={Gift} title="50,000 XAF Voucher" points="5000" action="Locked" color="bg-[var(--bg-secondary)] text-[var(--text-secondary)]/40" disabled />
            </div>
          </section>

          {/* Referral Card */}
          <section className="bg-[var(--bg-primary)]/40 border border-dashed border-[var(--accent)]/30 rounded-[56px] p-12 hover:bg-[var(--bg-primary)]/60 transition-all duration-500">
            <div className="flex flex-col items-center justify-center text-center gap-8">
              <div className="size-24 rounded-[32px] bg-gradient-to-tr from-[var(--accent)] to-indigo-600 flex items-center justify-center shadow-2xl rotate-3">
                <Users className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-4">
                <h3 className="text-4xl font-black tracking-tight ">Expansion Protocol</h3>
                <p className="text-lg font-medium text-[var(--text-secondary)] px-8 leading-relaxed opacity-70">
                  Secure 20,000 XAF for your network and receive 20,000 XAF credit upon their first synchronization.
                </p>
              </div>
              <div className="w-full flex items-center gap-4 mt-8">
                <div 
                  onClick={handleCopy}
                  className="flex-1 bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/50 transition-all rounded-[28px] p-6 flex justify-between items-center group cursor-pointer shadow-inner"
                >
                  <span className="font-mono font-black text-[var(--accent)] tracking-widest text-xl">
                    {copied ? 'Copied' : referralCode}
                  </span>
                  <Copy className="size-6 text-[var(--text-secondary)]/30 group-hover:text-[var(--accent)] transition-colors" />
                </div>
                <button className="size-20 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-[32px] shrink-0 flex items-center justify-center shadow-2xl hover:bg-[var(--accent)] hover:text-white hover:-translate-y-2 transition-all">
                  <Share2 className="size-8" />
                </button>
              </div>
            </div>
          </section>

          {/* Activity */}
          <section className="pb-12">
            <h3 className="text-2xl font-black tracking-tight mb-8 px-2 ">Sync Activity</h3>
            <div className="space-y-4">
              <ActivityRow 
                icon={PlusCircle} title="Protocol Reward" 
                subtitle="Oct 24, 2023 &bull; Node #8271" 
                amount="+142 pts" type="positive" 
              />
              <ActivityRow 
                icon={MinusCircle} title="Redeemed Credit" 
                subtitle="Oct 18, 2023 &bull; 10% Activation" 
                amount="-300 pts" type="negative" 
              />
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

function RewardCard({ icon: Icon, title, points, action, color, disabled }) {
  return (
    <div className={`min-w-[200px] bg-[var(--bg-primary)] border border-[var(--glass-border)] p-8 rounded-[40px] flex flex-col gap-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 ${disabled ? 'opacity-40 grayscale-[0.5]' : ''}`}>
      <div className="size-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner">
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <p className="text-xl font-black text-[var(--text-primary)] tracking-tight">{title}</p>
        <p className="text-[10px] font-black tracking-widest text-[var(--text-secondary)] mt-2  opacity-60">{points} AUR Points</p>
      </div>
      <button disabled={disabled} className={`w-full py-4 text-[10px] font-black tracking-widest rounded-2xl transition-all  mt-2 shadow-sm ${color} ${!disabled && 'hover:scale-95'}`}>
        {action}
      </button>
    </div>
  );
}

function ActivityRow({ icon: Icon, title, subtitle, amount, type }) {
  const isPos = type === 'positive';
  return (
    <div className="flex items-center justify-between p-8 bg-[var(--bg-primary)]/80 border border-[var(--glass-border)] rounded-[32px] hover:bg-[var(--bg-primary)] transition-all shadow-sm group">
      <div className="flex items-center gap-6">
        <div className={`size-16 rounded-2xl flex items-center justify-center shadow-inner ${isPos ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
          <Icon className="size-8" />
        </div>
        <div>
          <p className="text-xl font-black tracking-tight text-[var(--text-primary)] ">{title}</p>
          <p className="text-[10px] font-black tracking-widest text-[var(--text-secondary)] mt-1.5  opacity-30">{subtitle}</p>
        </div>
      </div>
      <span className={`text-xl font-black font-mono ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
        {amount}
      </span>
    </div>
  );
}


