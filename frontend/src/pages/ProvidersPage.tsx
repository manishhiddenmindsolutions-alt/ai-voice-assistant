import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  ExternalLink,
  Eye,
  EyeOff,
  Activity,
  Cpu,
  Database,
  Search,
  Sparkles,
  Lock,
  X
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

const PROVIDER_METADATA: { 
  [key: string]: { 
    name: string; 
    tag: string; 
    desc: string; 
    placeholder: string; 
    docUrl: string; 
    logo: string;
    filterStyle?: React.CSSProperties;
  } 
} = {
  openai: {
    name: 'OpenAI platform',
    tag: 'LLM & TTS',
    desc: 'Access GPT-4o, GPT-4o Mini, and high-fidelity OpenAI TTS synthesis.',
    placeholder: 'sk-proj-...',
    docUrl: 'https://platform.openai.com/api-keys',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openai.svg',
    filterStyle: { filter: 'invert(49%) sepia(87%) saturate(417%) hue-rotate(113deg) brightness(91%) contrast(87%)' }
  },
  openrouter: {
    name: 'OpenRouter API',
    tag: 'LLM gateway',
    desc: 'Access hundreds of open-weights models via a unified API token.',
    placeholder: 'sk-or-v1-...',
    docUrl: 'https://openrouter.ai/keys',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openrouter.svg',
    filterStyle: { filter: 'invert(24%) sepia(98%) saturate(3015%) hue-rotate(258deg) brightness(95%) contrast(97%)' }
  },
  anthropic: {
    name: 'Anthropic Claude',
    tag: 'LLM',
    desc: 'Powers world-class Claude 3.5 Sonnet, Claude 3 Opus, and Claude 3.5 Haiku.',
    placeholder: 'sk-ant-...',
    docUrl: 'https://console.anthropic.com/',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/anthropic.svg',
    filterStyle: { filter: 'invert(52%) sepia(97%) saturate(1637%) hue-rotate(15deg) brightness(95%) contrast(97%)' }
  },
  groq: {
    name: 'Groq cloud',
    tag: 'LLM & STT',
    desc: 'Powers ultra-low latency LLaMA & Mistral models and Groq Whisper STT.',
    placeholder: 'gsk_...',
    docUrl: 'https://console.groq.com/keys',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/groq.svg',
    filterStyle: { filter: 'invert(61%) sepia(81%) saturate(2227%) hue-rotate(346deg) brightness(101%) contrast(97%)' }
  },
  gemini: {
    name: 'Google Gemini',
    tag: 'LLM',
    desc: 'Ingest Google Gemini 2.5 Pro and Gemini 2.5 Flash models natively.',
    placeholder: 'AIzaSy...',
    docUrl: 'https://aistudio.google.com/',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemini.svg',
    filterStyle: { filter: 'invert(37%) sepia(93%) saturate(1469%) hue-rotate(204deg) brightness(96%) contrast(93%)' }
  },
  deepseek: {
    name: 'DeepSeek AI',
    tag: 'LLM',
    desc: 'Ingest low-cost, high-intelligence DeepSeek Chat (V3) models directly.',
    placeholder: 'sk-...',
    docUrl: 'https://platform.deepseek.com/',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/deepseek.svg',
    filterStyle: { filter: 'invert(44%) sepia(90%) saturate(1243%) hue-rotate(206deg) brightness(100%) contrast(95%)' }
  },
  together_ai: {
    name: 'Together AI',
    tag: 'LLM',
    desc: 'High-speed host for LLaMA, Mixtral, and open-weights developer models.',
    placeholder: 'insert together api key...',
    docUrl: 'https://api.together.xyz/',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/together.svg'
  },
  sarvam: {
    name: 'Sarvam AI',
    tag: 'STT & TTS',
    desc: 'Access low-cost, ultra-premium Indic language speech-to-text and text-to-speech.',
    placeholder: 'insert sarvam api key...',
    docUrl: 'https://www.sarvam.ai/',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/minimax.svg',
    filterStyle: { filter: 'invert(59%) sepia(96%) saturate(1000%) hue-rotate(2deg) brightness(100%) contrast(100%)' }
  },
  deepgram: {
    name: 'Deepgram cloud',
    tag: 'STT & TTS',
    desc: 'Low-latency, hyper-accurate Speech-to-Text and Aura Text-to-Speech voices.',
    placeholder: 'insert deepgram api key...',
    docUrl: 'https://console.deepgram.com/',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/deepgram.svg',
    filterStyle: { filter: 'invert(59%) sepia(74%) saturate(420%) hue-rotate(124deg) brightness(91%) contrast(92%)' }
  },
  elevenlabs: {
    name: 'ElevenLabs voices',
    tag: 'TTS',
    desc: 'Powers dynamic, multi-lingual emotional speech-to-text voices.',
    placeholder: 'insert elevenlabs key...',
    docUrl: 'https://elevenlabs.io/app/settings/api-keys',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/elevenlabs.svg',
    filterStyle: { filter: 'invert(67%) sepia(96%) saturate(1039%) hue-rotate(359deg) brightness(101%) contrast(93%)' }
  },
  cartesia: {
    name: 'Cartesia sonic',
    tag: 'TTS',
    desc: 'Powers extremely low-latency, conversational Cartesia voices.',
    placeholder: 'insert cartesia key...',
    docUrl: 'https://play.cartesia.ai/',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/cohere.svg',
    filterStyle: { filter: 'invert(36%) sepia(97%) saturate(2502%) hue-rotate(314deg) brightness(97%) contrast(95%)' }
  },
  assemblyai: {
    name: 'AssemblyAI',
    tag: 'STT',
    desc: 'Hyper-accurate transcription models for conversational audio analytics.',
    placeholder: 'insert assemblyai key...',
    docUrl: 'https://www.assemblyai.com/',
    logo: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/assemblyai.svg',
    filterStyle: { filter: 'invert(36%) sepia(91%) saturate(1478%) hue-rotate(244deg) brightness(98%) contrast(96%)' }
  }
};

