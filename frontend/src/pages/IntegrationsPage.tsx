import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Trash2, 
  FileJson, 
  X, 
  Info,
  Phone,
  Copy,
  Check,
  Smartphone,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { BackButton } from '../components/BackButton';

interface Integration {
    id: string;
    provider: string;
    integration_type: string;
    scopes: string[];
    created_at: string;
}

const GoogleIcon = ({ size = 22 }: { size?: number }) => (
  <img 
    src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/google.svg" 
    alt="Google Workspace" 
    style={{ width: size, height: size }}
    className="object-contain" 
  />
);

const MicrosoftIcon = ({ size = 22 }: { size?: number }) => (
  <img 
    src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/microsoft.svg" 
    alt="Microsoft 365" 
    style={{ width: size, height: size }}
    className="object-contain" 
  />
);

const TwilioIcon = ({ size = 22 }: { size?: number }) => (
  <img 
    src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/twilio.svg" 
    alt="Twilio" 
    style={{ width: size, height: size }}
    className="object-contain" 
  />
);

const N8nIcon = ({ size = 22 }: { size?: number }) => (
  <img 
    src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/n8n.svg" 
    alt="n8n" 
    style={{ width: size, height: size }}
    className="object-contain" 
  />
);

const MakeIcon = ({ size = 22 }: { size?: number }) => (
  <img 
    src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/make.svg" 
    alt="Make.com" 
    style={{ width: size, height: size }}
    className="object-contain" 
  />
);

