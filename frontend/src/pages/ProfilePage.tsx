import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { authApi, agentApi, toolApi, numbersApi } from '../services/api';
import { 
  User as UserIcon, 
  Key, 
  LogOut, 
  Loader2,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BackButton } from '../components/BackButton';

const PRESETS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=150&auto=format&fit=crop&q=80'
];

const PERMISSIONS = [
  { name: 'WebRTC Signaling', desc: 'Allow real-time speech signaling over WebRTC gateways.', status: 'Authorized' },
  { name: 'Model Inference', desc: 'Execute models per custom router rules.', status: 'Authorized' },
  { name: 'Tools Execution', desc: 'Read/write permissions for sheets, webhooks, and calendar.', status: 'Authorized' },
  { name: 'Admin Key Rotation', desc: 'Full privileges to rotate credentials and keys.', status: 'Default' }
];

const ProfileStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
  </div>
);

export const ProfilePage = () => {
  const { user, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);
  
  const [metrics, setMetrics] = useState({ agents: 0, tools: 0, numbers: 0 });

  useEffect(() => {
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
      const res = await authApi.updateProfile({ full_name: fullName, avatar_url: avatarUrl });
      const token = useAuthStore.getState().token;
      if (token) setAuth(token, res.data);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user?.email.substring(0, 2).toUpperCase();

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <div className="mb-3">
            <BackButton fallbackPath="/" label="Dashboard" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Account Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage your profile and workspace access.
          </p>
        </div>

        <button onClick={handleLogout} className="btn-danger self-start lg:self-auto">
          <LogOut size={15} />
          Logout
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        
        {/* LEFT SIDEBAR */}
        <div className="space-y-4">
          {/* PROFILE CARD */}
          <div className="card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div 
                  className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border)' }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{initials}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md border-2" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--card-bg)' }} />
              </div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.full_name || 'User'}</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              <div className="mt-3 badge-primary text-xs">Pro Workspace</div>
            </div>
            <div className="mt-6 space-y-0">
              <ProfileStat label="Agents" value={metrics.agents} />
              <ProfileStat label="Tools" value={metrics.tools} />
              <ProfileStat label="Phone Numbers" value={metrics.numbers} />
              <ProfileStat label="Joined" value={formatDate(user?.created_at)} />
            </div>
          </div>

          {/* TOKEN CARD */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>API Token</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>For external requests.</p>
              </div>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <Key size={16} />
              </div>
            </div>
            <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-mono break-all select-all flex-1" style={{ color: 'var(--text-secondary)' }}>
                {showToken ? (useAuthStore.getState().token || 'No token') : '••••••••••••••••••••••••••'}
              </p>
              <button onClick={() => setShowToken(!showToken)} className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-muted)' }}>
                {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <button
              onClick={() => {
                const token = useAuthStore.getState().token;
                if (token) { navigator.clipboard.writeText(token); toast.success('Token copied'); }
              }}
              className="btn-outline w-full mt-3 text-xs h-9"
            >
              <Copy size={13} />
              Copy Token
            </button>
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div className="space-y-6">
          {/* PROFILE FORM */}
          <div className="card p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Profile Details</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Update your personal information.</p>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
                <div className="relative">
                  <UserIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field pl-10" placeholder="Your name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Avatar URL</label>
                <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="input-field" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Presets</label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset, idx) => (
                    <button key={idx} type="button" onClick={() => setAvatarUrl(preset)}
                      className="w-12 h-12 rounded-lg overflow-hidden transition-all"
                      style={{ border: avatarUrl === preset ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                    >
                      <img src={preset} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={isUpdating} className="btn-primary h-10">
                {isUpdating ? (<><Loader2 size={15} className="animate-spin" /> Saving...</>) : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* PERMISSIONS */}
          <div className="card p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Permissions</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Workspace access and capabilities.</p>
            </div>
            <div className="space-y-3">
              {PERMISSIONS.map((perm, idx) => (
                <div key={idx} className="p-4 rounded-lg flex items-start justify-between gap-3" style={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>
                  <div>
                    <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{perm.name}</h4>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{perm.desc}</p>
                  </div>
                  <span className="badge-success text-[11px] py-0.5 shrink-0">{perm.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