const StatCard = ({
  icon,
  label,
  value,
}: any) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] transition-all duration-300 group cursor-pointer">
    <div className="flex items-center justify-between mb-5">
      <div className="w-11 h-11 rounded-xl bg-zinc-850 flex items-center justify-center text-zinc-300 group-hover:text-primary transition-colors border border-zinc-800">
        {icon}
      </div>
    </div>
    <p className="text-sm text-zinc-500 font-medium">
      {label}
    </p>
    <h3 className="text-2xl font-semibold text-zinc-100 mt-2 tracking-tight group-hover:text-zinc-200 transition-colors">
      {value}
    </h3>
  </div>
);

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
    if (!window.confirm(`Are you sure you want to disconnect ${name.toUpperCase()}? This will also remove all its fetched models.`)) {
      return;
    }
    const toastId = toast.loading(`Disconnecting ${name.toUpperCase()}...`);
    try {
      await api.delete(`/providers/${id}`);
      toast.success(`${name.toUpperCase()} disconnected`, { id: toastId });
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
      toast.error('Please input a valid API key');
      return;
    }

    setVerifying(true);
    setWizardStep(3);
    setVerifyStatus('Establishing secure node connection...');

    try {
      setTimeout(() => setVerifyStatus('Verifying API token...'), 800);
      setTimeout(() => setVerifyStatus('Ingesting model schemas...'), 1600);
      
      await api.post('/providers/', {
        provider: selectedProvider,
        api_key: apiKey.trim()
      });

      setTimeout(() => {
        setVerifying(false);
        setWizardStep(4);
        toast.success(`Connected to ${selectedProvider.toUpperCase()}`);
        fetchConnections();
      }, 2400);

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
      <div className="flex flex-col items-center justify-center min-h-[55vh] space-y-4 animate-in fade-in duration-200">
        <div className="w-7 h-7 rounded-full border-2 border-zinc-800 border-t-primary animate-spin" />
        <span className="text-[11px] font-mono text-zinc-500 tracking-wider">Accessing provider gateway...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">

        <div>
          <button
            onClick={() => navigate('/')}
            className="h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition flex items-center gap-2 mb-5"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Provider Connections
          </h1>

          <p className="text-sm text-zinc-500 mt-2">
            Connect model providers and sync infrastructure APIs.
          </p>
        </div>

        <button
          onClick={startAddFlow}
          className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
        >
          <Plus size={16} />
          Connect Provider
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">

        <StatCard
          icon={<Cpu size={18} />}
          label="Connections"
          value={connections.length}
        />

        <StatCard
          icon={<Database size={18} />}
          label="Models Synced"
          value={connections.reduce(
            (acc, curr) => acc + curr.models_count,
            0
          )}
        />

        <StatCard
          icon={<Activity size={18} />}
          label="Status"
          value="Operational"
        />

        <StatCard
          icon={<Lock size={18} />}
          label="Security"
          value="AES-256"
        />
      </div>

      {/* PROVIDERS */}
      <div>

        <div className="flex items-center justify-between mb-6">

          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              Connected Providers
            </h2>

            <p className="text-sm text-zinc-500 mt-1">
              Active infrastructure and synced model gateways.
            </p>
          </div>
        </div>

        {connections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-16 text-center">

            <div className="w-16 h-16 rounded-2xl bg-zinc-850 flex items-center justify-center mx-auto mb-6 border border-zinc-800 text-zinc-400">
              <Database size={24} />
            </div>

            <h3 className="text-lg font-semibold text-zinc-100">
              No providers connected
            </h3>

            <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto leading-relaxed">
              Connect OpenAI, Groq, OpenRouter and other providers to enable model access.
            </p>

            <button
              onClick={startAddFlow}
              className="mt-6 h-11 px-6 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition"
            >
              Connect Provider
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {connections.map((conn) => {
              const meta = PROVIDER_METADATA[conn.provider] || {
                name: conn.provider.toUpperCase(),
                tag: 'AI Provider',
                desc: 'Connected dynamic portal gateway.',
                logo: '🪐'
              };

              return (
                <div
                  key={conn.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] transition-all duration-300 flex flex-col justify-between group cursor-pointer"
                >

                  {/* TOP */}
                  <div className="flex items-start justify-between mb-6">

                    <div className="flex items-center gap-4">

                      {/* LOGO */}
                      <div className="w-14 h-14 rounded-2xl border border-zinc-800 bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 group-hover:border-zinc-700 transition-all duration-300 relative">

                        {meta.logo.startsWith('http') ? (
                          <img
                            src={meta.logo}
                            alt={meta.name}
                            className="w-7 h-7 object-contain group-hover:rotate-6 transition-transform duration-300 relative z-10"
                            style={meta.filterStyle}
                          />
                        ) : (
                          <span className="text-2xl relative z-10">
                            {meta.logo}
                          </span>
                        )}
                      </div>

                      {/* INFO */}
                      <div>

                        <h3 className="text-lg font-semibold text-zinc-100 group-hover:text-primary transition-colors duration-300">
                          {meta.name}
                        </h3>

                        <div className="flex items-center gap-2 mt-2">

                          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-850 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                            {meta.tag}
                          </span>

                          <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 text-xs font-medium">

                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />

                            Active
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <button
                      onClick={() =>
                        handleDisconnect(
                          conn.id,
                          conn.provider
                        )
                      }
                      className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:border-red-500/20 transition relative z-20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* DESC */}
                  <p className="text-sm text-zinc-400 leading-relaxed min-h-[48px] group-hover:text-zinc-350 transition-colors">
                    {meta.desc}
                  </p>

                  {/* MODELS */}
                  <div className="mt-6 p-4 rounded-xl border border-zinc-850 bg-zinc-950">

                    <div className="flex items-center justify-between">

                      <span className="text-sm text-zinc-500">
                        Synced Models
                      </span>

                      <span className="text-lg font-semibold text-zinc-200">
                        {conn.models_count}
                      </span>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="flex items-center gap-3 mt-6 relative z-20">

                    <button
                      onClick={() =>
                        handleRefreshModels(
                          conn.id,
                          conn.provider
                        )
                      }
                      className="flex-1 h-11 rounded-xl border border-zinc-800 bg-zinc-950 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={15} />
                      Sync Models
                    </button>

                    <a
                      href={meta.docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-11 px-5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition flex items-center justify-center"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD PROVIDER WIZARD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl w-full max-w-md overflow-hidden shadow-2xl relative font-sans">
            
            {/* MODAL HEADER */}
            <div className="p-4 border-b border-zinc-900 flex items-center justify-between relative z-10">
              <div className="space-y-0.5">
                <h3 className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">Connect provider portal</h3>
                <span className="text-[10px] text-zinc-500 font-mono">Establish infrastructure node</span>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-650 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors p-1"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>

            {/* MODAL CONTENT */}
            <div className="p-5 space-y-5 relative z-10">
              
              {/* STEP INDICATOR */}
              <div className="flex items-center justify-between px-1">
                {[1, 2, 3, 4].map(step => (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono border transition-all ${
                      wizardStep === step 
                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/10'
                        : wizardStep > step
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        : 'bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-850 text-zinc-400 dark:text-zinc-600'
                    }`}>
                      {wizardStep > step ? <CheckCircle2 size={10} /> : step}
                    </div>
                    {step < 4 && (
                      <div className={`h-[1px] flex-1 mx-2 transition-all ${
                        wizardStep > step ? 'bg-zinc-800' : 'bg-zinc-900'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* STEP 1: SELECT PROVIDER */}
              {wizardStep === 1 && (
                <div className="space-y-3.5 animate-in fade-in duration-200">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" size={13} />
                    <input 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="input-vapi w-full h-8 pl-8 text-[11px]" 
                      placeholder="Search providers..." 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
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
                          className={`p-3 rounded-lg text-left border hover:border-primary/25 hover:bg-zinc-900/20 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(124,58,237,0.04)] transition-all duration-300 flex items-center justify-between group ${
                            isConnected ? 'border-zinc-900 bg-zinc-950 opacity-80' : 'border-zinc-900 bg-zinc-950/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 group-hover:border-zinc-750 transition-all duration-300">
                              {meta.logo.startsWith('http') ? (
                                <img src={meta.logo} alt={meta.name} className="w-3.5 h-3.5 object-contain group-hover:rotate-6 transition-transform duration-300" style={meta.filterStyle} />
                              ) : (
                                <span className="text-xs">{meta.logo}</span>
                              )}
                            </div>
                            <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[100px] group-hover:text-primary transition-colors duration-300">{meta.name}</span>
                          </div>
                          {isConnected && (
                            <span className="text-[9px] font-mono text-zinc-500 scale-90">active</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: ENTER API KEY */}
              {wizardStep === 2 && selectedProvider && (
                <div className="space-y-4.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                      {PROVIDER_METADATA[selectedProvider].logo.startsWith('http') ? (
                        <img src={PROVIDER_METADATA[selectedProvider].logo} alt={selectedProvider} className="w-4 h-4 object-contain" />
                      ) : (
                        <span className="text-lg">{PROVIDER_METADATA[selectedProvider].logo}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
                        Connect {PROVIDER_METADATA[selectedProvider].name}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        BYOK secure encryption layer
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between pl-0.5">
                      <label className="text-[10px] font-mono text-zinc-500">
                        API TOKEN
                      </label>
                      <a 
                        href={PROVIDER_METADATA[selectedProvider].docUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-zinc-400 hover:text-zinc-200 font-mono flex items-center gap-1"
                      >
                        <span>Get key</span>
                        <ExternalLink size={9} />
                      </a>
                    </div>
                    
                    <div className="relative">
                      <input 
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        disabled={verifying}
                        className="input-vapi w-full h-8 text-[11.5px] pr-9 disabled:opacity-50" 
                        placeholder={PROVIDER_METADATA[selectedProvider].placeholder} 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        disabled={verifying}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 disabled:opacity-30"
                      >
                        {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-2">
                    <button 
                      onClick={() => setWizardStep(1)}
                      disabled={verifying}
                      className="flex-1 btn-outline h-8 text-[11px] disabled:opacity-55"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleConnectProvider}
                      disabled={verifying}
                      className="flex-1 btn-vapi h-8 text-[11px] disabled:opacity-55"
                    >
                      Authenticate
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: TESTING CONNECTION & MODEL FETCH */}
              {wizardStep === 3 && (
                <div className="flex flex-col items-center justify-center py-6 space-y-4 animate-in fade-in duration-200">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-zinc-800 border-t-zinc-400 animate-spin" />
                    <Sparkles className="text-zinc-400 animate-pulse" size={18} />
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="text-[12px] font-semibold text-zinc-300">{verifyStatus}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">securing vault handshake...</p>
                  </div>
                </div>
              )}

              {/* STEP 4: SUCCESS */}
              {wizardStep === 4 && (
                <div className="flex flex-col items-center justify-center py-6 space-y-5 animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 animate-bounce">
                    <CheckCircle2 size={24} />
                  </div>
                  
                  <div className="text-center space-y-1.5">
                    <h4 className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200">Node connection established</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xs mx-auto">
                      API settings saved successfully. Dynamic models are now active inside the assistant creator.
                    </p>
                  </div>

                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="w-full btn-vapi h-8 text-[11px]"
                  >
                    Enter workspace
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
