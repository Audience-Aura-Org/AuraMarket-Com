"use client";

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Image from 'next/image';
import { Camera, Palette, CloudUpload, Sparkles, CheckCircle2, LayoutGrid, Layers, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/services/api';
import { uploadService } from '@/services/upload';

export default function BrandingSuitePage() {
    const [logoPreview, setLogoPreview] = useState(null);
    const [bannerPreview, setBannerPreview] = useState(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e, type) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (type === 'logo') setLogoPreview(file);
        else setBannerPreview(file);
    };

    const handleSave = async () => {
        if (!logoPreview && !bannerPreview) {
            toast.error('No changes to synchronize.');
            return;
        }

        setUploading(true);
        const loadingToast = toast.loading('Synchronizing branding nodes...');
        try {
            const updates = { branding: {} };
            
            // 1. Upload files if they are File objects (previews)
            if (logoPreview instanceof File) {
                const res = await uploadService.uploadSingle(logoPreview, 'avatars');
                if (res.success) updates.branding.logo = res.data.url;
            }
            if (bannerPreview instanceof File) {
                const res = await uploadService.uploadSingle(bannerPreview, 'banners');
                if (res.success) updates.branding.banner = res.data.url;
            }

            // 2. Save to backend
            const res = await api.patch('/users/me', updates);
            
            if (res.data.success) {
                toast.dismiss(loadingToast);
                toast.success('Visual identity synchronized.');
                // Update local storage if needed or refresh
                if (typeof window !== 'undefined') {
                    const user = JSON.parse(localStorage.getItem('aura_market_user') || '{}');
                    localStorage.setItem('aura_market_user', JSON.stringify({ ...user, ...res.data.data.user }));
                }
            } else {
                throw new Error(res.data.message || 'Sync failed');
            }
        } catch (err) {
            console.error('Branding sync error:', err);
            toast.dismiss(loadingToast);
            toast.error(err.response?.data?.message || 'Identity sync failed.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] relative selection:bg-[var(--accent)]/30">
            {/* Background Decor */}
            <div className="absolute top-[-5%] right-[-5%] size-[600px] bg-[var(--accent)]/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-5%] left-[-5%] size-[500px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

            <main className="max-w-6xl mx-auto px-6 py-20 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-4 py-1.5 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-full w-fit shadow-sm">
                            <Palette className="size-3.5 text-[var(--accent)]" />
                            <span className="text-[10px] font-bold tracking-tight text-[var(--text-secondary)]">Creative Ops</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter  leading-none">
                            Branding <span className="text-[var(--accent)]">Suite</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] font-bold text-sm max-w-lg opacity-60">Manage your store's visual identity across the Aura network. High-fidelity assets set the tone for your premium storefront nodes.</p>
                    </div>

                    <div className="hidden lg:flex items-center gap-4 px-6 py-3 glass-panel rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shadow-sm">
                         <div className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                         <span className="text-[10px] font-bold tracking-tight">Network Node Sync: Active</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                    {/* Left: Component Control Panels */}
                    <div className="space-y-8">
                        {/* Logo Control Panel */}
                        <section className="p-10 glass-panel rounded-[48px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-3xl shadow-3xl group">
                            <div className="flex items-center gap-4 mb-10">
                                <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner">
                                    <LayoutGrid className="size-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight">Identity Node</h3>
                                    <p className="text-[9px] font-bold tracking-tight text-[var(--text-secondary)] opacity-40">Primary Brand Icon</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-10">
                                <div className="size-40 rounded-[48px] border-4 border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden shrink-0 relative shadow-inner group-hover:border-[var(--accent)]/40 transition-all duration-500">
                                    {logoPreview ? (
                                        <img 
                                            src={logoPreview instanceof File ? URL.createObjectURL(logoPreview) : logoPreview} 
                                            className="size-full object-cover p-2 rounded-[48px]" 
                                            alt="Logo Preview" 
                                        />
                                    ) : (
                                        <div className="text-center space-y-2 opacity-20 group-hover:opacity-40 transition-opacity">
                                            <CloudUpload className="size-10 mx-auto" />
                                            <span className="text-[8px] font-bold tracking-tight block">Upload Preview</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-4">
                                    <p className="text-xs font-medium text-[var(--text-secondary)] leading-relaxed opacity-70">
                                        This logo represents your brand in search results, vendor lists, and secure chat threads. 
                                        <br/><br/>
                                        <span className="font-bold text-[var(--text-primary)]  text-[9px] tracking-tight">Optimal: 500x500 PNG</span>
                                    </p>
                                    <label className="block w-full">
                                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'logo')} className="hidden" />
                                        <div className="w-full h-14 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] flex items-center justify-center gap-3 cursor-pointer hover:bg-[var(--accent)] hover:text-white transition-all group/btn shadow-sm">
                                            <Camera className="size-4 group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-[10px] font-bold tracking-tight">Deploy Icon</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </section>

                        {/* Summary / Tip Panel */}
                        <div className="p-8 rounded-[40px] bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-6 shadow-inner">
                            <div className="size-14 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)] shrink-0">
                                <Info className="size-7" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold tracking-tight">Design Intelligence</h4>
                                <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-1.5 opacity-70">Consistent visual branding across your Aura node increases customer trust by up to 240% during checkout protocols.</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Environment Map (Banner) */}
                    <div className="space-y-8 h-full">
                        <section className="p-10 glass-panel rounded-[48px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-3xl shadow-3xl h-full flex flex-col group relative overflow-hidden">
                            <div className="absolute top-0 right-0 size-64 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />
                            
                            <div className="flex items-center gap-4 mb-10 relative z-10">
                                <div className="size-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner">
                                    <Layers className="size-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight">Environmental Node</h3>
                                    <p className="text-[9px] font-bold tracking-tight text-[var(--text-secondary)] opacity-40">Primary Presence Banner</p>
                                </div>
                            </div>

                            <div className="relative z-10 flex flex-col h-full">
                                <div className="aspect-[2/1] w-full rounded-[32px] border-4 border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)] mb-8 overflow-hidden group-hover:border-indigo-500/40 transition-all duration-500 shadow-inner">
                                    {bannerPreview ? (
                                        <img 
                                            src={bannerPreview instanceof File ? URL.createObjectURL(bannerPreview) : bannerPreview} 
                                            className="size-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                                            alt="Banner Preview" 
                                        />
                                    ) : (
                                        <div className="size-full flex flex-col items-center justify-center gap-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                            <Sparkles className="size-10 text-indigo-400" />
                                            <span className="text-[9px] font-bold tracking-tight">Matrix Preview</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6 mt-auto">
                                    <div className="p-6 rounded-3xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-center">
                                         <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 italic leading-relaxed">"The environment node sets the emotional frequency of your storefront. We recommend rich textures or clean product photography."</p>
                                    </div>
                                    
                                    <label className="block w-full">
                                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'banner')} className="hidden" />
                                        <div className="w-full h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center gap-3 cursor-pointer hover:bg-indigo-600 hover:text-white transition-all group/env shadow-sm">
                                            <CloudUpload className="size-5 group-hover/env:-translate-y-1 transition-transform" />
                                            <span className="text-[10px] font-bold  tracking-[0.2em]">Map Environment</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                {/* Fixed Action Footer */}
                <div className="mt-20 flex flex-col sm:flex-row items-center justify-end gap-6 pt-10 border-t border-[var(--glass-border)]/50">
                    <div className="flex items-center gap-3 opacity-40">
                         <span className="text-[8px] font-bold tracking-tight">Ready for Deployment</span>
                         <div className="size-1 rounded-full bg-[var(--text-secondary)]" />
                         <span className="text-[8px] font-bold tracking-tight">Encryption Level 4</span>
                    </div>
                    <button 
                        onClick={handleSave}
                        disabled={uploading}
                        className="px-14 h-16 rounded-2xl bg-[var(--accent)] text-white font-bold text-[10px] tracking-[0.4em]  shadow-2xl shadow-[var(--accent)]/30 hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {uploading ? (
                            <span className="size-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <CheckCircle2 className="size-5" />
                        )}
                        Synchronize Matrix
                    </button>
                </div>
            </main>
        </div>
    );
}

