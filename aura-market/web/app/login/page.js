"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Github, Chrome, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Use try/catch for auth calls
    try {
      const result = await login(formData);
      if (result.success) {
        if (result.twoFactorRequired) {
          router.push(`/verify-2fa?userId=${result.userId}`);
          return;
        }

        const user = useAuthStore.getState().user;
        const role = user?.role;
        
        if (role === 'vendor') router.push('/vendor/dashboard');
        else if (role === 'admin') router.push('/admin/dashboard');
        else if (role === 'logistics') router.push('/logistics/dashboard');
        else router.push('/discovery');
      } else {
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] text-[var(--text-primary)] min-h-screen relative overflow-x-hidden flex flex-col transition-colors duration-500">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 -z-10 bg-[var(--bg-secondary)] opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--accent-light)]/10" />
      </div>
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[120px] -z-10 animate-pulse"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[120px] -z-10 animation-delay-2000"></div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-6">
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/logo-black.png"
            alt="Aura Market"
            className="h-7 w-auto object-contain group-hover:scale-105 transition-transform"
          />
          <h1 className="text-xl font-black tracking-tighter text-[var(--text-primary)]">
            Aura<span className="text-[var(--accent)]">Market</span>
          </h1>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/shop" className="text-[10px] uppercase tracking-widest font-black text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Shop</Link>
          <Link href="/discovery" className="text-[10px] uppercase tracking-widest font-black text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Discovery</Link>
        </nav>
        <Link href="/register">
          <button className="px-6 py-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 hover:border-[var(--accent)]/50 text-[10px] font-black uppercase tracking-widest transition-all">
            Sign Up
          </button>
        </Link>
      </header>
      
      {/* Main Login Form */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[480px]">
          <div className="glass-panel rounded-xl p-8 md:p-12 shadow-2xl relative overflow-hidden border border-[var(--glass-border)] bg-[var(--glass-bg)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent)]/50 to-transparent"></div>
            
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-extrabold mb-2 text-[var(--text-primary)]">Welcome Back</h2>
              <p className="text-[var(--text-secondary)] font-medium">Enter your credentials to access your Aura account</p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium border border-red-500/20 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-secondary)] ml-1">Email Address</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]/60 text-xl">mail</span>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="e.g. name@email.com"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl py-4 pl-12 pr-4 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/40 transition-all outline-none placeholder:text-[var(--text-secondary)]/40"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-semibold text-[var(--text-secondary)]">Password</label>
                  <Link href="/forgot-password" hidden className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]/60 text-xl">lock</span>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl py-4 pl-12 pr-12 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/40 transition-all outline-none placeholder:text-[var(--text-secondary)]/40"
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

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-[var(--accent)]/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--glass-border)]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[var(--glass-bg)] text-[var(--text-secondary)] font-medium">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/40 transition-all flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold text-[var(--text-primary)]">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"></path>
                </svg>
                Google
              </button>
              <button className="bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/40 transition-all flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold text-[var(--text-primary)]">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.96.95-2.04 1.72-3.41 1.72-1.33 0-1.74-.83-3.29-.83-1.56 0-2.01.81-3.3.81-1.28 0-2.45-.82-3.41-1.72-2.02-2.02-3.07-5.07-3.07-8.13 0-3.08 1.06-6.14 3.07-8.14 1.1-.96 2.37-1.55 3.64-1.55 1.25 0 2.05.51 3.25.51 1.17 0 1.95-.51 3.25-.51 1.28 0 2.54.6 3.64 1.55 2.02 2 3.07 5.06 3.07 8.14 0 3.06-1.05 6.11-3.07 8.13l-.15.15zM12.03 7.25c0-1.92 1.55-3.47 3.47-3.47.05 0 .1 0 .15.01-.15-2.33-2.12-4.14-4.47-4.14-2.42 0-4.38 1.96-4.38 4.38 0 2.33 1.81 4.29 4.14 4.47-.01-.05-.01-.1-.01-.15 0-.37.31-.68.68-.68.15 0 .28.05.39.12.01.09.02.18.02.26z" fill="currentColor"></path>
                </svg>
                Apple
              </button>
            </div>

            <div className="mt-10 text-center">
              <p className="text-sm text-[var(--text-secondary)]">
                New to Aura? <Link href="/register" className="text-[var(--accent)] font-bold hover:underline">Create an account</Link>
              </p>
            </div>
          </div>

          <footer className="mt-8 flex justify-center gap-6 text-xs text-[var(--text-secondary)] font-medium pb-8">
            <a className="hover:text-[var(--text-primary)] transition-colors" href="#">Privacy Policy</a>
            <a className="hover:text-[var(--text-primary)] transition-colors" href="#">Terms of Service</a>
            <a className="hover:text-[var(--text-primary)] transition-colors" href="#">Contact Us</a>
          </footer>
        </div>
      </main>
    </div>
  );
}


