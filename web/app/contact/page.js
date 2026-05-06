"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, ShieldCheck, Mail, ArrowRight, Loader2, Globe, Server, Zap } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';

export default function GeneralContactPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdmin = async () => {
      try {
        const res = await api.get('/auth/admin-info');
        if (res.data?.success) {
          setAdmin(res.data.data.admin);
        }
      } catch (err) {
        console.error('Failed to fetch admin info:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdmin();
  }, []);

  const handleMessageAdmin = () => {
    if (!user) {
      router.push('/login?redirect=/contact');
      return;
    }
    if (admin) {
      router.push(`/chat?vendorId=${admin._id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-24 px-8 md:px-20 transition-colors duration-500 overflow-hidden relative selection:bg-[var(--accent)] selection:text-white">
      
      {/* Background Ambience */}
      <div className="absolute inset-x-0 top-0 h-[100vh] opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--accent) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="absolute top-0 left-0 w-[800px] height-[800px] bg-[var(--accent)]/5 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2" />

      <div className="max-w-4xl mx-auto space-y-20 relative z-10">
        
        {/* Header Section */}
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex items-center justify-center gap-3 text-[var(--accent)] bg-[var(--accent)]/5 w-fit mx-auto px-6 py-2.5 rounded-full border border-[var(--accent)]/10 shadow-sm">
            <Globe className="size-5" />
            <span className="text-[11px] lg:text-[12px] font-quicksand font-bold  tracking-[0.4em]">Global Communications</span>
          </div>
          <h1 className="text-6xl lg:text-8xl font-quicksand font-bold text-[var(--text-primary)] tracking-tighter  leading-[0.85]">
            Contact <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-indigo-600">Aura</span>
          </h1>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto font-medium text-lg lg:text-xl opacity-60 leading-relaxed">
            Synchronize with our administrative nodes for definitive resolution of platform inquiries or support requests.
          </p>
        </div>

        {/* Messaging Tier */}
        <div className="glass-panel rounded-[3.5rem] p-12 lg:p-20 border-2 border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)] shadow-2xl relative overflow-hidden group transition-all duration-700 hover:border-[var(--accent)]/30">
           <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/[0.03] blur-3xl rounded-full translate-x-32 -translate-y-32" />
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-10">
                 <div className="size-20 rounded-3xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20 shadow-xl group-hover:scale-110 transition-transform duration-700">
                    <MessageSquare className="size-10" />
                 </div>
                 <div className="space-y-6">
                    <h2 className="text-4xl font-quicksand font-bold text-[var(--text-primary)]  tracking-tighter leading-none">Platform <span className="text-[var(--accent)]">Admin</span></h2>
                    <p className="text-[var(--text-secondary)] text-base font-medium opacity-60 leading-relaxed">
                       Engage directly with our governance nodes for surgical assistance regarding your account, vendor status, or fulfillment issues.
                    </p>
                 </div>
              </div>

              <div className="flex flex-col gap-8">
                 {loading ? (
                    <div className="h-24 bg-[var(--bg-primary)]/50 rounded-3xl animate-pulse flex items-center justify-center border border-[var(--glass-border)]">
                       <Loader2 className="size-6 animate-spin text-[var(--accent)] opacity-40" />
                    </div>
                 ) : (
                    <button 
                      onClick={handleMessageAdmin}
                      className="h-24 bg-[var(--accent)] text-white rounded-3xl flex items-center justify-between px-10 transition-all hover:scale-[1.03] shadow-2xl shadow-[var(--accent)]/30 active:scale-95 group/btn overflow-hidden relative"
                    >
                       <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                       <div className="flex items-center gap-6 relative z-10">
                          <div className="size-12 rounded-xl bg-white/20 p-0.5 border border-white/20">
                             <img src={admin?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=Admin&backgroundColor=var(--accent)`} className="size-full object-cover rounded-lg shadow-sm" alt="" />
                          </div>
                          <div className="text-left leading-none">
                             <span className="block text-[11px] lg:text-[12px] font-quicksand font-bold  tracking-[0.3em] opacity-60 mb-1">Direct Signal</span>
                             <span className="block text-sm font-quicksand font-bold tracking-tight">Message Admin</span>
                          </div>
                       </div>
                       <ArrowRight className="size-6 group-hover/btn:translate-x-2 transition-transform relative z-10" />
                    </button>
                 )}

                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 rounded-3xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex flex-col items-center text-center gap-4 group/node hover:border-[var(--accent)]/20 transition-all">
                       <Server className="size-6 text-[var(--text-secondary)] opacity-40 group-hover/node:text-[var(--accent)] transition-all" />
                       <p className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight text-[var(--text-secondary)] opacity-60 group-hover/node:opacity-100">Core Relay Alpha</p>
                    </div>
                    <div className="p-6 rounded-3xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex flex-col items-center text-center gap-4 group/node hover:border-[var(--accent)]/20 transition-all">
                       <Zap className="size-6 text-[var(--text-secondary)] opacity-40 group-hover/node:text-[var(--accent)] transition-all" />
                       <p className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight text-[var(--text-secondary)] opacity-60 group-hover/node:opacity-100">Low-Lat Assist</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Alternative Channels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="glass-panel p-10 rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 space-y-6 hover:-translate-y-2 transition-all duration-500">
              <Mail className="size-10 text-[var(--accent)]" />
              <h3 className="text-xl font-quicksand font-bold tracking-tight text-[var(--text-primary)]">Corporate Inquiry</h3>
              <p className="text-[var(--text-secondary)] text-sm font-medium opacity-60 leading-relaxed">
                 For partnerships, legal nodes, or regional expansion proposals. Definitive response in 24 Solar Cycles.
              </p>
              <a href="mailto:corporate@auramarket.global" className="block text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight text-[var(--accent)] hover:underline">corporate@auramarket.global</a>
           </div>
           
           <div className="glass-panel p-10 rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 space-y-6 hover:-translate-y-2 transition-all duration-500">
              <ShieldCheck className="size-10 text-emerald-500" />
              <h3 className="text-xl font-quicksand font-bold tracking-tight text-[var(--text-primary)]">Security Relay</h3>
              <p className="text-[var(--text-secondary)] text-sm font-medium opacity-60 leading-relaxed">
                 Report security anomalies, identity vulnerabilities, or fraudulent merchant nodes to our core defense unit.
              </p>
              <a href="mailto:security@auramarket.global" className="block text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight text-emerald-500 hover:underline">security@auramarket.global</a>
           </div>
        </div>

        <div className="text-center pt-20 pb-40">
           <p className="text-[11px] lg:text-[12px] font-quicksand font-bold tracking-[0.5em] text-[var(--text-secondary)]  opacity-30">
              Aura Market Global Communications Protocol v2.5.0
           </p>
        </div>

      </div>
    </div>
  );
}
