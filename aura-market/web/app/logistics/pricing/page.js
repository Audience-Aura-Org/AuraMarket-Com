"use client";

import { useState, useEffect } from 'react';
import { CheckCircle as CheckIcon, MapPin as MapPinIcon, Search as SearchIcon, Plus, Trash2, Save as SaveIcon, Loader2, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';
import Link from 'next/link';

export default function LogisticsPricingPage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState([]);
  const [profile, setProfile] = useState({
    quartier_prices: [],
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedQuartiers, setSelectedQuartiers] = useState([]);
  const [newPrice, setNewPrice] = useState('');
  const [tableSelections, setTableSelections] = useState([]);
  const [bulkUpdatePrice, setBulkUpdatePrice] = useState('');

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [zonesRes, profileRes] = await Promise.all([
        api.get('/logistics/zones'),
        api.get('/logistics/profile')
      ]);

      if (zonesRes.data.success) setZones(zonesRes.data.data.zones);
      if (profileRes.data.success) {
         setProfile({
            quartier_prices: profileRes.data.data.firm.quartier_prices || [],
         });
      }
    } catch (err) {
      toast.error("Failed to sync pricing matrix.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuartier = () => {
    if (selectedQuartiers.length === 0 || !newPrice) return toast.error("Select at least one zone and set a price.");
    const newEntries = selectedQuartiers
      .filter(q => !profile.quartier_prices.some(existing => existing.quartier === q))
      .map(q => ({ quartier: q, price: Number(newPrice) }));
    if (newEntries.length === 0) return toast.error("All selected zones already have a rate.");
    setProfile({ ...profile, quartier_prices: [...profile.quartier_prices, ...newEntries] });
    setSelectedQuartiers([]);
    setNewPrice('');
  };

  const handleRemoveQuartier = (index) => {
    const updated = [...profile.quartier_prices];
    updated.splice(index, 1);
    setProfile({ ...profile, quartier_prices: updated });
    setTableSelections([]);
  };

  const handleUpdateInlinePrice = (name, price) => {
    setProfile({
      ...profile,
      quartier_prices: profile.quartier_prices.map(q => q.quartier === name ? { ...q, price: Number(price) } : q)
    });
  };

  const handleBulkDelete = () => {
    setProfile({ ...profile, quartier_prices: profile.quartier_prices.filter(q => !tableSelections.includes(q.quartier)) });
    setTableSelections([]);
    toast.success("Batch removal complete.");
  };

  const handleBulkUpdatePrice = () => {
    if (!bulkUpdatePrice) return toast.error("Set a target fee.");
    setProfile({
      ...profile,
      quartier_prices: profile.quartier_prices.map(q => tableSelections.includes(q.quartier) ? { ...q, price: Number(bulkUpdatePrice) } : q)
    });
    setTableSelections([]);
    setBulkUpdatePrice('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/logistics/pricing', { quartier_prices: profile.quartier_prices });
      toast.success("Pricing matrix synchronized.");
    } catch (err) {
      toast.error("Protocol failure.");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur-3xl shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0 text-[var(--nav-text)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <Link href="/logistics/dashboard" className="size-10 lg:size-12 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all group">
             <ArrowLeft className="size-4 lg:size-5 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div>
             <h2 className="text-lg lg:text-2xl font-black tracking-tighter uppercase leading-none">Route <span className="text-[var(--accent)]">Pricing</span></h2>
             <p className="text-[7px] lg:text-[8px] font-black tracking-[0.3em] uppercase opacity-40 mt-1">Matrix Protocol</p>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-8 lg:space-y-12 pb-32">
          <section className="space-y-4 lg:space-y-6">
             <div className="flex items-center gap-3 lg:gap-4">
                <div className="size-10 lg:size-12 rounded-xl lg:rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center border border-purple-500/20 shadow-sm"><MapPinIcon className="size-5 lg:size-6" /></div>
                <h3 className="text-lg lg:text-2xl font-black tracking-tighter uppercase leading-none">Last-Mile Rates</h3>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
                <div className="lg:col-span-4 space-y-6">
                   <div className="glass-panel p-6 lg:p-8 rounded-[32px] lg:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Operation Region</label>
                        <select value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedQuartiers([]); }} className="w-full px-4 py-3.5 lg:px-6 lg:py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] outline-none text-[10px] lg:text-xs font-black transition-all">
                           <option value="">Select District...</option>
                           {zones.filter(z => z.type === 'region').map(z => <option key={z._id} value={z._id}>{z.name}</option>)}
                        </select>
                      </div>

                      {selectedDistrict && (
                         <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between items-center px-1">
                               <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">Target Zones</label>
                               <div className="flex gap-3">
                                  <button onClick={() => setSelectedQuartiers(zones.filter(z => z.type === 'quartier' && z.parent_id?._id === selectedDistrict).map(z => z.name))} className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--accent)] hover:opacity-100 transition-opacity">Select All</button>
                                  <button onClick={() => setSelectedQuartiers([])} className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-rose-500 hover:opacity-100 transition-opacity">Clear</button>
                               </div>
                            </div>
                            <div className="max-h-[160px] lg:max-h-[200px] overflow-y-auto pr-2 space-y-2 no-scrollbar border-t border-b border-[var(--glass-border)] py-2">
                               {zones.filter(z => z.type === 'quartier' && z.parent_id?._id === selectedDistrict).map(z => (
                                 <div key={z._id} onClick={() => setSelectedQuartiers(prev => prev.includes(z.name) ? prev.filter(n => n !== z.name) : [...prev, z.name])} className={`p-3 lg:p-4 rounded-xl lg:rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${selectedQuartiers.includes(z.name) ? 'bg-[var(--accent)]/10 border-[var(--accent)]/40' : 'bg-transparent border-transparent hover:bg-[var(--bg-primary)]/40'}`}>
                                    <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-tight">{z.name}</span>
                                    {selectedQuartiers.includes(z.name) && <CheckIcon className="size-3 text-[var(--accent)]" />}
                                 </div>
                               ))}
                            </div>
                         </div>
                      )}
                      <div className="space-y-2">
                         <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Base Fee</label>
                         <div className="relative">
                            <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full pl-6 pr-16 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] outline-none text-[10px] lg:text-xs font-black transition-all" />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[8px] lg:text-[10px] opacity-30 font-black tracking-widest">XAF</span>
                         </div>
                      </div>
                      <button onClick={handleAddQuartier} className="w-full py-4 lg:py-5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] tracking-[0.3em] uppercase shadow-2xl hover:bg-[var(--accent)] hover:text-white hover:-translate-y-1 transition-all">Add Routes <Plus className="size-4 ml-2 inline" /></button>
                   </div>
                </div>

                <div className="lg:col-span-8 flex flex-col gap-4 lg:gap-6">
                   <div className="glass-panel rounded-[28px] lg:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl relative">
                      <div className="p-5 lg:p-8 border-b border-[var(--glass-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                         <div className="flex items-center gap-4 flex-1">
                            <SearchIcon className="size-4 opacity-20" />
                            <input placeholder="Search zone network..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-[10px] lg:text-xs font-black uppercase tracking-widest w-full" />
                         </div>
                         <p className="text-[8px] lg:text-[10px] font-black uppercase opacity-40 tracking-[0.2em]">{profile.quartier_prices.length} Active Nodes</p>
                      </div>
                      {tableSelections.length > 0 && (
                         <div className="p-3 lg:p-5 bg-[var(--accent)]/10 border-b border-[var(--glass-border)] flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-4 flex-1">
                               <label className="text-[8px] lg:text-[9px] font-black uppercase opacity-40 tracking-widest whitespace-nowrap">Bulk Rate:</label>
                               <input type="number" placeholder="Enter fee..." value={bulkUpdatePrice} onChange={e => setBulkUpdatePrice(e.target.value)} className="w-full md:w-32 px-4 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] lg:text-xs font-black outline-none shadow-inner" />
                            </div>
                            <div className="flex gap-3">
                               <button onClick={handleBulkUpdatePrice} className="flex-1 md:flex-none px-6 py-2.5 bg-[var(--accent)] text-white text-[9px] lg:text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:scale-[1.02] transition-all">Apply</button>
                               <button onClick={handleBulkDelete} className="flex-1 md:flex-none px-6 py-2.5 bg-rose-500/10 text-rose-600 text-[9px] lg:text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all">Remove</button>
                            </div>
                         </div>
                      )}
                      <div className="max-h-[300px] lg:max-h-[500px] overflow-x-auto no-scrollbar">
                         <table className="w-full text-left border-collapse">
                               <thead className="sticky top-0 bg-[var(--bg-secondary)]/95 backdrop-blur-xl z-10">
                               <tr>
                                  <th className="px-6 lg:px-8 py-3 lg:py-4 w-10">
                                     <div 
                                        onClick={() => setTableSelections(tableSelections.length === profile.quartier_prices.length ? [] : profile.quartier_prices.map(q => q.quartier))} 
                                        className={`size-4 lg:size-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                                           tableSelections.length === profile.quartier_prices.length && profile.quartier_prices.length > 0 
                                           ? 'bg-[var(--accent)] border-[var(--accent)] text-white' 
                                           : 'border-slate-300/80 dark:border-white/20 hover:border-[var(--accent)]/50'
                                        }`}
                                     >
                                        {tableSelections.length === profile.quartier_prices.length && profile.quartier_prices.length > 0 && <CheckIcon className="size-2.5 lg:size-3" />}
                                     </div>
                                  </th>
                                  <th className="px-6 lg:px-8 py-3 lg:py-4 text-[7px] lg:text-[9px] font-black opacity-30 uppercase tracking-[0.2em]">Transit Zone</th>
                                  <th className="px-6 lg:px-8 py-3 lg:py-4 text-[7px] lg:text-[9px] font-black opacity-30 uppercase tracking-[0.2em]">Operational Fee</th>
                                  <th className="px-6 lg:px-8 py-3 lg:py-4 text-right"></th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-[var(--glass-border)]/10">
                                {profile.quartier_prices.filter(q => q.quartier.toLowerCase().includes(searchTerm.toLowerCase())).map((q, idx) => (
                                  <tr key={idx} className={`hover:bg-[var(--accent)]/5 transition-all group ${tableSelections.includes(q.quartier) ? 'bg-[var(--accent)]/5' : ''}`}>
                                     <td className="px-6 lg:px-8 py-4 lg:py-5 border-none">
                                        <div 
                                           onClick={() => setTableSelections(prev => prev.includes(q.quartier) ? prev.filter(n => n !== q.quartier) : [...prev, q.quartier])} 
                                           className={`size-4 lg:size-5 rounded-full border-2 flex justify-center items-center cursor-pointer transition-all ${
                                              tableSelections.includes(q.quartier) 
                                              ? 'bg-[var(--accent)] border-[var(--accent)] text-white' 
                                              : 'border-slate-300/80 dark:border-white/20 group-hover:border-[var(--accent)]/50'
                                           }`}
                                        >
                                           {tableSelections.includes(q.quartier) && <CheckIcon className="size-2.5 lg:size-3" />}
                                        </div>
                                     </td>
                                     <td className="px-6 lg:px-8 py-4 lg:py-5 border-none"><p className="text-[10px] lg:text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{q.quartier}</p></td>
                                     <td className="px-6 lg:px-8 py-4 lg:py-5 border-none">
                                        <div className="flex items-center gap-2 group/input">
                                           <input 
                                              type="number" 
                                              value={q.price} 
                                              onChange={e => handleUpdateInlinePrice(q.quartier, e.target.value)} 
                                              className="w-20 lg:w-28 px-3 py-2 bg-[var(--bg-secondary)]/30 border border-transparent hover:border-[var(--glass-border)] focus:border-[var(--accent)] rounded-lg text-xs lg:text-sm font-mono font-black text-indigo-600 outline-none transition-all shadow-inner" 
                                           />
                                           <span className="text-[8px] lg:text-[9px] opacity-20 font-black">XAF</span>
                                        </div>
                                     </td>
                                     <td className="px-6 lg:px-8 py-4 lg:py-5 text-right border-none">
                                        <button onClick={() => handleRemoveQuartier(idx)} className="opacity-0 group-hover:opacity-100 size-8 lg:size-10 flex items-center justify-center hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm">
                                           <Trash2 className="size-3.5 lg:size-4" />
                                        </button>
                                     </td>
                                  </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>
                    <div className="flex justify-center pt-2 lg:pt-4">
                       <button 
                         onClick={handleSave} 
                         disabled={saving} 
                         className="w-full md:w-auto px-8 lg:px-12 py-4 lg:py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl lg:rounded-[24px] font-black text-[9px] lg:text-[10px] tracking-[0.3em] uppercase shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-40"
                       >
                          {saving ? <Loader2 className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                          Sync Matrix with AURA Network
                       </button>
                    </div>
                 </div>
              </div>
           </section>
        </div>
    </>
  );
}

