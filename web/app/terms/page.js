'use client';

import { FileText, ArrowLeft, CheckCircle, Scale, Globe, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsAndConditions() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-24 px-8 md:px-20 transition-colors duration-500">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col gap-8 mb-16">
          <button 
            onClick={() => router.back()}
            className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all group shadow-sm"
          >
            <ArrowLeft className="size-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex flex-col gap-4">
             <div className="flex items-center gap-2 text-[var(--accent)]">
                <Scale className="size-5" />
                <span className="text-xs  font-bold  tracking-[0.4em]">System Status</span>
             </div>
             <h1 className="text-5xl  font-bold text-[var(--text-primary)] tracking-tighter  leading-tight">
                Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-indigo-600">Protocol</span>
             </h1>
             <p className="text-[var(--text-secondary)] max-w-xl opacity-60">
                Operating within the definitive Aura ecosystem. Our terms and conditions define the standards for premium commerce and secure interactions.
             </p>
          </div>
        </div>

        {/* Content Node */}
        <div className="glass-panel rounded-[2.5rem] p-10 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 backdrop-blur-3xl overflow-hidden relative">
           
           <div className="flex flex-col gap-12 relative z-10">
              
              <section className="flex flex-col gap-4">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <UserCheck className="size-5 text-[var(--accent)]" />
                    <h3 className="text-lg  font-bold tracking-tight">User Integrity</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    By creating an Aura profile, you agree to maintain professional conduct and absolute honesty in your vendor-customer interactions. Manipulation of ratings or identity is strictly prohibited.
                 </p>
              </section>

              <section className="flex flex-col gap-4">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Globe className="size-5 text-[var(--accent)]" />
                    <h3 className="text-lg  font-bold tracking-tight">Global Compliance</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    All vendors must adhere to local and international trade regulations. Auradime provides the infrastructure for commerce but is never the merchant of record for third-party products.
                 </p>
              </section>

              <section className="flex flex-col gap-4 text-emerald-500">
                 <div className="flex items-center gap-3">
                    <CheckCircle className="size-5" />
                    <h3 className="text-lg  font-bold tracking-tight">Financial Protocol</h3>
                 </div>
                 <p className="opacity-70 leading-relaxed text-sm">
                    All payment settlements are handled via our secure wallet accounts and escrow services. Attempting to bypass the Aura payment protocol results in immediate profile suspension.
                 </p>
              </section>

           </div>

           {/* Stylized BG Accent */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 -z-10" />

        </div>

        <div className="mt-16 text-center">
           <p className="text-[11px] lg:text-[12px]  font-semibold tracking-[0.5em] text-[var(--text-secondary)]  opacity-30">
              Auradime Global Terms of Service v1.0
           </p>
        </div>

      </div>
    </div>
  );
}
