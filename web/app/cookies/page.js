"use client";

import { Cookie, ArrowLeft, Shield, Lock, Eye, FileText, Settings, Database, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CookiePolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-24 px-8 md:px-20 transition-colors duration-500">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col gap-8 mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <button 
            onClick={() => router.back()}
            className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all group shadow-sm"
          >
            <ArrowLeft className="size-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex flex-col gap-4">
             <div className="flex items-center gap-2 text-[var(--accent)]">
                <Cookie className="size-5" />
                <span className="text-xs  font-bold  tracking-[0.4em]">Tracking Node</span>
             </div>
             <h1 className="text-5xl  font-bold text-[var(--text-primary)] tracking-tighter  leading-tight">
                Cookie <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-indigo-600">Policy</span>
             </h1>
             <p className="text-[var(--text-secondary)] max-w-xl opacity-60 font-medium">
                Our definitive protocol for digital breadcrumbs and session synchronization. We prioritize transparency and user control in all tracking interactions.
             </p>
          </div>
        </div>

        {/* Content Node */}
        <div className="glass-panel rounded-[2.5rem] p-10 lg:p-14 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 backdrop-blur-3xl overflow-hidden relative">
           
           <div className="flex flex-col gap-16 relative z-10">
              
              <section className="flex flex-col gap-6">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Database className="size-6 text-[var(--accent)]" />
                    <h3 className="text-xl  font-bold tracking-tight">Essential Nodes</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    These cookies are strictly necessary for the core functionality of Aura Market. They handle session authentication, secure wallet encryption, and regional storefront calibration. Disabling these will result in system-level instability.
                 </p>
              </section>

              <section className="flex flex-col gap-6">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Settings className="size-6 text-[var(--accent)]" />
                    <h3 className="text-xl  font-bold tracking-tight">Personalization Sync</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    We utilize preferences cookies to remember your visual settings (Light/Dark mode), currency nodes (XAF/BTC/Digital Assets), and filtered merchant layouts across multiple sessions.
                 </p>
              </section>

              <section className="flex flex-col gap-6">
                 <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Server className="size-6 text-[var(--accent)]" />
                    <h3 className="text-xl  font-bold tracking-tight">Analytical Insights</h3>
                 </div>
                 <p className="text-[var(--text-secondary)] leading-relaxed text-sm opacity-70">
                    Surgical data collection via anonymized cookies helps us optimize the Aura infrastructure. We monitor performance latency, heatmaps of high-traffic products, and merchant conversion benchmarks.
                 </p>
              </section>

              {/* Cookie Management Table */}
              <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
                 <table className="w-full text-left border-collapse">
                    <thead>
                       <tr className="bg-[var(--bg-primary)]/80 text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-50">
                          <th className="p-5 border-b border-[var(--glass-border)]">Designation</th>
                          <th className="p-5 border-b border-[var(--glass-border)]">Purpose</th>
                          <th className="p-5 border-b border-[var(--glass-border)]">Expiration</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)] text-[var(--text-secondary)]">
                       <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-5  font-semibold text-[11px] lg:text-[12px] text-[var(--text-primary)] ">aura_session_node</td>
                          <td className="p-5 text-xs opacity-70">Secure user authentication and token storage</td>
                          <td className="p-5 text-[11px] lg:text-[12px]  font-semibold  opacity-40">30 Solar Cycles</td>
                       </tr>
                       <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-5  font-semibold text-[11px] lg:text-[12px] text-[var(--text-primary)] ">aura_theme_pref</td>
                          <td className="p-5 text-xs opacity-70">Visual rendering configuration (Dark/Light)</td>
                          <td className="p-5 text-[11px] lg:text-[12px]  font-semibold  opacity-40">Immortal Node</td>
                       </tr>
                       <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-5  font-semibold text-[11px] lg:text-[12px] text-[var(--text-primary)] ">aura_cart_manifest</td>
                          <td className="p-5 text-xs opacity-70">Persistence of local selection inventory</td>
                          <td className="p-5 text-[11px] lg:text-[12px]  font-semibold  opacity-40">Session-Specific</td>
                       </tr>
                    </tbody>
                 </table>
              </div>

           </div>

           {/* Stylized BG Accent */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 -z-10 animate-pulse" />

        </div>

        <div className="mt-16 text-center">
           <p className="text-[11px] lg:text-[12px]  font-semibold tracking-[0.5em] text-[var(--text-secondary)]  opacity-30">
              Aura Market Global Cookie Governance v1.0
           </p>
        </div>

      </div>
    </div>
  );
}
