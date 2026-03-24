"use client";

import { useState, useEffect } from 'react';
import { 
  MessageSquare, User, Search, 
  ChevronRight, Calendar, ArrowRight,
  ShieldCheck, LayoutGrid, Filter, Loader2,
  Trash2, Mail, ExternalLink, ArrowUpRight
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await api.get('/chat/admin/all');
      if (res.data.success) {
        setMessages(res.data.data.messages);
      }
    } catch (err) {
      toast.error("Failed to load platform communication logs.");
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter(m => 
    m.sender_id?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.receiver_id?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.text?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
       <Loader2 className="size-10 animate-spin text-[var(--accent)]" />
    </div>
  );

  return (
    <div className="space-y-12 pb-20">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-secondary)] opacity-40">Security Oversight</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
            Platform <span className="text-[var(--accent)]">Comms</span>
          </h1>
          <div className="flex items-center gap-3">
             <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-60">Global message log synchronized</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-[var(--bg-primary)]/40 backdrop-blur-xl p-3 px-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
           <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">Interactions</p>
              <p className="text-xl font-black font-mono">{messages.length}</p>
           </div>
           <MessageSquare className="size-8 text-[var(--accent)]" />
        </div>
      </div>

      {/* Control Node */}
      <div className="flex flex-col md:flex-row items-center gap-6">
         <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" />
            <input 
               placeholder="SEARCH COMMUNICATION VECTOR..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full pl-14 pr-8 py-5 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] focus:border-[var(--accent)]/40 outline-none text-[10px] font-black uppercase tracking-widest transition-all"
            />
         </div>
         <div className="flex items-center gap-3">
            <button className="h-14 px-8 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all">Export Logs</button>
            <button className="size-14 rounded-2xl bg-indigo-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-500/20"><Filter className="size-5" /></button>
         </div>
      </div>

      {/* Log Feed */}
      <div className="glass-panel rounded-[48px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
         <div className="grid grid-cols-12 gap-4 px-8 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
            <div className="col-span-3 text-[9px] font-black uppercase tracking-widest opacity-40">Sender Handle</div>
            <div className="col-span-1 flex justify-center text-[9px] font-black uppercase tracking-widest opacity-40">Direction</div>
            <div className="col-span-3 text-[9px] font-black uppercase tracking-widest opacity-40">Receiver Handle</div>
            <div className="col-span-4 text-[9px] font-black uppercase tracking-widest opacity-40">Message Payload</div>
            <div className="col-span-1 text-right text-[9px] font-black uppercase tracking-widest opacity-40">Timestamp</div>
         </div>

         <div className="divide-y divide-[var(--glass-border)]/30">
            {filteredMessages.map((msg) => (
              <div key={msg._id} className="grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-[var(--accent)]/[0.02] transition-all group">
                 {/* Sender */}
                 <div className="col-span-3 flex items-center gap-4">
                    <div className="size-10 rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex-shrink-0 group-hover:scale-110 transition-transform">
                       <img src={msg.sender_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${msg.sender_id?.name}`} className="size-full object-cover" alt="" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-tight truncate group-hover:text-[var(--accent)] transition-colors">{msg.sender_id?.name}</p>
                       <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">{msg.sender_id?.role}</p>
                    </div>
                 </div>

                 {/* Directional vector */}
                 <div className="col-span-1 flex justify-center">
                    <div className="size-8 rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] opacity-20">
                       <ArrowRight className="size-4" />
                    </div>
                 </div>

                 {/* Receiver */}
                 <div className="col-span-3 flex items-center gap-4">
                    <div className="size-10 rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex-shrink-0">
                       <img src={msg.receiver_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${msg.receiver_id?.name}`} className="size-full object-cover" alt="" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-tight truncate">{msg.receiver_id?.name}</p>
                       <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">{msg.receiver_id?.role}</p>
                    </div>
                 </div>

                 {/* Message Payload */}
                 <div className="col-span-4 relative">
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)] leading-tight line-clamp-2 italic pr-8">
                       "{msg.text}"
                    </p>
                    {msg.product_reference && (
                      <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-[var(--accent)]/5 rounded-lg border border-[var(--accent)]/10 text-[7px] font-black uppercase tracking-widest text-[var(--accent)]">
                         <LayoutGrid className="size-2.5" /> Shared Ref
                      </div>
                    )}
                 </div>

                 {/* Time signature */}
                 <div className="col-span-1 text-right">
                    <p className="text-[9px] font-black font-mono opacity-40">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40 mt-1">{new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                 </div>
              </div>
            ))}
         </div>
      </div>

      {/* Safety Notice */}
      <div className="p-8 rounded-[40px] bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-6 group">
         <div className="size-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 group-hover:scale-110 transition-transform"><ShieldCheck className="size-6" /></div>
         <div>
            <h5 className="text-[11px] font-black uppercase tracking-[0.3em]">Compliance Protocol</h5>
            <p className="text-[9px] font-semibold text-[var(--text-secondary)] opacity-60 uppercase tracking-[0.2em] mt-1 italic">Authorized admin oversight remains active. Global encryption keys are handled by the core security kernel.</p>
         </div>
      </div>
    </div>
  );
}

