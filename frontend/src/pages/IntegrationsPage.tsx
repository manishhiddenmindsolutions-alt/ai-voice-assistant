import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Trash2, 
  CheckCircle2, 
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

const MicrosoftIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0h11v11H0z" fill="#F25022" />
    <path d="M12 0h11v11H12z" fill="#7FBA00" />
    <path d="M0 12h11v11H0z" fill="#00A4EF" />
    <path d="M12 12h11v11H12z" fill="#FFB900" />
  </svg>
);

const TwilioIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" className="stroke-red-400" />
    <path d="M12 8v8" className="stroke-red-400" />
  </svg>
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
        <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">

            {/* HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 uppercase tracking-wider">
                        Integrations Hub
                    </h1>
                    <p className="text-sm text-zinc-500 mt-2">
                        Configure authorized applications, cellular gateways, and secure service profiles.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <BackButton fallbackPath="/" label="Overview" />

                    <div className="h-11 px-4 border border-zinc-800 bg-zinc-950/40 rounded-xl flex items-center gap-2 text-xs font-semibold text-zinc-300">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        <span>Vault Secured</span>
                    </div>
                </div>
            </div>

            {/* INTEGRATION GRID */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 rounded-2xl border border-zinc-850 bg-zinc-900/20 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {integrationsMetadata.map((int) => {
                        const isTwilio = int.id === 'twilio';
                        const isConnected = isTwilio ? hasTwilio : !!getStatus(int.id);
                        const oauthIntegration = isTwilio ? null : getStatus(int.id);
                        
                        return (
                            <div 
                                key={int.id}
                                className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-blue-500/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[260px] group cursor-pointer"
                            >
                                <div>
                                    {/* TOP */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className={`w-12 h-12 rounded-2xl ${int.bg} ${int.border} border flex items-center justify-center`}>
                                            <int.icon size={22} />
                                        </div>

                                        <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${
                                            isConnected 
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                                                : 'bg-zinc-950 border-zinc-850 text-zinc-500'
                                        }`}>
                                            {isConnected && <CheckCircle2 size={8} />}
                                            {isTwilio 
                                                ? (hasTwilio ? 'Service Active' : 'Offline')
                                                : oauthIntegration ? (oauthIntegration.integration_type === 'SERVICE_ACCOUNT' ? 'Service Active' : 'OAuth Active') : 'Offline'
                                            }
                                        </div>
                                    </div>

                                    {/* INFO */}
                                    <div className="space-y-2 mb-6">
                                        <h3 className="text-base font-semibold text-zinc-100 group-hover:text-blue-500 transition-colors duration-300">{int.name}</h3>
                                        <p className="text-zinc-400 text-sm leading-relaxed font-medium">
                                            {int.description}
                                        </p>
                                    </div>
                                </div>

                                {/* BUTTONS */}
                                <div>
                                    {isTwilio ? (
                                        <button 
                                            onClick={() => setShowTwilioModal(true)}
                                            className="w-full flex items-center justify-between px-4 h-10 bg-zinc-950 hover:bg-red-650 border border-zinc-855 hover:border-red-600 text-zinc-300 hover:text-white rounded-xl transition text-xs font-semibold"
                                        >
                                            <span>{hasTwilio ? 'Edit Configuration' : 'Configure Gateway'}</span>
                                            <ArrowRight size={13} />
                                        </button>
                                    ) : oauthIntegration ? (
                                        <button 
                                            onClick={() => handleDisconnect(oauthIntegration.id)}
                                            className="w-full flex items-center justify-center gap-2 h-10 bg-red-500/5 hover:bg-red-500 border border-red-500/10 hover:border-red-500 text-red-550 hover:text-white rounded-xl transition text-xs font-semibold"
                                        >
                                            <Trash2 size={13} />
                                            Disconnect Integration
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <button 
                                                onClick={() => handleConnect(int.id)}
                                                className="w-full flex items-center justify-between px-4 h-10 bg-zinc-950 hover:bg-blue-650 border border-zinc-855 hover:border-blue-600 text-zinc-300 hover:text-white rounded-xl transition text-xs font-semibold"
                                            >
                                                <span>OAuth Gateway Login</span>
                                                <ArrowRight size={13} />
                                            </button>
                                            <button 
                                                onClick={() => { if (int.id === 'google') setShowKeyModal(true); else toast('Microsoft JSON keys supported soon', { icon: '🛡️' }); }}
                                                className="w-full flex items-center justify-between px-4 h-10 bg-zinc-900 hover:bg-zinc-850 border border-zinc-805 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl transition text-xs font-semibold"
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
                    <div className="xl:col-span-3 p-5 bg-red-500/5 border border-dashed border-red-500/20 rounded-3xl flex flex-col md:flex-row items-center gap-4 mt-2 animate-pulse-slow">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                            <Zap size={18} className="text-red-500" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h4 className="text-zinc-200 text-xs font-bold uppercase tracking-wider">Gateway Configuration Advisory</h4>
                            <p className="text-zinc-500 text-xs leading-relaxed font-semibold">
                                The <span className="text-red-500 font-bold">Twilio Telephony Integration</span> connects real virtual numbers to AI voice agents, dispatching automated conversations dynamically through local SIP gateways.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* GOOGLE SERVICE ACCOUNT MODAL */}
            {showKeyModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
                    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
                        
                        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-855">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                    <FileJson className="text-blue-500" size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-zinc-100 leading-none">Configure Key</h2>
                                    <p className="text-xs text-zinc-550 mt-1">Direct Service account authorization</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowKeyModal(false)}
                                className="w-10 h-10 rounded-xl border border-zinc-850 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-3">
                                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <p className="text-zinc-400 text-xs leading-relaxed font-semibold">
                                        Paste the complete credentials JSON object of your <span className="text-blue-400 font-bold">Google Cloud Service Account key</span>.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-350">JSON Key Content</label>
                                <textarea 
                                    className="w-full h-44 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-blue-400/90 outline-none focus:border-blue-500 transition resize-none leading-relaxed"
                                    placeholder='{ "type": "service_account", ... }'
                                    value={jsonKey}
                                    onChange={(e) => setJsonKey(e.target.value)}
                                />
                            </div>

                            <button 
                                onClick={handleServiceAccountSubmit}
                                disabled={isSubmitting}
                                className="w-full h-11 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition rounded-xl flex items-center justify-center shadow-lg disabled:opacity-50"
                            >
                                {isSubmitting ? 'Connecting...' : 'Connect Integration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TWILIO GATEWAY CONFIGURATION MODAL */}
            {showTwilioModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
                    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-[580px] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col relative">
                        
                        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-900">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                    <Phone className="text-red-500" size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-zinc-100 uppercase tracking-wider leading-none">Twilio Gateway</h2>
                                    <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Configure Twilio credentials</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTwilioModal(false)}
                                className="w-10 h-10 rounded-xl border border-zinc-850 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Account SID</label>
                                    <input 
                                        className="w-full h-11 bg-zinc-900 border border-zinc-855 rounded-xl px-4 text-sm text-zinc-200 outline-none focus:border-red-500 placeholder:text-zinc-700 transition-all font-semibold"
                                        placeholder="e.g. ACXXXXXXXXXXXXXXXX"
                                        value={twilioKeys.twilio_account_sid}
                                        onChange={e => setTwilioKeys({...twilioKeys, twilio_account_sid: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Phone Number</label>
                                    <input 
                                        className="w-full h-11 bg-zinc-900 border border-zinc-855 rounded-xl px-4 text-sm font-mono text-zinc-200 outline-none focus:border-red-500 placeholder:text-zinc-700 transition-all"
                                        placeholder="e.g. +1234567890"
                                        value={twilioKeys.twilio_phone_number}
                                        onChange={e => setTwilioKeys({...twilioKeys, twilio_phone_number: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Auth Token</label>
                                    <input 
                                        type="password"
                                        className="w-full h-11 bg-zinc-900 border border-zinc-855 rounded-xl px-4 text-sm text-zinc-200 outline-none focus:border-red-500 placeholder:text-zinc-700 transition-all"
                                        placeholder="Vaulted Secure Token"
                                        value={twilioKeys.twilio_auth_token}
                                        onChange={e => setTwilioKeys({...twilioKeys, twilio_auth_token: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* WEBHOOK CORNER */}
                            <div className="border-t border-zinc-900 pt-6 space-y-4">
                                <h3 className="text-xs font-bold text-zinc-350 uppercase tracking-wider">Required Twilio callback webhooks</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Inbound Route Hook</span>
                                        <div className="flex bg-zinc-950 rounded-xl border border-zinc-900 p-3 items-center justify-between">
                                            <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[170px]">
                                                {resolveWebhookUrl('/inbound')}
                                            </span>
                                            <button
                                                onClick={() => handleCopy(resolveWebhookUrl('/inbound'), 'Inbound Hook')}
                                                className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 ml-1"
                                            >
                                                {copiedText === 'Inbound Hook' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Outbound Flow Hook</span>
                                        <div className="flex bg-zinc-950 rounded-xl border border-zinc-900 p-3 items-center justify-between">
                                            <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[170px]">
                                                {resolveWebhookUrl('/flow')}
                                            </span>
                                            <button
                                                onClick={() => handleCopy(resolveWebhookUrl('/flow'), 'Outbound Flow Hook')}
                                                className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 ml-1"
                                            >
                                                {copiedText === 'Outbound Flow Hook' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveTwilioKeys}
                                disabled={isSubmitting}
                                className="btn-vapi w-full h-11 bg-red-500 hover:bg-red-650 text-white rounded-xl shadow-xs transition-all duration-300 font-bold uppercase tracking-wider text-xs gap-2 flex items-center justify-center"
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
        </div>
    );
};
