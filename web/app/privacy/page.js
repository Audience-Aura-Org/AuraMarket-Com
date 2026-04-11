'use client';

import { Shield, ArrowLeft, Lock, Eye, FileText, RefreshCw, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-24 px-8 md:px-20 transition-colors duration-500">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col gap-8 mb-16">
          <button 
            onClick={() => router.back()}
            className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all group"
          >
            <ArrowLeft className="size-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex flex-col gap-4">
             <div className="flex items-center gap-2 text-[var(--accent)]">
                <Shield className="size-5" />
                <span className="text-xs font-black uppercase tracking-[0.4em]">Security Node</span>
             </div>
             <h1 className="text-5xl font-black text-[var(--text-primary)] tracking-tighter uppercase leading-tight">
                Privacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-indigo-600">Protocol</span>
             </h1>
             <p className="text-[var(--text-secondary)] max-w-xl opacity-60">
                Aura Market is committed to the definitive protection of your digital identity. Our privacy protocol ensures total encryption and user autonomy.
             </p>
          </div>
        </div>

        {/* Content Node */}
        <div className="glass-panel rounded-[2.5rem] p-10 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 backdrop-blur-3xl overflow-hidden relative">
           
           <div className="flex flex-col gap-12 relative z-10">
              
              <section className="flex flex-col gap-4">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Lock className="size-5 text-[var(--accent)]" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Data Encryption</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    All transaction data and user communications are wrapped in end-to-end encryption. Your private keys and wallet balances are never stored in plain text.
                 </p>
              </section>

              <section className="flex flex-col gap-4">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Eye className="size-5 text-[var(--accent)]" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Information Usage</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    We collect minimal identity data—only what is strictly necessary for vendor verification and order logistics. We never sell your data to third-party brokers.
                 </p>
              </section>

              <section className="flex flex-col gap-4">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <FileText className="size-5 text-[var(--accent)]" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Your Autonomy</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    At any time, you may request the full extraction or permanent erasure of your Aura profile. Your digital sovereignty is our priority.
                 </p>
              </section>

              <section className="flex flex-col gap-4">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <RefreshCw className="size-5 text-[var(--accent)]" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Session Persistence</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    We use definitive session tokens (cookies) to maintain your secure node connection. These are encrypted with your terminal signature to prevent unauthorized relay.
                 </p>
              </section>

              <section className="flex flex-col gap-4">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Globe className="size-5 text-[var(--accent)]" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Global Alignment</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    Our protocol is designed to exceed the requirements of regional data protection acts (GDPR, CCPA). We operate as a decentralized data custodian.
                 </p>
              </section>

           </div>

           {/* Stylized BG Accent */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 -z-10" />

        </div>

        <div className="mt-16 text-center">
           <p className="text-[9px] font-black tracking-[0.5em] text-[var(--text-secondary)] uppercase opacity-30">
              Aura Market Global Privacy Standard v1.0
           </p>
        </div>

      </div>
    </div>
  );
}
