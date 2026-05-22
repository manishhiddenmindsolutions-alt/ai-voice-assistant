import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { authApi, agentApi, toolApi, numbersApi } from '../services/api';
import { 
  User as UserIcon, 
  Shield, 
  Cpu, 
  Package, 
  Phone, 
  Key, 
  LogOut, 
  ArrowLeft, 
  Check, 
  Loader2,
  Copy,
  UserCheck,
  Zap,
  Globe,
  Radio
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const PRESETS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=150&auto=format&fit=crop&q=80'
];

const PERMISSIONS = [
  { name: 'Neural Call Handshake', desc: 'Allow real-time speech signaling over WebRTC gateways.', status: 'Authorized', color: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/10' },
  { name: 'Model Inference Bypass', desc: 'Allows direct execution of BYOK models per custom router rules.', status: 'Authorized', color: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/10' },
  { name: 'Tools Execution & Dispatch', desc: 'Read/write permissions for sheets sync, webhooks, and calendar.', status: 'Authorized', color: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/10' },
  { name: 'Platform Admin Key Rotation', desc: 'Full permissions to encrypt and replace AES keys.', status: 'System Default', color: 'text-purple-400 bg-purple-500/5 border-purple-500/10' }
];

export const ProfilePage = () => {
  const { user, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  
  // Asset Metrics
  const [metrics, setMetrics] = useState({
    agents: 0,
    tools: 0,
    numbers: 0
  });

  useEffect(() => {
    // Load asset counts to showcase on profile
    const loadMetrics = async () => {
      try {
        const [agentsRes, toolsRes, numbersRes] = await Promise.all([
          agentApi.list(),
          toolApi.list(),
          numbersApi.list()
        ]);
        setMetrics({
          agents: agentsRes.data.length,
          tools: toolsRes.data.length,
          numbers: numbersRes.data.length
        });
      } catch (err) {
        console.error('Failed to load assets metrics:', err);
      }
    };
    loadMetrics();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await authApi.updateProfile({
        full_name: fullName,
        avatar_url: avatarUrl
      });
      // Update local storage via auth store
      const token = useAuthStore.getState().token;
      if (token) {
        setAuth(token, res.data);
      }
      toast.success('Neural registry updated successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to update registry details.');
    } finally {
      setIsUpdating(false);
    }
  };

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      toast.success('System ID copied to clipboard!');
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Registry session terminated.');
    navigate('/login');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Active Operator';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user?.email.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-10 pb-16 relative">
      {/* BACKGROUND DECORATIVE GLOW */}
      <div className="absolute top-10 left-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div>
          <button 
            onClick={() => navigate('/')} 
            className="btn-back-premium mb-3"
          >
            <ArrowLeft size={12} />
            <span>Overview</span>
          </button>
          <h1 className="text-xl md:text-3xl font-heading font-black text-white uppercase tracking-wider leading-tight">
            Neural Operator Registry
          </h1>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mt-1">
            System Authorization Configurator • Access Node Identity
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2.5 px-6 h-11 bg-red-950/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.05)] group"
        >
          <LogOut size={13} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Terminate Session</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: IDENTITY DISPLAY CARD */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card-vapi relative overflow-hidden flex flex-col items-center text-center p-8 bg-zinc-950/40 backdrop-blur-xl border-white/5 glow-card-primary">
            {/* Ambient overlay grid */}
            <div className="absolute inset-0 bg-cyber-grid opacity-[0.05] pointer-events-none" />
            
            {/* AVATAR BOX WITH SLEEK NEON RING */}
            <div className="relative group mt-2">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-[2.2rem] blur opacity-30 group-hover:opacity-80 transition duration-700 animate-pulse-slow"></div>
              <div className="relative w-24 h-24 rounded-[2rem] bg-zinc-950 border-2 border-white/10 flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-105 group-hover:border-primary">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-primary tracking-wider">{initials}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 border border-zinc-950 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <UserCheck size={11} className="text-zinc-950 font-bold" />
              </div>
            </div>

            <h2 className="text-base font-black text-white mt-5 uppercase tracking-wider">
              {user?.full_name || 'System Operator'}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[8px] font-black text-primary uppercase tracking-[0.15em] leading-none">Registered Operator</span>
            </div>

            <div className="w-full h-px bg-white/5 my-6" />

            {/* INTEGRITY METADATA */}
            <div className="w-full space-y-3 text-left">
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-600 font-bold uppercase tracking-widest text-[8px]">Registry Link</span>
                <span className="text-zinc-300 font-mono text-[10px] select-all truncate max-w-[150px]">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-600 font-bold uppercase tracking-widest text-[8px]">Link Established</span>
                <span className="text-zinc-300 font-bold text-[10px]">{formatDate(user?.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-600 font-bold uppercase tracking-widest text-[8px]">Handshake Verification</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 font-black text-[8px] uppercase tracking-widest">
                  Granted
                </span>
              </div>
            </div>

            <div className="w-full h-px bg-white/5 my-6" />

            {/* SYSTEM ID */}
            <div className="w-full text-left space-y-1.5">
              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">System Core ID</label>
              <div className="flex items-center gap-2 w-full bg-zinc-950/80 border border-zinc-900 p-3 rounded-xl hover:border-zinc-800 transition-colors">
                <span className="text-[10px] font-mono text-zinc-500 truncate flex-1 select-all">{user?.id}</span>
                <button 
                  onClick={copyUserId}
                  className="p-1.5 text-zinc-600 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  {copiedId ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          {/* TELEMETRY NODES INDICATOR */}
          <div className="card-vapi p-6 space-y-4 bg-zinc-950/40 backdrop-blur-xl border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Telemetry Node Matrix</h3>
              <div className="flex items-center gap-1">
                <Radio size={10} className="text-primary animate-pulse" />
                <span className="text-[8px] font-bold text-primary uppercase tracking-widest">Active Ingest</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3.5 text-center hover:border-primary/20 transition-all duration-300">
                <div className="flex justify-center text-primary mb-1">
                  <Cpu size={14} />
                </div>
                <div className="text-base font-black text-white">{metrics.agents}</div>
                <div className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">Agents</div>
              </div>

              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3.5 text-center hover:border-primary/20 transition-all duration-300">
                <div className="flex justify-center text-primary mb-1">
                  <Package size={14} />
                </div>
                <div className="text-base font-black text-white">{metrics.tools}</div>
                <div className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">Tools</div>
              </div>

              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3.5 text-center hover:border-primary/20 transition-all duration-300">
                <div className="flex justify-center text-primary mb-1">
                  <Phone size={14} />
                </div>
                <div className="text-base font-black text-white">{metrics.numbers}</div>
                <div className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">Trunks</div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: UPDATE FORM & AUTHORIZATIONS */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="card-vapi p-8 bg-zinc-950/40 backdrop-blur-xl border-white/5 glow-card-primary">
            <div className="border-b border-zinc-900 pb-4 mb-6">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Registry Details
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                Configure your operator identity parameters mapped across console interfaces
              </p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              
              {/* DISPLAY NAME */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Operator Display Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-vapi w-full h-11 pl-12 text-[11px] font-black tracking-wide"
                    placeholder="Enter operator name"
                    required
                  />
                </div>
              </div>

              {/* CUSTOM AVATAR URL */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Avatar Display URL</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="input-vapi w-full h-11 pl-12 text-[11px] font-black"
                    placeholder="Paste unsplash URL or select presets below"
                  />
                </div>
              </div>

              {/* PRESETS WITH ROTATING neon BORDERS */}
              <div className="space-y-3.5">
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Preset Holograms</label>
                <div className="flex flex-wrap gap-4 items-center">
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all duration-300 hover:scale-105 ${
                        avatarUrl === preset ? 'border-primary shadow-[0_0_15px_rgba(0,112,243,0.3)]' : 'border-zinc-900 hover:border-zinc-600'
                      }`}
                    >
                      <img src={preset} alt={`preset-${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {avatarUrl && !PRESETS.includes(avatarUrl) && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-3.5 h-12 bg-zinc-950 border border-zinc-900 hover:border-red-500 text-zinc-500 hover:text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300"
                    >
                      Reset Preset
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full h-px bg-white/5 pt-2" />

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isUpdating}
                className="w-full flex items-center justify-center gap-2 h-12 bg-primary hover:bg-primary/95 text-[10px] font-black text-white uppercase tracking-[0.2em] rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,102,255,0.25)] border border-primary/20 disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Synchronizing...</span>
                  </>
                ) : (
                  <>
                    <span>Sync Registry Profile</span>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* ACCESS PERMISSION MATRIX */}
          <div className="card-vapi p-8 bg-zinc-950/40 backdrop-blur-xl border-white/5">
            <div className="border-b border-zinc-900 pb-4 mb-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Operator Authorization Matrix</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Privileges currently synced with global access protocols</p>
            </div>

            <div className="space-y-3.5">
              {PERMISSIONS.map((perm, idx) => (
                <div key={idx} className="p-3.5 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h5 className="text-[10px] font-black text-white uppercase tracking-wide">{perm.name}</h5>
                    <p className="text-[9px] text-zinc-500 font-semibold leading-normal">{perm.desc}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full border text-[7px] font-black uppercase tracking-widest shrink-0 ${perm.color}`}>
                    {perm.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* DEVELOPER TOKENS */}
          <div className="card-vapi p-8 bg-zinc-950/40 backdrop-blur-xl border-white/5">
            <div className="border-b border-zinc-900 pb-4 mb-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Access Handshake Keys</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Secure JWT headers utilized to verify external console requests</p>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 truncate">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Key size={14} />
                </div>
                <div className="truncate">
                  <h4 className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">Bearer JWT Token</h4>
                  <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                    Bearer {useAuthStore.getState().token || 'No active token'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const token = useAuthStore.getState().token;
                  if (token) {
                    navigator.clipboard.writeText(token);
                    toast.success('JWT Access Token copied to clipboard!');
                  }
                }}
                className="px-3.5 h-8 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Copy size={11} />
                <span>Copy</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
