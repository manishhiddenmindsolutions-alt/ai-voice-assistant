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
    <div className="min-h-screen bg-background flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,rgba(0,97,255,0.05),transparent)]">
      <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-8 duration-200">
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 rounded-none overflow-hidden mb-5 group hover:scale-[1.02] transition-all shrink-0">
            <img 
              src={hmsLogo} 
              alt="HMS Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-lg font-black text-zinc-100 uppercase tracking-widest">HMS Platform</h1>
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1.5 leading-none opacity-60">Login to manage your voice agents</p>
        </div>

        <div className="bg-zinc-950/60 border border-border rounded-2xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type="email"
                  required
                  placeholder="operator@hiddenmindsolutions.com"
                  className="w-full h-11 bg-zinc-950 border border-zinc-900 rounded-xl pl-11 pr-4 text-zinc-100 text-[11px] font-medium placeholder:text-zinc-500 focus:border-primary/40 transition-all outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  className="w-full h-11 bg-zinc-950 border border-zinc-900 rounded-xl pl-11 pr-4 text-zinc-100 text-[11px] font-medium placeholder:text-zinc-500 focus:border-primary/40 transition-all outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-on-primary font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group/btn"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-10 text-center">
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
            New Operator?{' '}
            <Link to="/register" className="text-primary hover:text-blue-400 transition-colors ml-1">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
