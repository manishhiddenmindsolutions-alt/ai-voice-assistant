import { useState, useEffect } from 'react';
import {
  Shield,
  Phone,
  Globe,
  Bell,
  Clock,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Server,
  User,
  Mail,
  Calendar,
  Hash,
  Zap,
  Languages,
  Timer,
} from 'lucide-react';
import { settingsApi } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { BackButton } from '../components/BackButton';
import toast from 'react-hot-toast';

const SettingsPage = () => {
  const user = useAuthStore(state => state.user);

  // Telephony
  const [telephony, setTelephony] = useState({
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    default_agent_id: '',
    has_sip_trunks: false,
    inbound_active: false,
    outbound_active: false,
    trunk_count: 0,
  });

  // General
  const [general, setGeneral] = useState({
    timezone: 'UTC',
    default_language: 'en',
    notifications_enabled: true,
    auto_disconnect_seconds: 300,
  });

  // Account
  const [account, setAccount] = useState<any>(null);

  // Loading
  const [savingTelephony, setSavingTelephony] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);

  const [activeSection, setActiveSection] = useState<'telephony' | 'general' | 'account'>('telephony');

  useEffect(() => {
    const load = async () => {
      try {
        const [telResp, genResp, accResp] = await Promise.all([
          settingsApi.getTelephony(),
          settingsApi.getGeneral(),
          settingsApi.getAccount(),
        ]);
        setTelephony(telResp.data);
        setGeneral(genResp.data);
        setAccount(accResp.data);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    load();
  }, []);

  const handleSaveTelephony = async () => {
    setSavingTelephony(true);
    try {
      await settingsApi.updateTelephony({
        twilio_account_sid: telephony.twilio_account_sid,
        twilio_auth_token: telephony.twilio_auth_token,
        twilio_phone_number: telephony.twilio_phone_number,
        default_agent_id: telephony.default_agent_id || null,
      });
      toast.success('Telephony settings saved.');
    } catch (err) {
      toast.error('Failed to save telephony settings.');
    } finally {
      setSavingTelephony(false);
    }
  };

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await settingsApi.updateGeneral(general);
      toast.success('General settings saved.');
    } catch (err) {
      toast.error('Failed to save general settings.');
    } finally {
      setSavingGeneral(false);
    }
  };

  const sections = [
    { id: 'telephony' as const, label: 'Telephony', icon: Phone, color: 'text-orange-400' },
    { id: 'general' as const, label: 'General', icon: Globe, color: 'text-blue-400' },
    { id: 'account' as const, label: 'Account', icon: User, color: 'text-violet-400' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
        <div>
          <div className="mb-5">
            <BackButton fallbackPath="/" label="Overview" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Settings
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <p className="text-zinc-550 text-xs font-bold uppercase tracking-wider leading-none">
              System Configuration
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SIDEBAR NAV */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 sticky top-24">
            <nav className="space-y-1">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                    activeSection === s.id
                      ? 'bg-blue-500/10 text-blue-450 border border-blue-500/20'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20 border border-transparent'
                  }`}
                >
                  <s.icon size={15} className={activeSection === s.id ? 'text-blue-400' : 'text-zinc-600'} />
                  {s.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="lg:col-span-3 space-y-6">
          {/* ─── TELEPHONY SECTION ──────────────────────────────────────── */}
          {activeSection === 'telephony' && (
            <div className="animate-in fade-in duration-300 space-y-6">
              {/* SIP Trunk Status */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <Server size={15} className="text-orange-400" />
                  SIP Trunk Status
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      {telephony.has_sip_trunks ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <AlertCircle size={14} className="text-amber-400" />
                      )}
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Provisioned</span>
                    </div>
                    <span className={`text-lg font-bold ${telephony.has_sip_trunks ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {telephony.trunk_count} Trunks
                    </span>
                  </div>
                  
                  <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      {telephony.inbound_active ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <AlertCircle size={14} className="text-zinc-600" />
                      )}
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Inbound</span>
                    </div>
                    <span className={`text-lg font-bold ${telephony.inbound_active ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {telephony.inbound_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      {telephony.outbound_active ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <AlertCircle size={14} className="text-zinc-600" />
                      )}
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Outbound</span>
                    </div>
                    <span className={`text-lg font-bold ${telephony.outbound_active ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {telephony.outbound_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Twilio Credentials */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <Key size={15} className="text-amber-400" />
                  Twilio Credentials
                </h2>

                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <InputField
                      label="Account SID"
                      value={telephony.twilio_account_sid}
                      onChange={(v: string) => setTelephony({ ...telephony, twilio_account_sid: v })}
                      placeholder="ACXXXXXXXX"
                      icon={<Hash size={13} />}
                    />
                    <InputField
                      label="Phone Number"
                      value={telephony.twilio_phone_number}
                      onChange={(v: string) => setTelephony({ ...telephony, twilio_phone_number: v })}
                      placeholder="+1234567890"
                      icon={<Phone size={13} />}
                      mono
                    />
                  </div>
                  <InputField
                    label="Auth Token"
                    value={telephony.twilio_auth_token}
                    onChange={(v: string) => setTelephony({ ...telephony, twilio_auth_token: v })}
                    placeholder="Vaulted token"
                    icon={<Shield size={13} />}
                    type="password"
                  />

                  <button
                    onClick={handleSaveTelephony}
                    disabled={savingTelephony}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold h-11 rounded-xl transition-all duration-300 uppercase tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {savingTelephony ? <Loader2 className="animate-spin" size={16} /> : (
                      <>
                        <Save size={14} />
                        Save Telephony Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── GENERAL SECTION ────────────────────────────────────────── */}
          {activeSection === 'general' && (
            <div className="animate-in fade-in duration-300 space-y-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <Globe size={15} className="text-blue-400" />
                  Preferences
                </h2>

                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Timezone */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                        <Clock size={12} /> Timezone
                      </label>
                      <select
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm text-zinc-200 outline-none focus:border-blue-500 transition-all cursor-pointer"
                        value={general.timezone}
                        onChange={e => setGeneral({ ...general, timezone: e.target.value })}
                      >
                        <option value="UTC">UTC</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                        <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
                      </select>
                    </div>

                    {/* Default Language */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                        <Languages size={12} /> Default Language
                      </label>
                      <select
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm text-zinc-200 outline-none focus:border-blue-500 transition-all cursor-pointer"
                        value={general.default_language}
                        onChange={e => setGeneral({ ...general, default_language: e.target.value })}
                      >
                        <option value="en">English</option>
                        <option value="hi-IN">Hindi</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ja">Japanese</option>
                      </select>
                    </div>
                  </div>

                  {/* Auto-disconnect Timer */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                      <Timer size={12} /> Auto-Disconnect Timer (seconds)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm font-mono text-zinc-200 outline-none focus:border-blue-500 transition-all"
                      value={general.auto_disconnect_seconds}
                      onChange={e => setGeneral({ ...general, auto_disconnect_seconds: parseInt(e.target.value) || 300 })}
                      min={30}
                      max={3600}
                    />
                  </div>

                  {/* Notifications Toggle */}
                  <div className="flex items-center justify-between p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Bell size={15} className="text-zinc-400" />
                      <div>
                        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider block">Notifications</span>
                        <span className="text-[10px] text-zinc-500">Receive alerts for call events</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setGeneral({ ...general, notifications_enabled: !general.notifications_enabled })}
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative ${
                        general.notifications_enabled ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-all duration-300 ${
                        general.notifications_enabled ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  <button
                    onClick={handleSaveGeneral}
                    disabled={savingGeneral}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold h-11 rounded-xl transition-all duration-300 uppercase tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {savingGeneral ? <Loader2 className="animate-spin" size={16} /> : (
                      <>
                        <Save size={14} />
                        Save General Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── ACCOUNT SECTION ────────────────────────────────────────── */}
          {activeSection === 'account' && (
            <div className="animate-in fade-in duration-300 space-y-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <User size={15} className="text-violet-400" />
                  Account Information
                </h2>

                <div className="space-y-4">
                  <InfoRow icon={<User size={13} />} label="Full Name" value={account?.full_name || user?.full_name || '—'} />
                  <InfoRow icon={<Mail size={13} />} label="Email" value={account?.email || user?.email || '—'} />
                  <InfoRow icon={<Calendar size={13} />} label="Member Since" value={account?.created_at ? new Date(account.created_at).toLocaleDateString() : '—'} />
                  <InfoRow icon={<Zap size={13} />} label="Active Agents" value={String(account?.agent_count || 0)} />
                  <InfoRow icon={<Phone size={13} />} label="Phone Numbers" value={String(account?.number_count || 0)} />
                </div>
              </div>

              {/* API Key Display */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <Key size={15} className="text-amber-400" />
                  API Access
                </h2>
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-2">User ID</span>
                  <code className="text-xs text-zinc-400 font-mono break-all">{account?.user_id || '—'}</code>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
                <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertCircle size={15} />
                  Danger Zone
                </h2>
                <p className="text-xs text-zinc-500 mb-4">
                  Irreversible actions. Proceed with caution.
                </p>
                <button className="px-4 py-2.5 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-500/10 transition-all">
                  Delete All Call Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Reusable Components ─────────────────────────────────────────────────────

const InputField = ({ label, value, onChange, placeholder, icon, type = 'text', mono = false }: any) => (
  <div className="space-y-2">
    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
      {icon} {label}
    </label>
    <input
      type={type}
      className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm text-zinc-200 outline-none focus:border-blue-500 transition-all placeholder:text-zinc-700 ${mono ? 'font-mono' : ''}`}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

const InfoRow = ({ icon, label, value }: any) => (
  <div className="flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-900 rounded-xl">
    <div className="flex items-center gap-2.5">
      <span className="text-zinc-500">{icon}</span>
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-sm font-semibold text-zinc-200">{value}</span>
  </div>
);

export default SettingsPage;
