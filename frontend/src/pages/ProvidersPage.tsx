import React, { useState, useEffect } from 'react';
import { 
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
import api from '../services/api';
import toast from 'react-hot-toast';
import { BackButton } from '../components/BackButton';

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

import {
  SiOpenrouter,
  SiAnthropic,
  SiDeepgram,
  SiElevenlabs,
} from "@icons-pack/react-simple-icons";

const OpenAILogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.7 10.7a4.9 4.9 0 0 0-.4-2.4 5 5 0 0 0-2.4-2.4c-.2-.1-.5-.2-.8-.2a4.9 4.9 0 0 0-4-1.9 5 5 0 0 0-4.3 2.5h-.2c-.3 0-.6 0-.8.1a4.9 4.9 0 0 0-3.3 3.3c-.1.3-.1.6-.1.8A4.9 4.9 0 0 0 3 14.5a5 5 0 0 0 2.4 2.4c.2.1.5.2.8.2a4.9 4.9 0 0 0 4 1.9 5 5 0 0 0 4.3-2.5h.2c.3 0 .6 0 .8-.1a4.9 4.9 0 0 0 3.3-3.3c.1-.3.1-.6.1-.8a4.9 4.9 0 0 0 2.8-4.6zm-1.8 0c0 .4-.1.8-.3 1.2l-4.5-2.6c0-.1.1-.3.1-.4v-5.2a3.1 3.1 0 0 1 2.3 2.1c.4 1.1.4 2.2.4 4.9zm-7.6-6.2a3.1 3.1 0 0 1 2.2 0L19 7.1c0 .1 0 .2.1.4H8.7l4.4-2.6v.4-.4zM5.5 8.3a3.1 3.1 0 0 1 2.3-2.1v5.2c0 .1.1.3.1.4l-4.5 2.6c-.2-.4-.3-.8-.3-1.2 0-2.7 0-3.8 2.4-4.9zm-.9 6.2c0-.4.1-.8.3-1.2l4.5 2.6c0 .1-.1.3-.1.4v5.2a3.1 3.1 0 0 1-2.3-2.1c-.4-1.1-.4-2.2-.4-4.9zm7.6 6.2a3.1 3.1 0 0 1-2.2 0L5 18.1c0-.1 0-.2-.1-.4h10.4l-4.4 2.6-.1-.1zM18.5 17a3.1 3.1 0 0 1-2.3 2.1v-5.2c0-.1-.1-.3-.1-.4l4.5-2.6c.2.4.3.8.3 1.2 0 2.7 0 3.8-2.4 4.9zm-4.3-2.6l-2.2-1.3-2.2 1.3V11.8l2.2-1.3 2.2 1.3v2.6z" fill="#10a37f"/>
  </svg>
);

const OpenRouterLogo = () => (
  <SiOpenrouter color="default" size={20} className="shrink-0" />
);

const AnthropicLogo = () => (
  <SiAnthropic color="default" size={20} className="shrink-0" />
);

const GroqLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 10.9 21.1 10 20 10H12V14H18C17.5 16.3 15.4 18 12 18C8.7 18 6 15.3 6 12C6 8.7 8.7 6 12 6C14.3 6 16.3 7.3 17.3 9.3L20.9 7.7C19.2 4.3 15.9 2 12 2Z" fill="#F97316" />
  </svg>
);

const GeminiLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C12 2 12.5 7.5 15.5 10.5C18.5 13.5 24 14 24 14C24 14 18.5 14.5 15.5 17.5C12.5 20.5 12 26 12 26C12 26 11.5 20.5 8.5 17.5C5.5 14.5 0 14 0 14C0 14 5.5 13.5 8.5 10.5C11.5 7.5 12 2 12 2Z" fill="url(#geminiGrad)" />
    <circle cx="18.5" cy="5.5" r="1.5" fill="#9CC3E6" />
    <defs>
      <linearGradient id="geminiGrad" x1="0" y1="14" x2="24" y2="14" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1A73E8" />
        <stop offset="50%" stopColor="#7B1FA2" />
        <stop offset="100%" stopColor="#E040FB" />
      </linearGradient>
    </defs>
  </svg>
);

const DeepSeekLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#0D6EFD" />
    <path d="M7.5 12.5C7.5 10 9.5 8 12 8C14.5 8 16.5 10 16.5 12.5C16.5 15 14.5 17 12 17H7.5V12.5Z" fill="white" />
    <path d="M10 12.5C10 11.4 10.9 10.5 12 10.5C13.1 10.5 14 11.4 14 12.5C14 13.6 13.1 14.5 12 14.5H10V12.5Z" fill="#0D6EFD" />
  </svg>
);

const TogetherLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17Z" fill="url(#togetherGrad)" />
    <defs>
      <linearGradient id="togetherGrad" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#EC4899" />
        <stop offset="50%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
  </svg>
);

const SarvamLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="10" width="2" height="4" rx="1" fill="#F97316"/>
    <rect x="8" y="7" width="2" height="10" rx="1" fill="#F97316"/>
    <rect x="12" y="4" width="2" height="16" rx="1" fill="#EF4444"/>
    <rect x="16" y="7" width="2" height="10" rx="1" fill="#F97316"/>
    <rect x="20" y="10" width="2" height="4" rx="1" fill="#F97316"/>
  </svg>
);

const DeepgramLogo = () => (
  <SiDeepgram color="default" size={20} className="shrink-0" />
);

const ElevenLabsLogo = () => (
  <SiElevenlabs color="default" size={20} className="shrink-0" />
);

const CartesiaLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="url(#cartesiaGrad)" strokeWidth="2.5" strokeDasharray="4 4" />
    <circle cx="12" cy="12" r="6" stroke="url(#cartesiaGrad)" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" fill="#EC4899" />
    <circle cx="12" cy="4" r="1.5" fill="#3B82F6" />
    <circle cx="20" cy="12" r="1.5" fill="#10B981" />
    <circle cx="12" cy="20" r="1.5" fill="#F59E0B" />
    <defs>
      <linearGradient id="cartesiaGrad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B82F6"/>
        <stop offset="0.5" stopColor="#EC4899"/>
        <stop offset="1" stopColor="#F59E0B"/>
      </linearGradient>
    </defs>
  </svg>
);

const AssemblyAILogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="10" width="3.5" height="4" rx="1.75" fill="#F59E0B" />
    <rect x="8.5" y="6" width="3.5" height="12" rx="1.75" fill="#6366F1" />
    <rect x="14" y="3" width="3.5" height="18" rx="1.75" fill="#F59E0B" />
    <rect x="19.5" y="8" width="3.5" height="8" rx="1.75" fill="#6366F1" />
  </svg>
);

const PROVIDER_METADATA: { 
  [key: string]: { 
    name: string; 
    tag: string; 
    desc: string; 
    placeholder: string; 
    docUrl: string; 
    logo: React.ComponentType;
  } 
} = {
  openai: {
    name: 'OpenAI platform',
    tag: 'LLM & TTS',
    desc: 'Access GPT-4o, GPT-4o Mini, and high-fidelity OpenAI TTS synthesis.',
    placeholder: 'sk-proj-...',
    docUrl: 'https://platform.openai.com/api-keys',
    logo: OpenAILogo,
  },
  openrouter: {
    name: 'OpenRouter API',
    tag: 'LLM gateway',
    desc: 'Access hundreds of open-weights models via a unified API token.',
    placeholder: 'sk-or-v1-...',
    docUrl: 'https://openrouter.ai/keys',
    logo: OpenRouterLogo,
  },
  anthropic: {
    name: 'Anthropic Claude',
    tag: 'LLM',
    desc: 'Powers world-class Claude 3.5 Sonnet, Claude 3 Opus, and Claude 3.5 Haiku.',
    placeholder: 'sk-ant-...',
    docUrl: 'https://console.anthropic.com/',
    logo: AnthropicLogo,
  },
  groq: {
    name: 'Groq cloud',
    tag: 'LLM & STT',
    desc: 'Powers ultra-low latency LLaMA & Mistral models and Groq Whisper STT.',
    placeholder: 'gsk_...',
    docUrl: 'https://console.groq.com/keys',
    logo: GroqLogo,
  },
  gemini: {
    name: 'Google Gemini',
    tag: 'LLM',
    desc: 'Ingest Google Gemini 2.5 Pro and Gemini 2.5 Flash models natively.',
    placeholder: 'AIzaSy...',
    docUrl: 'https://aistudio.google.com/',
    logo: GeminiLogo,
  },
  deepseek: {
    name: 'DeepSeek AI',
    tag: 'LLM',
    desc: 'Ingest low-cost, high-intelligence DeepSeek Chat (V3) models directly.',
    placeholder: 'sk-...',
    docUrl: 'https://platform.deepseek.com/',
    logo: DeepSeekLogo,
  },
  together_ai: {
    name: 'Together AI',
    tag: 'LLM',
    desc: 'High-speed host for LLaMA, Mixtral, and open-weights developer models.',
    placeholder: 'insert together api key...',
    docUrl: 'https://api.together.xyz/',
    logo: TogetherLogo,
  },
  sarvam: {
    name: 'Sarvam AI',
    tag: 'STT & TTS',
    desc: 'Access low-cost, ultra-premium Indic language speech-to-text and text-to-speech.',
    placeholder: 'insert sarvam api key...',
    docUrl: 'https://www.sarvam.ai/',
    logo: SarvamLogo,
  },
  deepgram: {
    name: 'Deepgram cloud',
    tag: 'STT & TTS',
    desc: 'Low-latency, hyper-accurate Speech-to-Text and Aura Text-to-Speech voices.',
    placeholder: 'insert deepgram api key...',
    docUrl: 'https://console.deepgram.com/',
    logo: DeepgramLogo,
  },
  elevenlabs: {
    name: 'ElevenLabs voices',
    tag: 'TTS',
    desc: 'Powers dynamic, multi-lingual emotional speech-to-text voices.',
    placeholder: 'insert elevenlabs key...',
    docUrl: 'https://elevenlabs.io/app/settings/api-keys',
    logo: ElevenLabsLogo,
  },
  cartesia: {
    name: 'Cartesia sonic',
    tag: 'TTS',
    desc: 'Powers extremely low-latency, conversational Cartesia voices.',
    placeholder: 'insert cartesia key...',
    docUrl: 'https://play.cartesia.ai/',
    logo: CartesiaLogo,
  },
  assemblyai: {
    name: 'AssemblyAI',
    tag: 'STT',
    desc: 'Hyper-accurate transcription models for conversational audio analytics.',
    placeholder: 'insert assemblyai key...',
    docUrl: 'https://www.assemblyai.com/',
    logo: AssemblyAILogo,
  }
};

