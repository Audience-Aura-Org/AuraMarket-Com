"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Phone, ArrowRight, UserCircle, Store, Truck } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'customer'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const result = await register(formData);
    
    if (result.success) {
      const user = useAuthStore.getState().user;
      const role = user?.role;
      
      if (role === 'vendor') {
        router.push('/vendor/dashboard');
      } else if (role === 'admin') {
        router.push('/admin/dashboard');
      } else if (role === 'logistics') {
        router.push('/logistics/dashboard');
      } else {
        router.push('/discovery');
      }
    } else {
      setError(result.message || 'Registration failed.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] font-[Poppins,sans-serif] text-[var(--text-primary)] min-h-screen relative overflow-x-hidden flex flex-col transition-colors duration-500">
      {/* Decorative background elements for Glassmorphism depth */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 blur-[120px] rounded-full -z-10"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--accent)]/10 blur-[150px] rounded-full -z-10"></div>

      {/* Navigation */}
      <header className="flex items-center justify-between px-6 lg:px-20 py-6 border-b border-[var(--nav-border)] backdrop-blur-md sticky top-0 z-50 bg-[var(--nav-bg)]">
        <Link href="/" className="flex items-center gap-3">
          <div className="text-[var(--accent)]">
            <span className="material-symbols-outlined text-4xl">polymer</span>
          </div>
          <h2 className="text-[var(--nav-text)] text-xl font-extrabold tracking-tight">Aura Market</h2>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <nav className="flex items-center gap-8">
            <Link className="text-[var(--nav-text)] opacity-70 hover:opacity-100 hover:text-[var(--accent)] transition-colors text-sm font-semibold" href="/">Home</Link>
            <a className="text-[var(--nav-text)] opacity-70 hover:opacity-100 hover:text-[var(--accent)] transition-colors text-sm font-semibold" href="#">Features</a>
            <Link className="text-[var(--nav-text)] opacity-70 hover:opacity-100 hover:text-[var(--accent)] transition-colors text-sm font-semibold" href="/shop">Marketplace</Link>
          </nav>
          <Link href="/login">
            <button className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-[var(--accent)]/20">
              Login
            </button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 lg:p-12">
        {/* Glassmorphic Form Container */}
        <div className="w-full max-w-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-xl p-8 lg:p-12 shadow-2xl relative overflow-hidden">
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight text-[var(--text-primary)]">
              Create Your Account
            </h1>
            <p className="text-[var(--text-secondary)] text-lg">Join the future of decentralized commerce.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium border border-red-500/20">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            {/* Full Name */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[var(--text-secondary)] tracking-widest ml-1 uppercase">Full Name</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]/60">person</span>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl py-4 pl-12 pr-4 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all placeholder:text-[var(--text-secondary)]/40" 
                  placeholder="John Doe" 
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[var(--text-secondary)] tracking-widest ml-1 uppercase">Email Address</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]/60">mail</span>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl py-4 pl-12 pr-4 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all placeholder:text-[var(--text-secondary)]/40" 
                    placeholder="john@example.com" 
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[var(--text-secondary)] tracking-widest ml-1 uppercase">Phone Number</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]/60">call</span>
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl py-4 pl-12 pr-4 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all placeholder:text-[var(--text-secondary)]/40" 
                    placeholder="+1 (555) 000-0000" 
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[var(--text-secondary)] tracking-widest ml-1 uppercase">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]/60">lock</span>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl py-4 pl-12 pr-12 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all placeholder:text-[var(--text-secondary)]/40" 
                  placeholder="••••••••" 
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)] transition-colors p-2"
                >
                  <span className="material-symbols-outlined text-xl pointer-events-none">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {/* Role Selection (Segmented Control Style) */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-[var(--text-secondary)] tracking-widest ml-1 uppercase">Account Type</label>
              <div className="grid grid-cols-3 gap-3 bg-[var(--bg-primary)] p-1.5 rounded-xl border border-[var(--glass-border)]">
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, role: 'customer'})}
                  className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg transition-all ${formData.role === 'customer' ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--text-secondary)]/10 text-[var(--text-secondary)]'}`}
                >
                  <span className="material-symbols-outlined text-xl">shopping_bag</span>
                  <span className="text-xs font-bold">Customer</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, role: 'vendor'})}
                  className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg transition-all ${formData.role === 'vendor' ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--text-secondary)]/10 text-[var(--text-secondary)]'}`}
                >
                  <span className="material-symbols-outlined text-xl">storefront</span>
                  <span className="text-xs font-bold">Vendor</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, role: 'logistics'})}
                  className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg transition-all ${formData.role === 'logistics' ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--text-secondary)]/10 text-[var(--text-secondary)]'}`}
                >
                  <span className="material-symbols-outlined text-xl">local_shipping</span>
                  <span className="text-xs font-bold">Logistics</span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-xl shadow-[var(--accent)]/20 mt-8 flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Account"}
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
            <p className="text-center text-[var(--text-secondary)] text-sm mt-4">
              Already have an account? <Link href="/login" className="text-[var(--accent)] font-bold hover:underline underline-offset-4">Sign In</Link>
            </p>
          </form>
        </div>
      </main>

      <footer className="p-8 text-center text-[var(--text-secondary)] text-xs border-t border-[var(--glass-border)] opacity-60">
        © 2026 Aura Market Ecosystem. All rights reserved.
      </footer>
    </div>
  );
}


