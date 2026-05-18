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
  UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const PRESETS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=150&auto=format&fit=crop&q=80'
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
    <div className="space-y-8 pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row  justify-between items-start sm:items-center gap-4">
        <div>
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-[10px] font-black uppercase tracking-widest mb-2"
          >
            <ArrowLeft size={14} /> Return to Core
          </button>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">
            Neural Registry <span className="text-primary font-light">/ Profile</span>
          </h1>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Configure system authorization parameters, display identity, and trace node telemetry.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-5 h-11 bg-red-950/20 border border-red-500/20 hover:border-red-500 hover:bg-red-500/10 text-red-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 shadow-lg hover:shadow-red-500/5 group"
        >
          <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Terminate Session
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: IDENTITY DISPLAY */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card-vapi relative overflow-hidden flex flex-col items-center text-center p-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* AVATAR BOX */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-[2rem] bg-zinc-900 border-2 border-white/5 flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:border-primary/50 shadow-2xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-primary tracking-wider">{initials}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center">
                <UserCheck size={12} className="text-zinc-950 font-bold" />
              </div>
            </div>

            <h2 className="text-lg font-black text-white mt-5 uppercase tracking-wide">
              {user?.full_name || 'System Operator'}
            </h2>
            <p className="text-[10px] text-primary font-black tracking-widest uppercase mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Level 01 Operator
            </p>

            <div className="w-full h-px bg-white/5 my-6" />

            {/* QUICK META DETAILS */}
            <div className="w-full space-y-3.5 text-left text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">Email Registry</span>
                <span className="text-zinc-300 font-bold select-all">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">Registration</span>
                <span className="text-zinc-300 font-bold">{formatDate(user?.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">System Access</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 font-black text-[9px] uppercase tracking-widest">
                  Granted
                </span>
              </div>
            </div>

            <div className="w-full h-px bg-white/5 my-6" />

            {/* SYSTEM ID */}
            <div className="w-full text-left space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">System Identifier</label>
              <div className="flex items-center gap-2 w-full bg-zinc-950 border border-white/5 p-3 rounded-xl">
                <span className="text-[10px] font-mono text-zinc-400 truncate flex-1 select-all">{user?.id}</span>
                <button 
                  onClick={copyUserId}
                  className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-white/5 transition-colors"
                >
                  {copiedId ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          {/* TELEMETRY MATRIX */}
          <div className="card-vapi p-6 space-y-4">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Operator Registry Telemetry</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-4 text-center">
                <div className="flex justify-center text-primary mb-1">
                  <Cpu size={16} />
                </div>
                <div className="text-lg font-black text-white">{metrics.agents}</div>
                <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Nodes</div>
              </div>

              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-4 text-center">
                <div className="flex justify-center text-primary mb-1">
                  <Package size={16} />
                </div>
                <div className="text-lg font-black text-white">{metrics.tools}</div>
                <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Webhooks</div>
              </div>

              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-4 text-center">
                <div className="flex justify-center text-primary mb-1">
                  <Phone size={16} />
                </div>
                <div className="text-lg font-black text-white">{metrics.numbers}</div>
                <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Numbers</div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: UPDATE FORM */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="card-vapi p-8">
            <h2 className="text-lg font-black text-white uppercase tracking-wide mb-1">
              Registry Specifications
            </h2>
            <p className="text-xs text-zinc-500 font-medium mb-6">
              Modify display tags and authorization profile pictures mapped across assistant consoles.
            </p>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              
              {/* DISPLAY NAME */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Display Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={16} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-vapi w-full h-11 pl-12 text-[11px] font-black"
                    placeholder="Enter display name"
                    required
                  />
                </div>
              </div>

              {/* CUSTOM AVATAR URL */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Identity Display URL (Avatar)</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={16} />
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="input-vapi w-full h-11 pl-12 text-[11px] font-black"
                    placeholder="https://images.unsplash.com/... or presets below"
                  />
                </div>
              </div>

              {/* PRESETS */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Select Preset Hologram</label>
                <div className="flex gap-4">
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                        avatarUrl === preset ? 'border-primary scale-105 shadow-lg shadow-primary/20' : 'border-white/5 hover:border-zinc-500'
                      }`}
                    >
                      <img src={preset} alt={`preset-${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {avatarUrl && !PRESETS.includes(avatarUrl) && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-3 h-12 bg-zinc-900 border border-white/5 hover:border-red-500 text-zinc-400 hover:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Clear URL
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full h-px bg-white/5 pt-2" />

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isUpdating}
                className="w-full flex items-center justify-center gap-2.5 h-12 bg-primary hover:bg-primary-hover text-zinc-950 disabled:opacity-50 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 shadow-xl shadow-primary/20 hover:shadow-primary/30"
              >
                {isUpdating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating Registry...
                  </>
                ) : (
                  <>
                    Update Registry Details
                  </>
                )}
              </button>

            </form>
          </div>

          {/* DEVELOPER CREDENTIALS / SECURITY CARD */}
          <div className="card-vapi p-8 space-y-6">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wide mb-1">
                Developer Credentials
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                System tokens used to interact programmatically with Neural Forge endpoints.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-zinc-950 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Key size={16} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-zinc-200 uppercase tracking-wider">JWT Access Token</h4>
                    <p className="text-[10px] text-zinc-500 font-semibold truncate max-w-[200px] sm:max-w-xs md:max-w-md">
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
                  className="px-3 h-8 bg-zinc-900 border border-white/5 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5"
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
