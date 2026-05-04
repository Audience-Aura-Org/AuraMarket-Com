'use client';

import { useState } from 'react';
import { Mail, ArrowLeft, Gem, Sparkles, Send, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SubscribePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    // Mock subscription
    setIsSubscribed(true);
    setTimeout(() => setIsSubscribed(false), 5000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center py-24 px-8 md:px-20 transition-colors duration-500 overflow-hidden relative">
      
      {/* Background Blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[var(--accent)]/10 rounded-full blur-[120px] -translate-y-1/2 -translate-x-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] translate-y-1/2 translate-x-1/2" />

      <div className="max-w-xl w-full relative z-10">
        
        {/* Nav */}
        <button 
          onClick={() => router.back()}
          className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-all group mb-12 shadow-sm"
        >
          <ArrowLeft className="size-5 group-hover:-translate-x-1 transition-transform" />
        </button>

        {/* Content Node */}
        <div className="glass-panel rounded-[3rem] p-12 border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 backdrop-blur-3xl text-center relative overflow-hidden">
           
           <div className="size-20 rounded-[2rem] bg-gradient-to-br from-[var(--accent)] to-indigo-600 flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-[var(--accent)]/30 animate-pulse">
              <Gem className="size-8" />
           </div>

           <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter  mb-4 leading-tight">
              Aura <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-indigo-600">Exclusive</span>
           </h1>
           <p className="text-[var(--text-secondary)] mb-12 opacity-80 font-medium">
              Join our elite inner-circle. Receive signature drop notifications, platform updates, and exclusive vendor previews directly to your secured inbox.
           </p>

           <form onSubmit={handleSubscribe} className="flex flex-col gap-4">
              <div className="relative group">
                 <Mail className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" />
                 <input 
                   type="email"
                   required
                   placeholder="secured-inbox-address@aura.io"
                   className="w-full h-16 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] pl-14 pr-6 text-sm font-bold text-white focus:border-[var(--accent)] transition-all outline-none"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                 />
              </div>
              <button 
                type="submit"
                disabled={isSubscribed}
                className={`w-full h-16 rounded-2xl ${isSubscribed ? 'bg-emerald-500' : 'bg-[var(--accent)]'} text-white font-black text-xs  tracking-[0.3em] shadow-2xl shadow-[var(--accent)]/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3`}
              >
                {isSubscribed ? (
                  <> <Check className="size-4" /> Locked In! </>
                ) : (
                  <> <Send className="size-4" /> Subscribe Now <Sparkles className="size-3" /> </>
                )}
              </button>
           </form>

           <p className="mt-8 text-[10px] font-black tracking-wide text-[var(--text-secondary)] opacity-40">
              Zero Spam Policy. Definitive Signal Only.
           </p>

        </div>

      </div>
    </div>
  );
}
