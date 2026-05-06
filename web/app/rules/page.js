"use client";

import { Scale, ShieldAlert, ArrowLeft, Gavel, UserCheck, AlertCircle, Trash2, ShieldCheck, Globe, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MarketRulesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-24 px-8 md:px-20 transition-colors duration-500 selection:bg-[var(--accent)] selection:text-white">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col gap-8 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <button 
            onClick={() => router.back()}
            className="size-14 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:shadow-xl transition-all group"
          >
            <ArrowLeft className="size-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          
          <div className="space-y-6">
             <div className="flex items-center gap-3 text-[var(--accent)] bg-[var(--accent)]/5 w-fit px-5 py-2 rounded-full border border-[var(--accent)]/10">
                <Gavel className="size-5" />
                <span className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.4em]">Administrative Node</span>
             </div>
             <h1 className="text-6xl  font-bold text-[var(--text-primary)] tracking-tighter  leading-[0.85]">
                Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-indigo-600">Rules</span>
             </h1>
             <p className="text-[var(--text-secondary)] max-w-xl font-medium text-lg opacity-60 leading-relaxed">
                The definitive framework for global commerce. Our rules ensure absolute parity, security, and professional conduct across every node.
             </p>
          </div>
        </div>

        {/* Rules Matrix */}
        <div className="space-y-8 pb-32">
           
           {[
              {
                icon: UserCheck,
                title: 'Identity Integrity',
                text: 'All users must maintain a single, verified digital identity. Multiple accounts or synthetic profiles meant to manipulate ratings or commerce flow are subject to immediate termination.',
                severity: 'High'
              },
              {
                icon: Zap,
                title: 'Transaction Protocol',
                text: 'Bypassing the Aura settlement gateway is strictly prohibited. Direct messaging for external payments resulting in off-platform commerce resets the escrow protection for all involved nodes.',
                severity: 'Critical'
              },
              {
                icon: ShieldAlert,
                title: 'Merchant Conduct',
                text: 'Vendors must provide surgical precision in product manifests. Misleading descriptions, non-functional tracking nodes, or failure to fulfill verified orders impacts global reliability and results in profile suspension.',
                severity: 'Critical'
              },
              {
                icon: Trash2,
                title: 'Banned Catalog',
                text: 'Certain categories are restricted from the Aura global network. Review our legal node lists for prohibited inventory before establishing a storefront.',
                severity: 'High'
              }
           ].map((rule, i) => (
              <div 
                key={rule.title} 
                className="group glass-panel p-10 lg:p-12 rounded-[3.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-primary)]/80 hover:border-[var(--accent)]/40 transition-all duration-500 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                 <div className="absolute top-0 right-0 h-full w-2 bg-gradient-to-b from-transparent via-[var(--accent)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                 
                 <div className="flex flex-col md:flex-row gap-10 items-start">
                    <div className="size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500">
                       <rule.icon className="size-8" />
                    </div>
                    <div className="space-y-6 flex-1">
                       <div className="flex items-center justify-between">
                          <h3 className="text-2xl  font-bold text-[var(--text-primary)] tracking-tight">{rule.title}</h3>
                          <div className={`px-4 py-1.5 rounded-full text-[11px] lg:text-[12px]  font-semibold tracking-tight border ${rule.severity === 'Critical' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
                             {rule.severity} Priority
                          </div>
                       </div>
                       <p className="text-[var(--text-secondary)] font-medium text-lg leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                          {rule.text}
                       </p>
                    </div>
                 </div>
              </div>
           ))}

           {/* Legal Footer */}
           <div className="glass-panel p-12 rounded-[4rem] border-2 border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)] text-center space-y-8 group">
              <ShieldCheck className="size-16 mx-auto text-emerald-500 mb-4 group-hover:scale-110 transition-transform duration-700" />
              <h2 className="text-3xl  font-bold text-[var(--text-primary)]  tracking-tighter leading-none">Global Governance</h2>
              <p className="text-[var(--text-secondary)] font-medium opacity-60 leading-relaxed max-w-xl mx-auto">
                 By operating within the Aura ecosystem, you definitively agree to these rules. We reserve the right to recalibrate profiles found in violation of these protocols.
              </p>
              <div className="pt-6">
                 <p className="text-[11px] lg:text-[12px]  font-semibold tracking-[0.5em] text-[var(--text-secondary)]  opacity-30">
                    Aura Market Governance Protocol v1.4.0
                 </p>
              </div>
           </div>

        </div>

      </div>
    </div>
  );
}
