"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, User, Search, 
  ChevronRight, Calendar, ArrowRight,
  ShieldCheck, LayoutGrid, Filter, Loader2,
  Trash2, Mail, ExternalLink, ArrowUpRight,
  X, Send, Phone, UserCircle2, Clock
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export const dynamic = 'force-dynamic';

import Pagination from '@/components/common/Pagination';

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedThread, setSelectedThread] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  
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

  const threads = useMemo(() => {
    const threadMap = new Map();

    messages.forEach(msg => {
      const ids = [msg.sender_id?._id, msg.receiver_id?._id].sort().join('--');
      if (!threadMap.has(ids)) {
        threadMap.set(ids, {
          id: ids,
          p1: msg.sender_id,
          p2: msg.receiver_id,
          messages: [],
          latestDate: msg.createdAt,
          lastText: msg.text
        });
      }
      threadMap.get(ids).messages.push(msg);
    });

    return Array.from(threadMap.values()).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
  }, [messages]);

  const filteredThreads = threads.filter(t => 
    t.p1?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.p2?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.p1?.store_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.p2?.store_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredThreads.length / itemsPerPage);
  const currentThreads = filteredThreads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
       <Loader2 className="size-10 animate-spin text-[var(--accent)]" />
    </div>
  );

  const getAvatar = (user) => {
    if (user?.branding?.logo || user?.avatar) {
      return <img src={user.branding?.logo || user.avatar} className="size-full object-cover" alt="" />;
    }
    return <span className="text-current font-black text-[10px]">{user?.name?.[0]?.toUpperCase()}</span>;
  };

  return (
    <div className="space-y-12 pb-20 relative min-h-screen">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-secondary)] opacity-40">Security Oversight</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
            COMM <span className="text-[var(--accent)]">MONITOR</span>
          </h1>
          <div className="flex items-center gap-3">
             <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-60">Global message log synchronized</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-[var(--bg-primary)]/40 backdrop-blur-xl p-3 px-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
           <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">Active Threads</p>
              <p className="text-xl font-black font-mono">{threads.length}</p>
           </div>
           <MessageSquare className="size-8 text-[var(--accent)]" />
        </div>
      </div>

      {/* Control Node */}
      <div className="flex flex-col md:flex-row items-center gap-6">
         <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" />
            <input 
               placeholder="SCAN BY NAME, STORE, OR ROLE..."
               value={searchTerm}
               onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
               className="w-full pl-14 pr-8 py-5 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] focus:border-[var(--accent)]/40 outline-none text-[10px] font-black uppercase tracking-widest transition-all"
            />
         </div>
      </div>

      {/* Thread Grid */}
      <div className="space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentThreads.map((thread) => (
            <div 
                key={thread.id} 
                onClick={() => setSelectedThread(thread)}
                className="group cursor-pointer bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 border border-[var(--glass-border)] hover:border-[var(--accent)]/40 rounded-[32px] p-6 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-1 backdrop-blur-xl"
            >
                <div className="flex items-start justify-between mb-6">
                <div className="flex -space-x-3">
                    <div className="size-12 rounded-2xl overflow-hidden border-2 border-[var(--bg-primary)] bg-[var(--bg-secondary)] flex items-center justify-center relative z-10 shadow-lg">
                        {getAvatar(thread.p1)}
                    </div>
                    <div className="size-12 rounded-2xl overflow-hidden border-2 border-[var(--bg-primary)] bg-[var(--bg-secondary)] flex items-center justify-center relative z-0 shadow-lg opacity-80">
                        {getAvatar(thread.p2)}
                    </div>
                </div>
                <div className="px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-[8px] font-black uppercase tracking-widest rounded-lg border border-[var(--accent)]/20">
                    {thread.messages.length} SMS
                </div>
                </div>

                <div className="space-y-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black uppercase tracking-tight text-[var(--text-primary)] truncate max-w-[120px]">{thread.p1?.name}</p>
                        <ArrowRight className="size-3 text-[var(--text-secondary)] opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-tight text-[var(--text-primary)] truncate max-w-[120px]">{thread.p2?.name}</p>
                    </div>
                    <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.2em]">
                        {thread.p1?.role} <span className="mx-1">•</span> {thread.p2?.role}
                    </p>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)]/20">
                    <p className="text-[11px] font-medium text-[var(--text-secondary)] leading-tight italic line-clamp-2">
                        "{thread.lastText}"
                    </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                        <Clock className="size-3 text-[var(--text-secondary)] opacity-40" />
                        <p className="text-[9px] font-black text-[var(--text-secondary)] opacity-60 uppercase">
                            {new Date(thread.latestDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <ChevronRight className="size-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
                </div>
                </div>
            </div>
            ))}
        </div>

        <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
        />
      </div>

      {/* Conversation Inspector (Drawer/Modal) */}
      <AnimatePresence>
        {selectedThread && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedThread(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl h-full bg-[var(--bg-primary)] border-l border-[var(--glass-border)] shadow-2xl flex flex-col"
            >
               {/* Inspector Header */}
               <div className="p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 z-20">
                  <div className="flex items-center gap-6">
                     <button onClick={() => setSelectedThread(null)} className="size-10 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--glass-border)] transition-all">
                        <X className="size-5" />
                     </button>
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <h3 className="text-sm font-black uppercase tracking-tight">{selectedThread.p1?.name}</h3>
                           <ArrowRight className="size-4 text-[var(--accent)]" />
                           <h3 className="text-sm font-black uppercase tracking-tight">{selectedThread.p2?.name}</h3>
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Handshake Monitor Active</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <button className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"><Trash2 className="size-4" /></button>
                     <button className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"><Mail className="size-4" /></button>
                  </div>
               </div>

               {/* Inspector Messages */}
               <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                  {[...selectedThread.messages].reverse().map((m, idx) => {
                     const isP1 = m.sender_id?._id === selectedThread.p1?._id;
                     return (
                        <div key={idx} className={`flex flex-col ${isP1 ? 'items-start' : 'items-end'}`}>
                           <div className="flex items-center gap-3 mb-2">
                              {isP1 && (
                                <div className="size-6 rounded-lg overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] flex items-center justify-center">
                                  {getAvatar(selectedThread.p1)}
                                </div>
                              )}
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                                {isP1 ? selectedThread.p1?.name : selectedThread.p2?.name}
                              </p>
                              {!isP1 && (
                                <div className="size-6 rounded-lg overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] flex items-center justify-center">
                                  {getAvatar(selectedThread.p2)}
                                </div>
                              )}
                           </div>
                           <div className={`max-w-[85%] p-5 rounded-[24px] shadow-sm border ${
                              isP1 
                                ? 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-primary)]' 
                                : 'bg-[var(--accent)] border-[var(--accent)]/20 text-white'
                           }`}
                           style={isP1 ? { borderTopLeftRadius: '4px' } : { borderTopRightRadius: '4px' }}>
                              <p className="text-sm font-medium leading-relaxed mb-2">{m.text}</p>
                              <div className={`flex items-center gap-2 opacity-40 text-[9px] font-bold uppercase tracking-widest ${isP1 ? 'justify-start' : 'justify-end'}`}>
                                 <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                 <span>•</span>
                                 <span>{new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                              </div>
                           </div>
                        </div>
                     );
                  })}
               </div>

               {/* Inspector Status */}
               <div className="p-8 bg-[var(--bg-secondary)]/30 border-t border-[var(--glass-border)]">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                     <div className="flex items-center gap-4">
                        <ShieldCheck className="size-5 text-emerald-500" />
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-widest">Logged Communication</p>
                           <p className="text-[9px] font-medium text-[var(--text-secondary)] opacity-60">ID: {selectedThread.id}</p>
                        </div>
                     </div>
                     <button className="h-10 px-6 rounded-xl bg-[var(--accent)] text-white text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2">
                        <ArrowUpRight className="size-3" /> Details
                     </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Compliance Protocol */}
      <div className="p-8 rounded-[40px] bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-6 group relative z-10 transition-all hover:bg-indigo-500/[0.08]">
         <div className="size-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 group-hover:scale-110 transition-transform"><ShieldCheck className="size-6" /></div>
         <div>
            <h5 className="text-[11px] font-black uppercase tracking-[0.3em]">Authorized oversight</h5>
            <p className="text-[9px] font-semibold text-[var(--text-secondary)] opacity-60 uppercase tracking-[0.2em] mt-1 italic">This monitor represents the real-time interaction kernel of Aura Market. All signals are end-to-end synchronized.</p>
         </div>
      </div>
    </div>
  );
}
