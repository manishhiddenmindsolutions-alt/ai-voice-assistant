import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import hmsLogo from '../assets/HMS logo.png';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await authApi.login({ username: email, password });
      const token = res.data.access_token;
      
      // Step 1: Set token immediately so interceptors can use it
      setAuth(token, null as any);
      
      // Step 2: Fetch full profile
      const userRes = await authApi.me();
      
      // Step 3: Update store with full profile
      setAuth(token, userRes.data);
      
      toast.success('Login Successful');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 aurora-bg"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="w-full max-w-[420px] z-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
        
        {/* LOGO & HEADER */}
        <div className="flex flex-col items-center mb-6">
          <div 
            className="w-14 h-14 rounded-2xl overflow-hidden mb-4 shadow-lg p-2.5 flex items-center justify-center transition-all duration-300 hover:rotate-6 bg-white/10 backdrop-blur-md" 
            style={{ border: '1px solid var(--border)' }}
          >
            <img 
              src={hmsLogo} 
              alt="HMS Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient-brand text-center">
            HMS Voice Forge
          </h1>
          <p className="text-xs mt-1.5 font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
            High-Performance AI Voice Gateways
          </p>
        </div>

        {/* FORM CARD */}
        <div 
          className="rounded-2xl p-8 shadow-2xl glass-premium"
          style={{ 
            border: '1px solid var(--border)' 
          }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Welcome back</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Sign in to manage your voice nodes and credentials.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* EMAIL */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: 'var(--text-secondary)' }}>
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  className="input-field pl-10 focus:ring-2 focus:ring-[var(--primary)]/10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="input-field pl-10 focus:ring-2 focus:ring-[var(--primary)]/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-11 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all group/btn"
              style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #6366F1 100%)',
                boxShadow: '0 4px 20px -2px rgba(139, 92, 246, 0.25)'
              }}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Enter Voice Studio
                  <ArrowRight size={16} className="group-hover/btn:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* FOOTER */}
        <div className="mt-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            New to Voice Forge?{' '}
            <Link to="/register" className="font-extrabold transition-colors hover:underline" style={{ color: 'var(--primary)' }}>
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
