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
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-8 duration-300">
        
        {/* LOGO & HEADER */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl overflow-hidden mb-4 shadow-sm" style={{ border: '1px solid var(--border)' }}>
            <img 
              src={hmsLogo} 
              alt="HMS Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Welcome back
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Sign in to manage your voice agents
          </p>
        </div>

        {/* FORM CARD */}
        <div 
          className="rounded-xl p-8 shadow-lg"
          style={{ 
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)' 
          }}
        >
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* EMAIL */}
            <div className="space-y-2">
              <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-secondary)' }}>
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  className="input-field pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="space-y-2">
              <label className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="input-field pl-10"
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
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} className="group-hover/btn:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* FOOTER */}
        <div className="mt-6 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/register" className="font-medium transition-colors" style={{ color: 'var(--primary)' }}>
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
