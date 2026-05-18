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
            border: 'border-blue-500/20'
        },
        {
            id: 'microsoft',
            name: 'Microsoft 365',
            description: 'Outlook & Excel tasks.',
            icon: Layout,
            color: 'text-orange-500',
            bg: 'bg-orange-500/5',
            border: 'border-orange-500/20'
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
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4 md:gap-5">
                    <button onClick={() => navigate('/')} className="btn-back-premium">
                        <ArrowLeft size={14} />
                        <span>Overview</span>
                    </button>
                    <div className="space-y-1">
                        <h1 className="text-xl md:text-2xl font-heading font-black text-white uppercase tracking-wider leading-tight">Neural Nexus</h1>
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                            <p className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.2em] leading-none">Service Authorization Mesh</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center justify-center md:justify-end gap-3 px-4 py-2 bg-zinc-950 border border-zinc-900 rounded-xl w-full md:w-auto">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <p className="text-[9px] font-black text-white uppercase tracking-widest leading-none">Vault Secured</p>
                </div>
            </div>

            {/* INTEGRATION GRID */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 rounded-2xl bg-zinc-950/40 border border-zinc-900/50 animate-pulse flex flex-col p-5 gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800" />
                            <div className="space-y-2">
                                <div className="h-3 w-24 bg-zinc-900 rounded" />
                                <div className="h-2 w-full bg-zinc-900/50 rounded" />
                                <div className="h-2 w-2/3 bg-zinc-900/50 rounded" />
                            </div>
                            <div className="mt-auto h-10 w-full bg-zinc-900 rounded-lg" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {integrationsMetadata.map((int) => {
                        const status = getStatus(int.id);
                        return (
                            <div 
                                key={int.id}
                                className="group relative p-5 rounded-2xl bg-zinc-950/40 border border-zinc-900 hover:border-zinc-700 transition-all duration-300 overflow-hidden glow-card-primary"
                            >
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-10 h-10 rounded-xl ${int.bg} ${int.border} border flex items-center justify-center group-hover:scale-110 transition-transform duration-500`}>
                                            <int.icon size={20} className={int.color} />
                                        </div>
                                        <div className={`flex items-center gap-1.5 text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${status ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                                            {status && <CheckCircle2 size={8} />}
                                            {status ? (status.integration_type === 'SERVICE_ACCOUNT' ? 'Service Active' : 'OAuth Active') : 'Offline'}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 mb-6">
                                        <h3 className="text-xs font-heading font-black text-white uppercase tracking-wide">{int.name}</h3>
                                        <p className="text-[10px] text-zinc-600 leading-relaxed font-medium">
                                            {int.description}
                                        </p>
                                    </div>

                                    {status ? (
                                        <button 
                                            onClick={() => handleDisconnect(status.id)}
                                            className="w-full flex items-center justify-between px-3 h-10 bg-red-500/5 hover:bg-red-500 border border-red-500/10 hover:border-red-500 rounded-lg transition-all duration-300 group/btn"
                                        >
                                            <span className="text-[9px] font-bold text-red-500 group-hover:text-white uppercase tracking-widest">Disconnect</span>
                                            <Trash2 size={14} className="text-red-500 group-hover:text-white transition-all" />
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <button 
                                                onClick={() => handleConnect(int.id)}
                                                className="w-full flex items-center justify-between px-3 h-10 bg-zinc-900 hover:bg-primary border border-zinc-800 hover:border-primary rounded-lg transition-all duration-300 group/btn"
                                            >
                                                <span className="text-[9px] font-black text-zinc-400 group-hover/btn:text-white uppercase tracking-widest">OAuth Login</span>
                                                <ArrowRight size={14} className="text-zinc-600 group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-all" />
                                            </button>
                                            <button 
                                                onClick={() => { if (int.id === 'google') setShowKeyModal(true); else toast('Microsoft JSON keys supported soon', { icon: '🛡️' }); }}
                                                className="w-full flex items-center justify-between px-3 h-10 bg-zinc-950 border border-zinc-900 hover:border-zinc-700 rounded-lg transition-all duration-300 group/btn"
                                            >
                                                <span className="text-[9px] font-black text-zinc-600 group-hover/btn:text-white uppercase tracking-widest">JSON Key (Easy)</span>
                                                <FileJson size={14} className="text-zinc-800 group-hover/btn:text-white transition-all" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Automation Tip - Mini */}
                    <div className="lg:col-span-3 p-5 bg-primary/5 border border-dashed border-primary/10 rounded-2xl flex flex-col md:flex-row items-center gap-5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Zap size={20} className="text-primary" />
                        </div>
                        <div className="flex-1 space-y-1 text-center md:text-left">
                            <h4 className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Neural Efficiency Tip</h4>
                            <p className="text-[10px] text-zinc-600 leading-relaxed font-medium">
                                The <span className="text-primary font-black">JSON Key Method</span> is the fastest way to get your agent scheduling and logging without setting up OAuth redirect URIs.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SERVICE ACCOUNT MODAL */}
            {showKeyModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
                    <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-2xl p-8 shadow-2xl relative">
                        <button onClick={() => setShowKeyModal(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <FileJson className="text-blue-500" size={20} />
                            </div>
                            <div>
                                <h2 className="text-sm font-heading font-black text-white uppercase tracking-widest leading-none">Easy JSON Integration</h2>
                                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Direct Neural Access Flow</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-3">
                                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <p className="text-[9px] text-zinc-400 leading-relaxed font-medium uppercase tracking-wider">
                                        Paste the entire content of your <span className="text-blue-400 font-black">Service Account JSON key</span> file. 
                                    </p>
                                    <p className="text-[8px] text-zinc-600 leading-relaxed font-bold uppercase tracking-widest">
                                        Find this in: <span className="text-zinc-400">IAM & Admin &gt; Service Accounts &gt; Keys &gt; Add Key &gt; JSON</span>.
                                        <br/>
                                        <span className="text-amber-500/80">⚠️ Avoid using the OAuth Client Secret JSON.</span>
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-zinc-700 uppercase tracking-widest ml-1">JSON Key Content</label>
                                <textarea 
                                    className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-[9px] text-blue-400 focus:border-primary transition-all resize-none custom-scrollbar outline-none"
                                    placeholder='{ "type": "service_account", ... }'
                                    value={jsonKey}
                                    onChange={(e) => setJsonKey(e.target.value)}
                                />
                            </div>

                            <button 
                                onClick={handleServiceAccountSubmit}
                                disabled={isSubmitting}
                                className="w-full h-12 bg-primary hover:bg-primary/90 text-[10px] font-black text-white uppercase tracking-[0.2em] rounded-xl transition-all shadow-[0_0_20px_rgba(0,102,255,0.2)] disabled:opacity-50"
                            >
                                {isSubmitting ? 'Syncing Neural Link...' : 'Establish Direct Link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
