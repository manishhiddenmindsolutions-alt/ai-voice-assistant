import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import hmsLogo from '../assets/HMS logo.png';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.register({ email, password, full_name: fullName });
      toast.success('Identity Registered in HMS Console');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,rgba(0,97,255,0.05),transparent)]">
      <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-8 duration-200">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-12 h-12 rounded-none overflow-hidden mb-5 group hover:scale-[1.02] transition-all shrink-0">
            <img 
              src={hmsLogo} 
              alt="HMS Logo" 
              className="w-full h-full object-cover"
            />
          </div>
            <h1 className="text-lg font-black text-white uppercase tracking-widest leading-none">New HMS Identity</h1>
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-2 italic px-8 opacity-60">Initialize Unified Access protocol</p>
        </div>

        <div className="bg-zinc-900/40 border border-border rounded-2xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <form onSubmit={handleRegister} className="space-y-5 relative z-10">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Full Name (Human Tag)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={16} />
                <input
                  type="text"
                  required
                  placeholder="Manish Sen"
                  className="w-full h-11 bg-zinc-950 border border-zinc-900 rounded-xl pl-11 pr-4 text-white text-[11px] font-medium placeholder:text-zinc-800 focus:border-primary/40 transition-all outline-none"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">HMS Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={16} />
                <input
                  type="email"
                  required
                  placeholder="operator@hiddenmindsolutions.com"
                  className="w-full h-11 bg-zinc-950 border border-zinc-900 rounded-xl pl-11 pr-4 text-white text-[11px] font-medium placeholder:text-zinc-800 focus:border-primary/40 transition-all outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Secure Protocol (Password)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={16} />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  className="w-full h-11 bg-zinc-950 border border-zinc-900 rounded-xl pl-11 pr-4 text-white text-[11px] font-medium placeholder:text-zinc-800 focus:border-primary/40 transition-all outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group/btn pt-0.5"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>
                  Register Forge Link
                  <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-10 text-center">
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
            Already Linked?{' '}
            <Link to="/login" className="text-primary hover:text-blue-400 transition-colors ml-1">
              Synchronize Node Access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
