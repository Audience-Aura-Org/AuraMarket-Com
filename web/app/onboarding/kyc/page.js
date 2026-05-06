"use client";

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import {
   ShieldCheck, Upload, FileText, UserCheck,
   MapPin, Clock, ArrowLeft, ArrowRight, CheckCircle2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function KYCPage() {
   const router = useRouter();
   const [step, setStep] = useState(1);
   const [loading, setLoading] = useState(false);

   const steps = [
      { id: 1, title: 'Identity Matrix', icon: FileText, desc: 'Official government credentials' },
      { id: 2, title: 'Operational Base', icon: MapPin, desc: 'Verified physical address proof' },
      { id: 3, title: 'Biometric Sync', icon: UserCheck, desc: 'Liveness and facial verification' }
   ];

   return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center p-6 md:p-12 relative overflow-hidden">

         {/* Optimized Background Decor */}
         <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(circle_at_20%_20%,var(--accent)_0%,transparent_40%),radial-gradient(circle_at_80%_80%,_#3b82f6_0%,transparent_40%)] opacity-[0.03]" />

         <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[1000px] w-full bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--glass-border)] rounded-[48px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[700px]"
         >

            {/* Left Side: Progress HUD */}
            <div className="w-full md:w-80 bg-[var(--bg-primary)]/40 border-r border-[var(--glass-border)] p-12 flex flex-col gap-12">
               <button onClick={() => router.back()} className="flex items-center gap-2 text-[11px] font-bold tracking-tight  opacity-40 hover:opacity-100 transition-opacity">
                  <ArrowLeft className="size-4" /> Go Back
               </button>

               <div className="space-y-4">
                  <ShieldCheck className="size-10 text-[var(--accent)]" />
                  <h1 className="text-3xl font-bold tracking-tighter  leading-tight">KYC Port Protocol</h1>
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-60 tracking-tight">Aura Market Partner Compliance v6.0</p>
               </div>

               <nav className="space-y-8 mt-12">
                  {steps.map((s, i) => (
                     <div key={s.id} className={`flex items-start gap-4 transition-all ${step >= s.id ? 'opacity-100' : 'opacity-20'}`}>
                        <div className={`size-8 rounded-xl flex items-center justify-center text-[11px] font-bold border ${step === s.id ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--glass-border)]'}`}>
                           {step > s.id ? <CheckCircle2 className="size-4" /> : s.id}
                        </div>
                        <div className="space-y-1">
                           <span className="text-[11px] font-bold tracking-tight block">{s.title}</span>
                           <p className="text-[11px] font-bold text-[var(--text-secondary)] ">{s.desc}</p>
                        </div>
                     </div>
                  ))}
               </nav>

               <div className="mt-auto space-y-4 border-t border-[var(--glass-border)] pt-8">
                  <div className="flex items-center gap-3 text-[11px] font-bold tracking-tight  opacity-40">
                     <Clock className="size-4" /> ETA: 4m Total
                  </div>
               </div>
            </div>

            {/* Right Side: Execution Interface */}
            <div className="flex-1 p-12 md:p-20 flex flex-col justify-center max-w-2xl mx-auto">
               <AnimatePresence mode="wait">
                  {step === 1 && (
                     <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-10"
                     >
                        <div className="space-y-2">
                           <h2 className="text-4xl font-bold tracking-tight ">Identity Matrix</h2>
                           <p className="text-sm font-medium text-[var(--text-secondary)]">Please provide official government registration for your entity infrastructure.</p>
                        </div>

                        <div className="space-y-6">
                           <div className="space-y-3">
                              <label className="text-[11px] font-bold tracking-tight text-[var(--text-secondary)] ml-2">ID Protocol Type</label>
                              <select className="w-full h-16 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl px-6 text-sm font-bold tracking-tight outline-none focus:ring-2 focus:ring-[var(--accent)]/30">
                                 <option>National Electronic ID</option>
                                 <option>Diplomatic Passport</option>
                                 <option>Corporate Tax License</option>
                                 <option>Drivers Permit</option>
                              </select>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <UploadCard label="Front Side Hub" icon={Upload} />
                              <UploadCard label="Reverse Side Hub" icon={Upload} />
                           </div>
                        </div>

                        <button
                           onClick={() => setStep(2)}
                           className="w-full py-6 rounded-3xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-bold  tracking-[.3em] text-[10px] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                        >
                           Engage Next Mode <ArrowRight className="size-4" />
                        </button>
                     </motion.div>
                  )}

                  {step === 2 && (
                     <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-10"
                     >
                        <div className="space-y-2">
                           <h2 className="text-4xl font-bold tracking-tight ">Base Verification</h2>
                           <p className="text-sm font-medium text-[var(--text-secondary)]">Sync your physical location proof (Utility Bill/Bank Statement).</p>
                        </div>

                        <div className="p-12 rounded-[40px] border-2 border-dashed border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-inner flex flex-col items-center justify-center text-center gap-6 group hover:border-[var(--accent)]/30 transition-all cursor-pointer">
                           <div className="size-20 rounded-3xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
                              <Upload className="size-10" />
                           </div>
                           <div className="space-y-1">
                              <span className="text-[11px] font-bold tracking-tight block">Drop Proof Artifact Here</span>
                              <p className="text-[11px] font-bold text-[var(--text-secondary)]  opacity-40">PDF / JPEG / PNG MAX 10MB</p>
                           </div>
                        </div>

                        <div className="flex gap-4">
                           <button onClick={() => setStep(1)} className="flex-1 py-6 rounded-3xl border border-[var(--glass-border)] font-bold tracking-tight text-[10px] hover:bg-[var(--bg-secondary)] transition-all">Previous</button>
                           <button onClick={() => setStep(3)} className="flex-[2] py-6 rounded-3xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-bold  tracking-[.3em] text-[10px] shadow-xl hover:scale-[1.02] transition-all">Continue Sync</button>
                        </div>
                     </motion.div>
                  )}

                  {step === 3 && (
                     <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-10 text-center"
                     >
                        <div className="size-48 rounded-full border-[10px] border-[var(--accent)]/10 p-2 mx-auto relative">
                           <div className="size-full rounded-full bg-[var(--bg-primary)] flex items-center justify-center overflow-hidden">
                              <div className="size-40 rounded-full border-2 border-dashed border-[var(--accent)]/30 animate-spin-slow" />
                              <UserCheck className="size-16 text-[var(--accent)] absolute" />
                           </div>
                           <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent)]/10 to-transparent animate-pulse rounded-full" />
                        </div>

                        <div className="space-y-4">
                           <h2 className="text-4xl font-bold tracking-tight ">Biometric Initiation</h2>
                           <p className="text-sm font-medium text-[var(--text-secondary)] mx-auto max-w-sm">Look directly into your node camera for liveness verification protocol.</p>
                        </div>

                        <button
                           onClick={() => { setLoading(true); setTimeout(() => router.push('/profile'), 2000); }}
                           className="w-full py-8 rounded-[32px] bg-[var(--accent)] text-white font-bold  tracking-[.4em] text-[11px] flex items-center justify-center gap-4 hover:scale-[1.02] shadow-[0_20px_60px_rgba(242,13,242,0.3)] transition-all disabled:opacity-50"
                        >
                           {loading ? <Clock className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
                           {loading ? 'Transmitting Matrix Data...' : 'Finalize Initiation'}
                        </button>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>
         </motion.main>
      </div>
   );
}

function UploadCard({ label, icon: Icon }) {
   return (
      <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] cursor-pointer hover:border-[var(--accent)]/30 group transition-all">
         <div className="size-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--accent)] mb-4"><Icon className="size-5" /></div>
         <span className="text-[11px] font-bold tracking-tight text-center">{label}</span>
      </div>
   );
}


