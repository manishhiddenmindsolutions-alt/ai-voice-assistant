import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  HelpCircle, 
  Key, 
  ExternalLink,
  Eye,
  EyeOff,
  Activity,
  Cpu,
  Database,
  Search,
  Sparkles,
  Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

interface ProviderModel {
  id: string;
  model_id: string;
  name: string;
  context_window: number;
  capabilities: any;
}

interface ProviderConnection {
  id: string;
  provider: string;
  status: string;
  created_at: string;
  models_count: number;
  models: ProviderModel[];
}

const PROVIDER_METADATA: { [key: string]: { name: string; tag: string; desc: string; placeholder: string; docUrl: string; logo: string } } = {
  openai: {
    name: 'OpenAI Platform',
    tag: 'LLM & TTS',
    desc: 'Access GPT-4o, GPT-4o Mini, and high-fidelity OpenAI TTS synthesis.',
    placeholder: 'sk-proj-...',
    docUrl: 'https://platform.openai.com/api-keys',
    logo: '🟢'
  },
  openrouter: {
    name: 'OpenRouter API',
    tag: 'LLM Multi-Provider',
    desc: 'Access hundreds of LLMs (Claude, LLaMA, DeepSeek) via a unified gateway.',
    placeholder: 'sk-or-v1-...',
    docUrl: 'https://openrouter.ai/keys',
    logo: '⚡'
  },
  anthropic: {
    name: 'Anthropic Claude',
    tag: 'LLM',
    desc: 'Powers world-class Claude 3.5 Sonnet, Claude 3 Opus, and Claude 3.5 Haiku.',
    placeholder: 'sk-ant-...',
    docUrl: 'https://console.anthropic.com/',
    logo: '🧡'
  },
  groq: {
    name: 'Groq Cloud',
    tag: 'LLM & STT',
    desc: 'Powers ultra-low latency LLaMA & Mistral models and Groq Whisper STT.',
    placeholder: 'gsk_...',
    docUrl: 'https://console.groq.com/keys',
    logo: '🍊'
  },
  gemini: {
    name: 'Google Gemini',
    tag: 'LLM',
    desc: 'Ingest Google Gemini 2.5 Pro and Gemini 2.5 Flash models natively.',
    placeholder: 'AIzaSy...',
    docUrl: 'https://aistudio.google.com/',
    logo: '🔵'
  },
  deepseek: {
    name: 'DeepSeek AI',
    tag: 'LLM',
    desc: 'Ingest low-cost, high-intelligence DeepSeek Chat (V3) models directly.',
    placeholder: 'sk-...',
    docUrl: 'https://platform.deepseek.com/',
    logo: '🐳'
  },
  together_ai: {
    name: 'Together AI',
    tag: 'LLM',
    desc: 'High-speed host for LLaMA, Mixtral, and open-weights developer models.',
    placeholder: 'insert together api key...',
    docUrl: 'https://api.together.xyz/',
    logo: '🌀'
  },
  elevenlabs: {
    name: 'ElevenLabs Voices',
    tag: 'TTS',
    desc: 'Powers dynamic, multi-lingual emotional speech-to-text voices.',
    placeholder: 'insert elevenlabs key...',
    docUrl: 'https://elevenlabs.io/app/settings/api-keys',
    logo: '🗣'
  },
  cartesia: {
    name: 'Cartesia Sonic',
    tag: 'TTS',
    desc: 'Powers extremely low-latency, conversational Cartesia voices.',
    placeholder: 'insert cartesia key...',
    docUrl: 'https://play.cartesia.ai/',
    logo: '🪐'
  },
  assemblyai: {
    name: 'AssemblyAI',
    tag: 'STT',
    desc: 'Hyper-accurate transcription models for conversational audio analytics.',
    placeholder: 'insert assemblyai key...',
    docUrl: 'https://www.assemblyai.com/',
    logo: '🎙'
  }
};

const ProvidersPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Wizard State
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const resp = await api.get('/providers/');
      setConnections(resp.data || []);
    } catch (err) {
      toast.error('Failed to sync provider connections.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to disconnect ${name.toUpperCase()}? This will also remove all its fetched models from the Agent Builder.`)) {
      return;
    }
    const toastId = toast.loading(`Disconnecting ${name.toUpperCase()}...`);
    try {
      await api.delete(`/providers/${id}`);
      toast.success(`${name.toUpperCase()} disconnected.`, { id: toastId });
      fetchConnections();
    } catch (err) {
      toast.error('Failed to disconnect provider', { id: toastId });
    }
  };

  const handleRefreshModels = async (id: string, name: string) => {
    const toastId = toast.loading(`Re-indexing ${name.toUpperCase()} models...`);
    try {
      const resp = await api.post(`/providers/${id}/refresh`);
      toast.success(resp.data.message || `Successfully synced models.`, { id: toastId });
      fetchConnections();
    } catch (err) {
      toast.error('Failed to refresh models.', { id: toastId });
    }
  };

  const startAddFlow = () => {
    setSelectedProvider('');
    setApiKey('');
    setWizardStep(1);
    setShowAddModal(true);
  };

  const handleConnectProvider = async () => {
    if (!selectedProvider) return;
    if (!apiKey.trim()) {
      toast.error('Please input a valid API Key');
      return;
    }

    setVerifying(true);
    setWizardStep(3);
    setVerifyStatus('Piping secure socket to endpoint...');

    try {
      setTimeout(() => setVerifyStatus('Verifying active token credentials...'), 1000);
      setTimeout(() => setVerifyStatus('Dynamic model ingestion initiated...'), 2000);
      
      const resp = await api.post('/providers/', {
        provider: selectedProvider,
        api_key: apiKey.trim()
      });

      setTimeout(() => {
        setVerifying(false);
        setWizardStep(4);
        toast.success(`Successfully connected to ${selectedProvider.toUpperCase()}!`);
        fetchConnections();
      }, 3000);

    } catch (err: any) {
      setVerifying(false);
      setWizardStep(2);
      const errMsg = err.response?.data?.detail || 'Verification failed. Please check key validity.';
      toast.error(errMsg);
    }
  };

  const filteredProviders = Object.keys(PROVIDER_METADATA).filter(key => 
    PROVIDER_METADATA[key].name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    PROVIDER_METADATA[key].tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Accessing Neural Registry...</span>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="btn-back-premium">
            <ArrowLeft size={14} />
            <span>Overview</span>
          </button>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-heading font-black text-white uppercase tracking-wider leading-tight">Provider Connections</h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.2em] leading-none">AI Operating System Provider Registry</p>
            </div>
          </div>
        </div>
        
        <button onClick={startAddFlow} className="btn-vapi h-10 px-5 text-[10px] tracking-[0.1em] font-extrabold uppercase ml-auto md:ml-0">
          <Plus size={14} />
          <span>Connect Provider</span>
        </button>
      </div>

      {/* SUMMARY STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Cpu size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest leading-none">Connections</p>
            <p className="text-lg font-black text-white mt-1 leading-none">{connections.length}</p>
          </div>
        </div>
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
            <Database size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest leading-none">Fetched Models</p>
            <p className="text-lg font-black text-white mt-1 leading-none">
              {connections.reduce((acc, curr) => acc + curr.models_count, 0)}
            </p>
          </div>
        </div>
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
            <Activity size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest leading-none">Status</p>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1.5 leading-none flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sync Active
            </p>
          </div>
        </div>
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
            <Lock size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest leading-none">Security</p>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1.5 leading-none">
              AES-256 Vault
            </p>
          </div>
        </div>
      </div>

      {/* CONNECTED LIST */}
      <div className="space-y-6">
        <h2 className="text-xs font-black text-white uppercase tracking-[0.25em] pl-1">Connected Infrastructure</h2>
        
        {connections.length === 0 ? (
          <div className="p-12 bg-zinc-900/20 border border-dashed border-white/5 rounded-3xl text-center space-y-4">
            <p className="text-zinc-600 text-[11px] font-bold uppercase tracking-wider leading-relaxed">No connected infrastructure endpoints found.</p>
            <button onClick={startAddFlow} className="btn-outline h-9 px-4 text-[9px] uppercase tracking-widest">
              Connect Your First Provider
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {connections.map((conn) => {
              const meta = PROVIDER_METADATA[conn.provider] || {
                name: conn.provider.toUpperCase(),
                tag: 'AI Platform',
                desc: 'Connected dynamic interface.',
                logo: '🪐'
              };
              
              return (
                <div key={conn.id} className="p-6 bg-zinc-900/40 border border-white/5 rounded-3xl flex flex-col justify-between hover:border-primary/20 transition-all glow-card-primary group">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-xl border border-white/5">
                          {meta.logo}
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-wide leading-none">{meta.name}</h3>
                          <span className="inline-block text-[8px] font-black bg-zinc-800 px-2.5 py-1 rounded-lg text-zinc-400 uppercase mt-2 tracking-widest">
                            {meta.tag}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">CONNECTED</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-500 font-medium leading-relaxed italic opacity-85">"{meta.desc}"</p>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Database size={12} className="text-primary" />
                        <span>Models Fetched:</span>
                        <strong className="text-white ml-0.5">{conn.models_count}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/5">
                    <button 
                      onClick={() => handleRefreshModels(conn.id, conn.provider)}
                      className="flex-1 btn-outline !h-9 text-[9px] gap-2"
                    >
                      <RefreshCw size={12} />
                      <span>Sync Models</span>
                    </button>
                    <button 
                      onClick={() => handleDisconnect(conn.id, conn.provider)}
                      className="btn-outline !h-9 !w-9 !p-0 !border-red-500/20 hover:!bg-red-500/10 text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD PROVIDER WIZARD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl relative">
            
            {/* Background Mesh */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 bg-neural-mesh" />

            {/* MODAL HEADER */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white uppercase tracking-wider leading-none">Connect Provider Portal</h3>
                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Establish Infrastructure Node</span>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
              >
                Close
              </button>
            </div>

            {/* MODAL CONTENT */}
            <div className="p-8 space-y-6 relative z-10">
              
              {/* STEP INDICATOR */}
              <div className="flex items-center justify-between px-2">
                {[1, 2, 3, 4].map(step => (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${
                      wizardStep === step 
                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-110'
                        : wizardStep > step
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-zinc-900 border-white/5 text-zinc-600'
                    }`}>
                      {wizardStep > step ? <CheckCircle2 size={12} /> : step}
                    </div>
                    {step < 4 && (
                      <div className={`h-[1px] flex-1 mx-2 transition-all ${
                        wizardStep > step ? 'bg-emerald-500/20' : 'bg-zinc-800'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* STEP 1: SELECT PROVIDER */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 text-zinc-600" size={14} />
                    <input 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="input-vapi w-full h-11 pl-10 text-[10px] font-bold uppercase tracking-wide" 
                      placeholder="Search providers..." 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {filteredProviders.map(key => {
                      const meta = PROVIDER_METADATA[key];
                      const isConnected = connections.some(c => c.provider === key);
                      
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setSelectedProvider(key);
                            setWizardStep(2);
                          }}
                          className={`p-4 rounded-2xl text-left border hover:border-primary/40 hover:bg-zinc-900/40 transition-all flex items-center justify-between ${
                            isConnected ? 'border-emerald-500/10 bg-emerald-500/5 opacity-80' : 'border-white/5 bg-zinc-900/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{meta.logo}</span>
                            <span className="text-[10px] font-extrabold text-white uppercase tracking-wider">{meta.name}</span>
                          </div>
                          {isConnected && (
                            <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider scale-90">Active</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: ENTER API KEY */}
              {wizardStep === 2 && selectedProvider && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{PROVIDER_METADATA[selectedProvider].logo}</div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wide leading-none">
                        Connect {PROVIDER_METADATA[selectedProvider].name}
                      </h4>
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-1.5">
                        BYOK Secure Encryption Layer
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between pl-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                        API TOKEN
                      </label>
                      <a 
                        href={PROVIDER_METADATA[selectedProvider].docUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[9px] text-primary hover:underline font-black uppercase tracking-wider flex items-center gap-1"
                      >
                        <span>Grab Key</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    
                    <div className="relative">
                      <input 
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        className="input-vapi w-full h-11 text-[11px] font-semibold pr-10" 
                        placeholder={PROVIDER_METADATA[selectedProvider].placeholder} 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-white"
                      >
                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button 
                      onClick={() => setWizardStep(1)}
                      className="flex-1 btn-outline h-10 text-[9px] uppercase tracking-widest"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleConnectProvider}
                      className="flex-1 btn-vapi h-10 text-[9px] uppercase tracking-widest"
                    >
                      Authenticate Node
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: TESTING CONNECTION & MODEL FETCH */}
              {wizardStep === 3 && (
                <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-in fade-in duration-300">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-primary/20 border-t-primary animate-spin" />
                    <Sparkles className="text-primary animate-pulse" size={24} />
                  </div>
                  
                  <div className="text-center space-y-1.5">
                    <p className="text-xs font-black text-white uppercase tracking-wider">{verifyStatus}</p>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Dynamically loading metadata schemas...</p>
                  </div>
                </div>
              )}

              {/* STEP 4: SUCCESS */}
              {wizardStep === 4 && (
                <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-in fade-in duration-300">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/5 animate-bounce">
                    <CheckCircle2 size={32} />
                  </div>
                  
                  <div className="text-center space-y-2">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">Node Connection Established!</h4>
                    <p className="text-[9px] text-zinc-500 font-medium leading-relaxed max-w-sm mx-auto">
                      All security settings configured successfully. Dynamic models have been parsed and loaded into your Agent builder workspace.
                    </p>
                  </div>

                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="w-full btn-vapi h-10 text-[9px] uppercase tracking-widest"
                  >
                    Enter Workspace
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProvidersPage;
