import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { authApi, agentApi, toolApi, numbersApi } from '../services/api';
import { 
  User as UserIcon, 
  Key, 
  LogOut, 
  ArrowLeft, 
  Loader2,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const PRESETS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=150&auto=format&fit=crop&q=80'
];

const PERMISSIONS = [
  { name: 'Neural Call Handshake', desc: 'Allow real-time speech signaling over WebRTC gateways.', status: 'Authorized' },
  { name: 'Model Inference Bypass', desc: 'Allows direct execution of BYOK models per custom router rules.', status: 'Authorized' },
  { name: 'Tools Execution & Dispatch', desc: 'Read/write permissions for sheets sync, webhooks, and calendar.', status: 'Authorized' },
  { name: 'Platform Admin Key Rotation', desc: 'Full privileges to encrypt and rotate credentials keys.', status: 'System Default' }
];

const ProfileStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-zinc-500">{label}</span>
    <span className="text-sm font-semibold text-zinc-100">{value}</span>
  </div>
);

export const ProfilePage = () => {
  const { user, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
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
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to update registry details.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Session terminated.');
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
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">

        <div>
          <button
            onClick={() => navigate('/')}
            className="h-9 px-4 rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition flex items-center gap-2 mb-5"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Account Settings
          </h1>

          <p className="text-sm text-zinc-500 mt-2">
            Manage your profile, workspace access and developer credentials.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="h-11 px-5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500 hover:text-white text-sm font-medium transition flex items-center gap-2"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">

        {/* SIDEBAR PROFILE */}
        <div className="space-y-6">

          {/* PROFILE CARD */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] transition-all duration-300">

            <div className="flex flex-col items-center text-center">

              {/* AVATAR */}
              <div className="relative mb-5">

                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center">

                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-semibold text-zinc-100">
                      {initials}
                    </span>
                  )}
                </div>

                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 border-2 border-zinc-950" />
              </div>

              {/* NAME */}
              <h2 className="text-xl font-semibold text-zinc-100">
                {user?.full_name || 'Operator'}
              </h2>

              <p className="text-sm text-zinc-500 mt-1">
                {user?.email}
              </p>

              {/* BADGE */}
              <div className="mt-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                Pro Workspace
              </div>
            </div>

            {/* INFO */}
            <div className="mt-8 space-y-5">

              <ProfileStat
                label="Agents"
                value={metrics.agents}
              />

              <ProfileStat
                label="Tools"
                value={metrics.tools}
              />

              <ProfileStat
                label="Phone Numbers"
                value={metrics.numbers}
              />

              <ProfileStat
                label="Joined"
                value={formatDate(user?.created_at)}
              />
            </div>
          </div>

          {/* TOKEN CARD */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] transition-all duration-300">

            <div className="flex items-center justify-between mb-5">

              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  API Token
                </h3>

                <p className="text-sm text-zinc-500 mt-1">
                  Used for external requests.
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                <Key size={16} />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3">

              <p className="text-xs font-mono text-zinc-400 break-all select-all flex-1">
                {showToken ? (useAuthStore.getState().token || 'No token') : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </p>

              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-405 hover:text-zinc-200 transition flex items-center justify-center shrink-0"
                title={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <button
              onClick={() => {
                const token = useAuthStore.getState().token;

                if (token) {
                  navigator.clipboard.writeText(token);
                  toast.success('Token copied');
                }
              }}
              className="mt-4 w-full h-10 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition flex items-center justify-center gap-2"
            >
              <Copy size={14} />
              Copy Token
            </button>
          </div>
        </div>

        {/* RIGHT SETTINGS */}
        <div className="space-y-8">

          {/* PROFILE FORM */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] transition-all duration-300">

            <div className="mb-6">

              <h2 className="text-xl font-semibold text-zinc-100">
                Profile Details
              </h2>

              <p className="text-sm text-zinc-500 mt-1">
                Update your personal information and avatar.
              </p>
            </div>

            <form
              onSubmit={handleUpdateProfile}
              className="space-y-6"
            >

              {/* NAME */}
              <div className="space-y-2">

                <label className="text-sm font-medium text-zinc-300">
                  Full Name
                </label>

                <div className="relative">

                  <UserIcon
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                  />

                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(e.target.value)
                    }
                    className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 pl-12 pr-4 text-sm outline-none focus:border-primary transition"
                    placeholder="Your name"
                  />
                </div>
              </div>

              {/* AVATAR URL */}
              <div className="space-y-2">

                <label className="text-sm font-medium text-zinc-300">
                  Avatar URL
                </label>

                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) =>
                    setAvatarUrl(e.target.value)
                  }
                  className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition"
                  placeholder="https://..."
                />
              </div>

              {/* PRESETS */}
              <div className="space-y-3">

                <label className="text-sm font-medium text-zinc-300">
                  Presets
                </label>

                <div className="flex flex-wrap gap-3">

                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`w-14 h-14 rounded-2xl overflow-hidden border transition ${
                        avatarUrl === preset
                          ? 'border-primary'
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <img
                        src={preset}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* SAVE */}
              <button
                type="submit"
                disabled={isUpdating}
                className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </form>
          </div>

          {/* PERMISSIONS */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] transition-all duration-300">

            <div className="mb-6">

              <h2 className="text-xl font-semibold text-zinc-100">
                Permissions
              </h2>

              <p className="text-sm text-zinc-550 mt-1">
                Workspace access and capabilities.
              </p>
            </div>

            <div className="space-y-4">

              {PERMISSIONS.map((perm, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 flex items-start justify-between gap-4"
                >

                  <div>
                    <h4 className="text-sm font-medium text-zinc-100">
                      {perm.name}
                    </h4>

                    <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
                      {perm.desc}
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium whitespace-nowrap">
                    {perm.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
