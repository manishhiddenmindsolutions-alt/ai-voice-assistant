import React, { useState, useEffect } from 'react';
import { Calendar, Layout, ArrowRight, ShieldCheck, Zap, Trash2, CheckCircle2, FileJson, X, Info, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

interface Integration {
    id: string;
    provider: string;
    integration_type: string;
    scopes: string[];
    created_at: string;
}

export const IntegrationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [userIntegrations, setUserIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [jsonKey, setJsonKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const integrationsMetadata = [
        {
            id: 'google',
            name: 'Google Workspace',
            description: 'Calendar & Sheets sync.',
            icon: Calendar,
            color: 'text-blue-500',
            bg: 'bg-blue-500/5',
            border: 'border-blue-500/10'
        },
        {
            id: 'microsoft',
            name: 'Microsoft 365',
            description: 'Outlook & Excel tasks.',
            icon: Layout,
            color: 'text-orange-500',
            bg: 'bg-orange-500/5',
            border: 'border-orange-500/10'
        }
    ];

    useEffect(() => {
        fetchIntegrations();

        // Check for OAuth outcome in URL
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'success') {
            toast.success('Neural Nexus Connected successfully!');
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('status') === 'error') {
            toast.error('OAuth handshake failed. Please verify credentials.');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const fetchIntegrations = async () => {
        try {
            const resp = await api.get('/integrations/');
            setUserIntegrations(resp.data);
        } catch (err) {
            console.error('Failed to fetch integrations', err);
        } finally {
            // Add a small artificial delay for smoother transitions
            setTimeout(() => setLoading(false), 800);
        }
    };

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
        const toastId = toast.loading('Establishing Formal Link...');
        try {
            const credentials = JSON.parse(jsonKey);
            await api.post('/integrations/service-account', {
                provider: 'google',
                credentials
            });
            
            toast.success('Neural Nexus Link Established!', { id: toastId });
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

    const handleDisconnect = async (id: string) => {
        try {
            await api.delete(`/integrations/${id}`);
            toast.success('Integration disconnected.');
            fetchIntegrations();
        } catch (err) {
            toast.error('Failed to disconnect.');
        }
    };

    // Helper to check if a provider is connected
    const getStatus = (provider: string) => {
        return userIntegrations.find(i => i.provider === provider);
    };

    return (
        <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">

            {/* HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
                        Neural Nexus
                    </h1>
                    <p className="text-sm text-zinc-550 mt-2">
                        Configure authorization meshes, OAuth channels, and service keys.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="h-11 px-5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition flex items-center gap-2"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>

                    <div className="h-11 px-4 border border-zinc-800 bg-zinc-950/40 rounded-xl flex items-center gap-2 text-xs font-semibold text-zinc-300">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        <span>Vault Secured</span>
                    </div>
                </div>
            </div>

            {/* INTEGRATION GRID */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2].map(i => (
                        <div key={i} className="h-64 rounded-2xl border border-zinc-850 bg-zinc-900/20 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {integrationsMetadata.map((int) => {
                        const status = getStatus(int.id);
                        return (
                            <div 
                                key={int.id}
                                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] transition-all duration-300 flex flex-col justify-between min-h-[260px] group cursor-pointer"
                            >
                                <div>
                                    {/* TOP */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className={`w-12 h-12 rounded-2xl ${int.bg} ${int.border} border flex items-center justify-center`}>
                                            <int.icon size={22} className={int.color} />
                                        </div>

                                        <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${
                                            status 
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                                                : 'bg-zinc-950 border-zinc-850 text-zinc-500'
                                        }`}>
                                            {status && <CheckCircle2 size={8} />}
                                            {status ? (status.integration_type === 'SERVICE_ACCOUNT' ? 'Service Active' : 'OAuth Active') : 'Offline'}
                                        </div>
                                    </div>

                                    {/* INFO */}
                                    <div className="space-y-2 mb-6">
                                        <h3 className="text-base font-semibold text-zinc-100 group-hover:text-primary transition-colors duration-300">{int.name}</h3>
                                        <p className="text-zinc-400 text-sm leading-relaxed">
                                            {int.description}
                                        </p>
                                    </div>
                                </div>

                                {/* BUTTONS */}
                                <div>
                                    {status ? (
                                        <button 
                                            onClick={() => handleDisconnect(status.id)}
                                            className="w-full flex items-center justify-center gap-2 h-10 bg-red-500/5 hover:bg-red-500 border border-red-500/10 hover:border-red-500 text-red-550 hover:text-white rounded-xl transition text-xs font-semibold"
                                        >
                                            <Trash2 size={13} />
                                            Disconnect Integration
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <button 
                                                onClick={() => handleConnect(int.id)}
                                                className="w-full flex items-center justify-between px-4 h-10 bg-zinc-950 hover:bg-primary border border-zinc-850 hover:border-primary text-zinc-300 hover:text-white rounded-xl transition text-xs font-semibold"
                                            >
                                                <span>OAuth Gateway Login</span>
                                                <ArrowRight size={13} />
                                            </button>
                                            <button 
                                                onClick={() => { if (int.id === 'google') setShowKeyModal(true); else toast('Microsoft JSON keys supported soon', { icon: '🛡️' }); }}
                                                className="w-full flex items-center justify-between px-4 h-10 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl transition text-xs font-semibold"
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

                    {/* NEURAL TIP */}
                    <div className="xl:col-span-3 p-5 bg-primary/5 border border-dashed border-primary/20 rounded-2xl flex flex-col md:flex-row items-center gap-4 mt-2">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Zap size={18} className="text-primary animate-pulse" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h4 className="text-zinc-200 text-xs font-bold uppercase tracking-wider">Gateway Configuration Advisory</h4>
                            <p className="text-zinc-550 text-xs leading-relaxed font-semibold">
                                The <span className="text-primary font-bold">JSON Key Integration</span> allows direct scheduling and spreadsheet logs securely, bypassing public redirect handshakes.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SERVICE ACCOUNT MODAL */}
            {showKeyModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
                    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
                        
                        {/* MODAL HEADER */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-850">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                    <FileJson className="text-blue-550" size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-zinc-100 leading-none">Configure Key</h2>
                                    <p className="text-xs text-zinc-500 mt-1">Direct Service account authorization</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowKeyModal(false)}
                                className="w-10 h-10 rounded-xl border border-zinc-850 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* BODY */}
                        <div className="p-6 space-y-5">
                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-3">
                                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <p className="text-zinc-400 text-xs leading-relaxed font-semibold">
                                        Paste the complete credentials JSON object of your <span className="text-blue-400 font-bold">Google Cloud Service Account key</span>.
                                    </p>
                                    <p className="text-zinc-500 text-xs leading-relaxed font-semibold">
                                        Create this in the Google Cloud Console under: <span className="text-zinc-400">IAM & Admin &gt; Keys &gt; Add Key &gt; JSON</span>.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">JSON Key Content</label>
                                <textarea 
                                    className="w-full h-44 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-blue-400/90 outline-none focus:border-primary transition resize-none custom-scrollbar leading-relaxed"
                                    placeholder='{ "type": "service_account", ... }'
                                    value={jsonKey}
                                    onChange={(e) => setJsonKey(e.target.value)}
                                />
                            </div>

                            <button 
                                onClick={handleServiceAccountSubmit}
                                disabled={isSubmitting}
                                className="w-full h-11 bg-primary text-white text-sm font-medium hover:opacity-90 transition rounded-xl flex items-center justify-center shadow-lg shadow-primary/10 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Syncing...' : 'Establish Nexus Link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