export const IntegrationsPage: React.FC = () => {
    const [userIntegrations, setUserIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Service Account Google Modal
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [jsonKey, setJsonKey] = useState('');
    
    // Twilio Modal & Secrets State
    const [showTwilioModal, setShowTwilioModal] = useState(false);
    const [hasTwilio, setHasTwilio] = useState(false);
    const [twilioKeys, setTwilioKeys] = useState({
        twilio_account_sid: '',
        twilio_auth_token: '',
        twilio_phone_number: ''
    });

    // Automation Integrations (n8n & Make)
    const [hasN8n, setHasN8n] = useState(false);
    const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
    const [hasMake, setHasMake] = useState(false);
    const [makeWebhookUrl, setMakeWebhookUrl] = useState('');
    const [showAutomationModal, setShowAutomationModal] = useState(false);
    const [automationProvider, setAutomationProvider] = useState<'n8n' | 'make' | null>(null);
    const [automationInput, setAutomationInput] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copiedText, setCopiedText] = useState<string | null>(null);

    const integrationsMetadata = [
        {
            id: 'google',
            name: 'Google Workspace',
            description: 'Calendar & Sheets sync.',
            icon: GoogleIcon,
            bg: 'bg-zinc-950/40 dark:bg-zinc-950/50',
            border: 'border-zinc-800'
        },
        {
            id: 'microsoft',
            name: 'Microsoft 365',
            description: 'Outlook & Excel tasks.',
            icon: MicrosoftIcon,
            bg: 'bg-zinc-950/40 dark:bg-zinc-950/50',
            border: 'border-zinc-800'
        },
        {
            id: 'twilio',
            name: 'Twilio Telephony',
            description: 'Direct cellular calls & inbound routing.',
            icon: TwilioIcon,
            bg: 'bg-red-500/5',
            border: 'border-red-500/10'
        }
    ];

    const fetchIntegrations = async () => {
        try {
            const [intResp, keyResp] = await Promise.all([
                api.get('/integrations/'),
                api.get('/keys/')
            ]);
            setUserIntegrations(intResp.data);
            
            const keys = keyResp.data.keys || {};
            setTwilioKeys({
                twilio_account_sid: keys.twilio_account_sid || '',
                twilio_auth_token: keys.twilio_auth_token || '',
                twilio_phone_number: keys.twilio_phone_number || ''
            });
            
            // Active if SID and phone number exist
            setHasTwilio(!!keys.twilio_account_sid && !!keys.twilio_phone_number);
        } catch (err) {
            console.error('Failed to fetch integrations or secrets profile', err);
        } finally {
            setTimeout(() => setLoading(false), 800);
        }
    };

    useEffect(() => {
        fetchIntegrations();

        // Check for OAuth outcome in URL
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'success') {
            toast.success('Integration Connected successfully!');
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('status') === 'error') {
            toast.error('OAuth authorization failed. Please verify credentials.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleConnect = async (provider: string) => {
        try {
            const resp = await api.get(`/integrations/${provider}/authorize`);
            if (resp.data.url) {
                window.location.href = resp.data.url;
            }
        } catch (err) {
            toast.error(`Failed to initialize ${provider.toUpperCase()} Gateway.`);
        }
    };

    const handleServiceAccountSubmit = async () => {
        if (!jsonKey.trim()) return toast.error('Please paste your JSON key');
        
        setIsSubmitting(true);
        const toastId = toast.loading('Connecting Integration...');
        try {
            const credentials = JSON.parse(jsonKey);
            await api.post('/integrations/service-account', {
                provider: 'google',
                credentials
            });
            
            toast.success('Integration Connected successfully!', { id: toastId });
            setShowKeyModal(false);
            setJsonKey('');
            fetchIntegrations();
        } catch (err) {
            console.error('Failed to save service account', err);
            toast.error('Invalid JSON key or Authorization failure', { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveTwilioKeys = async () => {
        setIsSubmitting(true);
        const toastId = toast.loading('Vaulting Twilio secrets...');
        try {
            await api.post('/keys/', twilioKeys);
            toast.success('Twilio Telephony Active!', { id: toastId });
            setShowTwilioModal(false);
            fetchIntegrations();
        } catch (err) {
            toast.error('Credential synchronization failed.', { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDisconnect = async (id: string) => {
        try {
            await api.delete(`/integrations/${id}`);
            toast.success('Integration disconnected.');
            fetchIntegrations();
        } catch (err) {
            toast.error('Failed to disconnect.');
        }
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(label);
        toast.success(`${label} copied to clipboard`);
        setTimeout(() => setCopiedText(null), 2000);
    };

    // Helper to check standard provider oauth status
    const getStatus = (provider: string) => {
        return userIntegrations.find(i => i.provider === provider);
    };

    const resolveWebhookUrl = (path: string) => {
        const origin = window.location.origin;
        const backendBase = origin.includes('localhost') || origin.includes('127.0.0.1')
          ? origin.replace('5173', '8000')
          : origin;
        return `${backendBase}/api/v1/telephony/twilio${path}`;
    };

    return (
        <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-500 font-sans">

            {/* HEADER SECTION */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
                <div>
                    <div className="mb-5">
                        <BackButton fallbackPath="/" label="Overview" />
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
                        Integrations Hub
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Configure Enterprise Connected Accounts</p>
                    </div>
                </div>

                <div className="flex items-center gap-3.5 self-start lg:self-auto">
                    <div className="h-11 px-4 border border-zinc-800 bg-zinc-950/40 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                        <ShieldCheck size={14} className="text-emerald-400 animate-pulse" />
                        <span>Vault Encrypted</span>
                    </div>
                </div>
            </div>

            {/* INTEGRATION GRID */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-68 rounded-3xl border border-zinc-900 bg-zinc-950/20 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {integrationsMetadata.map((int) => {
                        const isTwilio = int.id === 'twilio';
                        const isN8n = int.id === 'n8n';
                        const isMake = int.id === 'make';
                        
                        const isConnected = isTwilio 
                            ? hasTwilio 
                            : isN8n 
                                ? hasN8n 
                                : isMake 
                                    ? hasMake 
                                    : !!getStatus(int.id);
                        
                        const oauthIntegration = (isTwilio || isN8n || isMake) ? null : getStatus(int.id);
                        
                        return (
                            <div 
                                key={int.id}
                                className="rounded-3xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-xl p-6 hover:border-zinc-800 hover:bg-zinc-950 transition-all duration-300 flex flex-col justify-between min-h-[280px] group cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent" />
                                
                                <div>
                                    {/* TOP BRAND ICON & STATUS */}
                                    <div className="flex items-start justify-between mb-6">
                                        <div className={`w-13 h-13 rounded-2xl ${int.bg} ${int.border} border flex items-center justify-center shadow-md`}>
                                            <int.icon size={22} />
                                        </div>

                                        <span className={`px-2.5 py-1 border text-[9px] rounded-lg font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                                            isConnected 
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                : 'bg-zinc-950 border-zinc-900 text-zinc-600'
                                        }`}>
                                            <span className={`w-1 h-1 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-current'}`} />
                                            {isTwilio 
                                                ? (hasTwilio ? 'Active Node' : 'Offline')
                                                : isN8n 
                                                    ? (hasN8n ? 'Active' : 'Offline')
                                                    : isMake 
                                                        ? (hasMake ? 'Active' : 'Offline')
                                                        : oauthIntegration ? (oauthIntegration.integration_type === 'SERVICE_ACCOUNT' ? 'Service Active' : 'OAuth Active') : 'Offline'
                                            }
                                        </span>
                                    </div>

                                    {/* INFO TEXT */}
                                    <div className="space-y-2 mb-6">
                                        <h3 className="text-base font-extrabold text-zinc-200 tracking-wide group-hover:text-zinc-100 transition-colors duration-300">
                                            {int.name}
                                        </h3>
                                        <p className="text-zinc-550 text-xs leading-relaxed font-semibold">
                                            {int.description}
                                        </p>
                                    </div>
                                </div>

                                {/* CONTEXT ACTION BUTTONS */}
                                <div>
                                    {isTwilio ? (
                                        <button 
                                            onClick={() => setShowTwilioModal(true)}
                                            className="w-full flex items-center justify-between px-4.5 h-11 bg-zinc-900 hover:bg-red-550 border border-zinc-855 hover:border-red-500/30 text-zinc-300 hover:text-white rounded-xl transition-all duration-300 text-xs font-bold uppercase tracking-wider"
                                        >
                                            <span>{hasTwilio ? 'Edit Credentials' : 'Link Twilio Trunk'}</span>
                                            <ArrowRight size={13} />
                                        </button>
                                    ) : (isN8n || isMake) ? (
                                        <div className="space-y-2.5">
                                            {isConnected ? (
                                                <button 
                                                    onClick={() => {
                                                        if (isN8n) { setHasN8n(false); setN8nWebhookUrl(''); }
                                                        else { setHasMake(false); setMakeWebhookUrl(''); }
                                                        toast.success(`${int.name} disconnected`);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 h-11 bg-red-500/5 hover:bg-red-650 border border-red-500/10 hover:border-red-600 text-red-400 hover:text-white rounded-xl transition-all duration-300 text-xs font-bold uppercase tracking-wider"
                                                >
                                                    <Trash2 size={13} />
                                                    Disconnect
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        setAutomationProvider(int.id as 'n8n' | 'make');
                                                        setAutomationInput(int.id === 'n8n' ? n8nWebhookUrl : makeWebhookUrl);
                                                        setShowAutomationModal(true);
                                                    }}
                                                    className="w-full flex items-center justify-between px-4.5 h-11 bg-zinc-900 hover:bg-blue-650 border border-zinc-855 hover:border-blue-600 text-zinc-300 hover:text-white rounded-xl transition-all duration-300 text-xs font-bold uppercase tracking-wider"
                                                >
                                                    <span>{`Link ${int.name}`}</span>
                                                    <ArrowRight size={13} />
                                                </button>
                                            )}
                                        </div>
                                    ) : oauthIntegration ? (
                                        <button 
                                            onClick={() => handleDisconnect(oauthIntegration.id)}
                                            className="w-full flex items-center justify-center gap-2 h-11 bg-red-500/5 hover:bg-red-650 border border-red-500/10 hover:border-red-600 text-red-400 hover:text-white rounded-xl transition-all duration-300 text-xs font-bold uppercase tracking-wider"
                                        >
                                            <Trash2 size={13} />
                                            Disconnect Server
                                        </button>
                                    ) : (
                                        <div className="space-y-2.5">
                                            <button 
                                                onClick={() => handleConnect(int.id)}
                                                className="w-full flex items-center justify-between px-4.5 h-11 bg-zinc-900 hover:bg-blue-650 border border-zinc-855 hover:border-blue-600 text-zinc-300 hover:text-white rounded-xl transition-all duration-300 text-xs font-bold uppercase tracking-wider"
                                            >
                                                <span>OAuth Gateway Login</span>
                                                <ArrowRight size={13} />
                                            </button>
                                            <button 
                                                onClick={() => { if (int.id === 'google') setShowKeyModal(true); else toast('Microsoft JSON keys supported soon', { icon: '🛡️' }); }}
                                                className="w-full flex items-center justify-between px-4.5 h-11 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900/60 hover:border-zinc-800 text-zinc-500 hover:text-zinc-300 rounded-xl transition-all duration-300 text-xs font-bold uppercase tracking-wider"
                                            >
                                                <span>Direct JSON Key Input</span>
                                                <FileJson size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* NEURAL ADVISORY TIP */}
                    <div className="xl:col-span-3 p-5 bg-red-500/5 border border-dashed border-red-500/10 rounded-3xl flex flex-col md:flex-row items-center gap-4 mt-2 shadow-sm">
                        <div className="w-11 h-11 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/10">
                            <Zap size={18} className="text-red-400 animate-pulse" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h4 className="text-zinc-200 text-xs font-bold uppercase tracking-wider leading-none">Gateway Configuration Advisory</h4>
                            <p className="text-zinc-500 text-xs leading-relaxed font-semibold">
                                The <span className="text-red-400 font-bold">Twilio Telephony Integration</span> connects real virtual numbers to AI voice agents, dispatching automated conversations dynamically through local SIP gateways.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* GOOGLE SERVICE ACCOUNT MODAL */}
            {showKeyModal && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
                    <div className="bg-zinc-950 border border-zinc-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                        
                        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-900">
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                    <FileJson className="text-blue-500" size={18} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest leading-none">Google Service Account</h2>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Direct credential configuration</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowKeyModal(false)}
                                className="w-10 h-10 rounded-xl border border-zinc-850 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-3">
                                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                <div className="space-y-1.5">
                                    <p className="text-zinc-400 text-xs leading-relaxed font-semibold">
                                        Paste the complete credentials JSON object of your <span className="text-blue-455 font-bold">Google Cloud Service Account key</span> file here.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">JSON Key Content</label>
                                <textarea 
                                    className="w-full h-44 rounded-2xl border border-zinc-900 bg-zinc-950/60 p-4 font-mono text-xs text-blue-400/90 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/10 transition resize-none leading-relaxed"
                                    placeholder='{ "type": "service_account", ... }'
                                    value={jsonKey}
                                    onChange={(e) => setJsonKey(e.target.value)}
                                />
                            </div>

                            <button 
                                onClick={handleServiceAccountSubmit}
                                disabled={isSubmitting}
                                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded-xl flex items-center justify-center shadow-lg active:scale-98 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Verifying Link...' : 'Sync Service Credentials'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TWILIO GATEWAY CONFIGURATION MODAL */}
            {showTwilioModal && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
                    <div className="bg-zinc-950 border border-zinc-900 w-full max-w-[590px] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200 flex flex-col relative">
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
                        
                        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-900">
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                    <Phone className="text-red-500" size={18} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest leading-none">Twilio Node</h2>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Configure Vault Telephony secrets</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTwilioModal(false)}
                                className="w-10 h-10 rounded-xl border border-zinc-850 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Account SID</label>
                                    <input 
                                        className="w-full h-12 bg-zinc-900/60 border border-zinc-900 rounded-xl px-4 text-sm text-zinc-200 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10 placeholder:text-zinc-700 transition-all font-semibold"
                                        placeholder="e.g. ACXXXXXXXXXXXXXXXX"
                                        value={twilioKeys.twilio_account_sid}
                                        onChange={e => setTwilioKeys({...twilioKeys, twilio_account_sid: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Assigned Number</label>
                                    <input 
                                        className="w-full h-12 bg-zinc-900/60 border border-zinc-900 rounded-xl px-4 text-sm font-mono text-zinc-200 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10 placeholder:text-zinc-700 transition-all"
                                        placeholder="e.g. +1234567890"
                                        value={twilioKeys.twilio_phone_number}
                                        onChange={e => setTwilioKeys({...twilioKeys, twilio_phone_number: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Auth Token</label>
                                    <input 
                                        type="password"
                                        className="w-full h-12 bg-zinc-900/60 border border-zinc-900 rounded-xl px-4 text-sm text-zinc-200 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10 placeholder:text-zinc-700 transition-all font-mono"
                                        placeholder="Vaulted Secure Token"
                                        value={twilioKeys.twilio_auth_token}
                                        onChange={e => setTwilioKeys({...twilioKeys, twilio_auth_token: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* WEBHOOK CORNER */}
                            <div className="border-t border-zinc-900 pt-6 space-y-4">
                                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Twilio callback webhooks</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <span className="text-[9px] text-zinc-550 font-extrabold uppercase tracking-widest">Inbound Route Hook</span>
                                        <div className="flex bg-zinc-950/60 rounded-xl border border-zinc-900/80 p-3.5 items-center justify-between shadow-inner">
                                            <span className="font-mono text-[9px] text-zinc-450 truncate max-w-[170px]">
                                                {resolveWebhookUrl('/inbound')}
                                            </span>
                                            <button
                                                onClick={() => handleCopy(resolveWebhookUrl('/inbound'), 'Inbound Hook')}
                                                className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 ml-1"
                                            >
                                                {copiedText === 'Inbound Hook' ? <Check size={12} className="text-emerald-450" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <span className="text-[9px] text-zinc-550 font-extrabold uppercase tracking-widest">Outbound Flow Hook</span>
                                        <div className="flex bg-zinc-950/60 rounded-xl border border-zinc-900/80 p-3.5 items-center justify-between shadow-inner">
                                            <span className="font-mono text-[9px] text-zinc-455 truncate max-w-[170px]">
                                                {resolveWebhookUrl('/flow')}
                                            </span>
                                            <button
                                                onClick={() => handleCopy(resolveWebhookUrl('/flow'), 'Outbound Flow Hook')}
                                                className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 ml-1"
                                            >
                                                {copiedText === 'Outbound Flow Hook' ? <Check size={12} className="text-emerald-450" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveTwilioKeys}
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-red-650 to-amber-650 hover:from-red-550 hover:to-amber-550 text-white rounded-xl transition-all duration-300 font-bold uppercase tracking-widest text-[10px] gap-2 h-12 flex items-center justify-center disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <>
                                        <Smartphone size={15} strokeWidth={2.5} />
                                        Sync Twilio Profile
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* AUTOMATION MODAL (n8n / Make.com) */}
            {showAutomationModal && automationProvider && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
                    <div className="bg-zinc-950 border border-zinc-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200 flex flex-col relative">
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                        
                        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-900">
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center p-1.5">
                                    {automationProvider === 'n8n' ? <N8nIcon size={20} /> : <MakeIcon size={20} />}
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest leading-none">
                                        {automationProvider === 'n8n' ? 'n8n Automation' : 'Make.com Flow'}
                                    </h2>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">
                                        Link Voice Transcripts & Webhooks
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowAutomationModal(false); setAutomationInput(''); }}
                                className="w-10 h-10 rounded-xl border border-zinc-850 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-3">
                                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                <div className="space-y-1.5">
                                    <p className="text-zinc-400 text-xs leading-relaxed font-semibold">
                                        Enter your workflow webhook URL. When a call completes, a payload containing transcripts, caller intelligence, and duration will automatically dispatch.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">
                                    {automationProvider === 'n8n' ? 'n8n Webhook URL' : 'Make Custom Webhook URL'}
                                </label>
                                <input 
                                    className="w-full h-12 bg-zinc-900/60 border border-zinc-900 rounded-xl px-4 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 placeholder:text-zinc-700 transition-all font-semibold"
                                    placeholder={automationProvider === 'n8n' ? "e.g. https://n8n.yourdomain.com/webhook/..." : "e.g. https://hook.us1.make.com/..."}
                                    value={automationInput}
                                    onChange={e => setAutomationInput(e.target.value)}
                                />
                            </div>

                            <button 
                                onClick={() => {
                                    if (!automationInput.trim()) {
                                        toast.error('Webhook URL is required');
                                        return;
                                    }
                                    if (automationProvider === 'n8n') {
                                        setHasN8n(true);
                                        setN8nWebhookUrl(automationInput);
                                    } else {
                                        setHasMake(true);
                                        setMakeWebhookUrl(automationInput);
                                    }
                                    setShowAutomationModal(false);
                                    toast.success(`${automationProvider === 'n8n' ? 'n8n' : 'Make.com'} automation linked successfully!`);
                                }}
                                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded-xl flex items-center justify-center shadow-lg active:scale-98"
                            >
                                Link Workflow
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