const StatCard = ({
  icon,
  label,
  value,
}: any) => (
  <div className="card p-5 group cursor-pointer hover:border-[var(--border-hover)] transition-all duration-200">
    <div className="flex items-center justify-between mb-4">
      <div className="w-10 h-10 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors">
        {icon}
      </div>
    </div>
    <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">
      {label}
    </p>
    <h3 className="text-xl font-bold text-[var(--text-primary)] mt-2 tracking-tight group-hover:text-[var(--primary)] transition-colors">
      {value}
    </h3>
  </div>
);

const ProvidersPage: React.FC = () => {
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
        <div className="w-6 h-6 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
        <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">Accessing provider gateway...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-12 animate-in fade-in duration-500 font-sans text-[var(--text-primary)]">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
        <div>
          <div className="mb-4">
            <BackButton fallbackPath="/" label="Back" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Provider Connections
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]"></span>
            </span>
            <p className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">Connect model providers and sync infrastructure APIs</p>
          </div>
        </div>

        <button
          onClick={startAddFlow}
          className="btn-primary flex items-center gap-2 self-start lg:self-auto shadow-sm"
        >
          <Plus size={15} />
          Connect Provider
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard
          icon={<Cpu size={16} />}
          label="Connections"
          value={connections.length}
        />
        <StatCard
          icon={<Database size={16} />}
          label="Models Synced"
          value={connections.reduce(
            (acc, curr) => acc + curr.models_count,
            0
          )}
        />
        <StatCard
          icon={<Activity size={16} />}
          label="Status"
          value="Operational"
        />
        <StatCard
          icon={<Lock size={16} />}
          label="Security"
          value="AES-256"
        />
      </div>

      {/* PROVIDERS */}
      <div>
        <div className="mb-6 border-b border-[var(--border)] pb-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Connected Gateways
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
            Active developer endpoints and synced model packages.
          </p>
        </div>

        {connections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/30 p-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4 text-[var(--text-muted)] shadow-sm">
              <Database size={20} />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              No providers connected
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-2 max-w-xs mx-auto leading-relaxed font-semibold">
              Connect OpenAI, Groq, OpenRouter or other platforms to enable voice agent LLMs.
            </p>
            <button
              onClick={startAddFlow}
              className="mt-5 btn-primary shadow-sm"
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
                  className="card flex flex-col justify-between min-h-[240px] relative overflow-hidden group cursor-default"
                >
                  {/* TOP */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      {/* LOGO */}
                      <div className="w-12 h-12 rounded-xl border border-[var(--border)] bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative p-1.5">
                        <meta.logo />
                      </div>

                      {/* INFO */}
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
                          {meta.name}
                        </h3>

                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-muted)] text-[8px] font-extrabold uppercase tracking-widest leading-none">
                            {meta.tag}
                          </span>

                          <div className="flex items-center gap-1 text-[var(--success)] text-[10px] font-bold uppercase tracking-wider">
                            <div className="w-1 h-1 rounded-full bg-[var(--success)] animate-pulse" />
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
                      className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-red-500/20 transition-all duration-200 active:scale-95"
                      title="Decommission Link"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* DESC */}
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-semibold min-h-[36px]">
                    {meta.desc}
                  </p>

                  {/* MODELS */}
                  <div className="mt-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                        Synced Active Models
                      </span>
                      <span className="text-sm font-extrabold text-[var(--text-primary)]">
                        {conn.models_count}
                      </span>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="flex items-center gap-2.5 mt-4 relative z-20">
                    <button
                      onClick={() =>
                        handleRefreshModels(
                          conn.id,
                          conn.provider
                        )
                      }
                      className="flex-1 btn-outline h-10 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw size={13} />
                      Sync Models
                    </button>

                    <a
                      href={meta.docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition flex items-center justify-center"
                      title="View Documentation"
                    >
                      <ExternalLink size={13} />
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-[400px] overflow-hidden shadow-xl relative font-sans animate-in zoom-in-95 duration-200">
            
            {/* MODAL HEADER */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between relative z-10">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Connect Provider Portal</h3>
                <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Establish infrastructure node</span>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 hover:bg-[var(--surface-secondary)] rounded-lg transition-all"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* MODAL CONTENT */}
            <div className="p-6 space-y-4 relative z-10">
              
              {/* STEP INDICATOR */}
              <div className="flex items-center justify-between px-1">
                {[1, 2, 3, 4].map(step => (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono border transition-all ${
                      wizardStep === step 
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                        : wizardStep > step
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-[var(--success)]'
                        : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-muted)]'
                    }`}>
                      {wizardStep > step ? <CheckCircle2 size={11} className="text-[var(--success)]" /> : step}
                    </div>
                    {step < 4 && (
                      <div className={`h-[1px] flex-1 mx-2 transition-all ${
                        wizardStep > step ? 'bg-[var(--success)]' : 'bg-[var(--border)]'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* STEP 1: SELECT PROVIDER */}
              {wizardStep === 1 && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={13} />
                    <input 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="input-field pl-9 text-xs" 
                      placeholder="Search providers..." 
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
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
                          className={`p-2.5 rounded-xl text-left border flex items-center justify-between group transition-all duration-200 ${
                            isConnected 
                              ? 'border-[var(--border)] bg-[var(--surface-secondary)]/50 opacity-70' 
                              : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--surface-secondary)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-all duration-200 p-0.5 text-center flex-col">
                              <meta.logo />
                            </div>
                            <span className="text-[10px] font-bold text-[var(--text-primary)] truncate max-w-[80px] uppercase tracking-wider">{meta.name.replace(' platform','').replace(' API','').replace(' cloud','').replace(' AI','').replace(' voices','')}</span>
                          </div>
                          {isConnected && (
                            <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest shrink-0">linked</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: ENTER API KEY */}
              {wizardStep === 2 && selectedProvider && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0 p-1">
                      {React.createElement(PROVIDER_METADATA[selectedProvider].logo)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider leading-none">
                        Connect {PROVIDER_METADATA[selectedProvider].name}
                      </h4>
                      <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">
                        BYOK secure encryption layer
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between pl-0.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        API TOKEN
                      </label>
                      <a 
                        href={PROVIDER_METADATA[selectedProvider].docUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[9px] text-[var(--primary)] hover:underline font-bold uppercase tracking-wider flex items-center gap-1"
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
                        className="input-field font-mono pr-9" 
                        placeholder={PROVIDER_METADATA[selectedProvider].placeholder} 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        disabled={verifying}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      >
                        {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button 
                      onClick={() => setWizardStep(1)}
                      disabled={verifying}
                      className="flex-1 btn-outline h-10 text-xs font-semibold uppercase tracking-wider"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleConnectProvider}
                      disabled={verifying}
                      className="flex-1 btn-primary h-10 text-xs font-semibold uppercase tracking-wider"
                    >
                      Authenticate
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: TESTING CONNECTION & MODEL FETCH */}
              {wizardStep === 3 && (
                <div className="flex flex-col items-center justify-center py-6 space-y-4 animate-in fade-in duration-200">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
                    <Sparkles className="text-[var(--primary)] animate-pulse" size={15} />
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">{verifyStatus}</p>
                    <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">securing vault handshake...</p>
                  </div>
                </div>
              )}

              {/* STEP 4: SUCCESS */}
              {wizardStep === 4 && (
                <div className="flex flex-col items-center justify-center py-6 space-y-4 animate-in fade-in duration-200">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[var(--success)] animate-bounce">
                    <CheckCircle2 size={20} />
                  </div>
                  
                  <div className="text-center space-y-1.5">
                    <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Node connection established</h4>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto font-semibold">
                      API settings saved successfully. Dynamic models are now active inside the assistant creator.
                    </p>
                  </div>

                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="w-full btn-primary h-10 text-xs font-semibold uppercase tracking-wider"
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
