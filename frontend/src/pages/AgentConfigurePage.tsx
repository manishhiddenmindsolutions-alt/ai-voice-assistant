import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Brain, 
  Mic, 
  Volume2, 
  Sparkles,
  Settings,
  Globe,
  Play,
  Check
} from 'lucide-react';
import api, { agentApi, sessionApi, numbersApi } from '../services/api';
import { useAgentStore } from '../store/useAgentStore';
import toast from 'react-hot-toast';
import { Select } from '../components/ui/Select';
import { AgentAvatar } from '../components/AgentAvatar';

const LLM_MODELS = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 (70B)' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 (8B)' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral (Reasoning)' }
  ],
  cerebras: [
    { id: 'llama-3.3-70b', name: 'Llama 3.3 (70B) - Cerebras Speed' },
    { id: 'llama3.1-8b', name: 'Llama 3.1 (8B) - Cerebras Speed' }
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Flagship)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Legacy' }
  ],
  openrouter: [
    { id: 'openrouter/anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openrouter/google/gemini-pro', name: 'Gemini Pro' },
    { id: 'openrouter/mistralai/mistral-medium', name: 'Mistral Medium' }
  ]
};

const TTS_VOICES = {
  sarvam: [
    { id: 'neha', name: 'Neha (Female - Crystal Clear Premium)' },
    { id: 'shreya', name: 'Shreya (Female - Customer Care Premium)' },
    { id: 'ritu', name: 'Ritu (Female - Customer Care)' },
    { id: 'shubh', name: 'Shubh (Male - Premium)' },
    { id: 'aditya', name: 'Aditya (Male - Storyteller)' }
  ],
  openai: [
    { id: 'alloy', name: 'Alloy (Neutral)' },
    { id: 'echo', name: 'Echo (Male - Deep)' },
    { id: 'shimmer', name: 'Shimmer (Female - High)' }
  ]
};

const AgentConfigurePage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const { setAgents, setActiveSession } = useAgentStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userNumbers, setUserNumbers] = useState<any[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState<string>('none');
  
  // Dynamic Provider Model state variables
  const [dynamicModels, setDynamicModels] = useState<any>(LLM_MODELS);
  const [availableProviders, setAvailableProviders] = useState<string[]>(['groq', 'cerebras', 'openai', 'openrouter']);
  const [providerLabels, setProviderLabels] = useState<string[]>(['Groq Inference', 'Cerebras Speed', 'OpenAI Premium', 'OpenRouter Global']);

  const [formData, setFormData] = useState<any>({
    agentName: '',
    description: '',
    prompt: '',
    first_message: 'Hello! How can I help you today?',
    expressive_mode: false,
    termination_keywords: '',
    status: 'draft',
    language: 'hi-IN',
    stt: { provider: 'sarvam', model: 'saaras:v3', language: 'hi-IN' },
    llm: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.7 },
    tts: { provider: 'sarvam', model: 'bulbul:v3', voice: 'neha', pace: 1.0 },
    vad: { activation_threshold: 0.5, min_speech_duration: 0.3, min_silence_duration: 0.8, padding_duration: 0.1 },
    tools: []
  });

  useEffect(() => {
    if (!agentId) return;

    const fetchAgentDetails = async () => {
      setIsLoading(true);
      try {
        const res = await agentApi.get(agentId);
        setFormData(res.data);
        
        // Load additional telephony numbers
        const numRes = await numbersApi.list();
        const activeNumbers = numRes.data || [];
        setUserNumbers(activeNumbers);
        
        const bound = activeNumbers.find((n: any) => n.agent_id === agentId);
        if (bound) {
          setSelectedNumberId(bound.id);
        } else {
          setSelectedNumberId('none');
        }

        // Fetch dynamic provider models
        try {
          const provRes = await api.get('/providers/');
          const connections = provRes.data || [];
          if (connections.length > 0) {
            const mergedModels = { ...LLM_MODELS };
            const pList = ['groq', 'cerebras', 'openai', 'openrouter'];
            const pLabels = ['Groq Inference', 'Cerebras Speed', 'OpenAI Premium', 'OpenRouter Global'];
            
            const labelMapping: Record<string, string> = {
              groq: 'Groq Inference',
              cerebras: 'Cerebras Speed',
              openai: 'OpenAI Premium',
              openrouter: 'OpenRouter Global',
              anthropic: 'Anthropic Claude',
              gemini: 'Google Gemini',
              deepseek: 'DeepSeek AI',
              together_ai: 'Together AI',
              sarvam: 'Sarvam AI',
              deepgram: 'Deepgram Cloud',
              elevenlabs: 'ElevenLabs Voices',
              cartesia: 'Cartesia Sonic',
              assemblyai: 'AssemblyAI'
            };

            connections.forEach((conn: any) => {
              const pName = conn.provider.toLowerCase();
              if (conn.models && conn.models.length > 0) {
                const parsed = conn.models.map((m: any) => ({
                  id: m.model_id,
                  name: m.name || m.model_id
                }));
                
                if (!pList.includes(pName)) {
                  pList.push(pName);
                  pLabels.push(labelMapping[pName] || conn.provider.toUpperCase());
                }
                (mergedModels as any)[pName] = parsed;
              }
            });

            setDynamicModels(mergedModels);
            setAvailableProviders(pList);
            setProviderLabels(pLabels);
          }
        } catch (err) {
          console.error("Failed to load dynamic provider configurations", err);
        }
      } catch (err) {
        console.error('Failed to load agent details', err);
        toast.error('Failed to load agent configuration');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgentDetails();
  }, [agentId]);

  const handleSave = async (launchImmediate = false) => {
    if (!formData.agentName.trim()) return toast.error("Assistant name required");
    
    setIsSaving(true);
    const processToast = toast.loading(launchImmediate ? 'Starting Voice Gateway...' : 'Publishing changes...');

    try {
      const resp = await agentApi.createOrUpdate({ ...formData, id: agentId });
      const savedAgent = resp.data;

      // Check number assignment state
      if (selectedNumberId !== 'none') {
        await numbersApi.update(selectedNumberId, { agent_id: savedAgent.id });
      } else {
        const bound = userNumbers.find((n: any) => n.agent_id === agentId);
        if (bound) {
          await numbersApi.update(bound.id, { agent_id: null });
        }
      }

      // Re-fetch agents list in state
      const resList = await agentApi.list();
      setAgents(resList.data);

      if (launchImmediate) {
        const startPayload = {
          agent_id: savedAgent.id,
          prompt: savedAgent.prompt,
          language: savedAgent.language,
          stt: savedAgent.stt,
          llm: savedAgent.llm,
          tts: savedAgent.tts,
          vad: savedAgent.vad || { provider: 'silero' },
          tools: savedAgent.tools,
        };
        const sessionRes = await sessionApi.start(startPayload);
        setActiveSession({ ...sessionRes.data, agentName: savedAgent.agentName });
        toast.success('Voice Agent Live', { id: processToast });
      } else {
        toast.success('Agent published successfully', { id: processToast });
      }
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to save changes', { id: processToast });
    } finally {
      setIsSaving(false);
    }
  };

  const enhancePrompt = () => {
    if (!formData.prompt.trim()) {
      toast.error("Please enter a basic prompt description first");
      return;
    }
    const toastId = toast.loading("Enhancing prompt structure...");
    setTimeout(() => {
      const enhanced = `# Persona & Role\nYou are ${formData.agentName || 'Alex'}, a highly-professional voice agent. Your tone is supportive, informative, and crisp.\n\n# Objective\n${formData.prompt}\n\n# Guidelines\n- Answer questions directly and avoid verbose explanations.\n- Be pleasant, patient, and polite at all times.\n- Do not output markdown text patterns during synthesized calls.`;
      setFormData((prev: any) => ({ ...prev, prompt: enhanced }));
      toast.success("Prompt successfully enhanced!", { id: toastId });
    }, 1200);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 animate-in fade-in duration-300">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
        <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider">Loading agent configuration...</span>
      </div>
    );
  }

  const currentProvider = (formData.llm?.provider || 'groq') as keyof typeof LLM_MODELS;
  const currentModels = dynamicModels[currentProvider] || LLM_MODELS.groq;

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-500 font-sans">
      
      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-[var(--border)] pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <AgentAvatar name={formData.agentName} agent={formData} className="w-14 h-14 text-2xl border border-[var(--border)] shadow-sm" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {formData.agentName || 'Unnamed Agent'}
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                {formData.status}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Agent ID: <span className="font-mono">{agentId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Status Select */}
          <Select
            value={formData.status}
            onChange={val => setFormData({ ...formData, status: val })}
            options={[
              { value: 'draft', label: 'Draft Mode' },
              { value: 'live', label: 'Live' },
              { value: 'paused', label: 'Paused' }
            ]}
            className="w-36 h-10 text-xs"
          />

          <button 
            onClick={() => handleSave(true)}
            className="btn-outline h-10 text-xs font-bold uppercase tracking-wider px-4 flex items-center gap-1.5"
          >
            <Play size={12} fill="currentColor" strokeWidth={0} className="text-[var(--success)]" />
            Preview
          </button>
          
          <button 
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="btn-primary h-10 text-xs font-bold uppercase tracking-wider px-5 shadow-sm flex items-center gap-1.5"
          >
            <Check size={14} />
            Publish
          </button>
        </div>
      </div>

      {/* DUAL COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Prompt & First Message */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* SYSTEM PROMPT CARD */}
          <div className="card p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-[var(--primary)]" />
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">System Prompt</h3>
              </div>
              <button 
                onClick={enhancePrompt}
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 hover:bg-[var(--primary)]/15 transition-all"
              >
                🪄 Enhance Prompt
              </button>
            </div>
            
            <textarea 
              value={formData.prompt}
              onChange={e => setFormData({ ...formData, prompt: e.target.value })}
              className="w-full h-96 p-4 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-xs font-semibold leading-relaxed outline-none focus:border-[var(--border-focus)] transition-all resize-none custom-scrollbar"
              placeholder="Describe your agent's persona, knowledge base, goals, and constraints. Press 🪄 Enhance Prompt to structure this dynamically."
            />
            
            <div className="flex items-center gap-2 text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-wider px-1">
              <span>Variables helper: Type <code>{"{{"}</code> to insert dynamic parameter references.</span>
            </div>
          </div>

          {/* FIRST MESSAGE CARD */}
          <div className="card p-6 flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Sparkles size={16} className="text-amber-500" />
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">First Message</h3>
            </div>
            
            <textarea 
              value={formData.first_message}
              onChange={e => setFormData({ ...formData, first_message: e.target.value })}
              className="w-full h-24 p-4 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-xs font-semibold leading-relaxed outline-none focus:border-[var(--border-focus)] transition-all resize-none custom-scrollbar"
              placeholder="The greeting message your voice assistant speaks immediately when starting a new session."
            />
          </div>

          {/* TERMINATION KEYWORDS CARD */}
          <div className="card p-6 flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Volume2 size={16} className="text-rose-500" />
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Termination Keywords</h3>
            </div>
            
            <textarea 
              value={formData.termination_keywords || ''}
              onChange={e => setFormData({ ...formData, termination_keywords: e.target.value })}
              className="w-full h-20 p-4 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-xs font-semibold leading-relaxed outline-none focus:border-[var(--border-focus)] transition-all resize-none custom-scrollbar"
              placeholder="Enter comma-separated words/phrases (e.g. bye, cut the call, disconnect, take care) that trigger call termination."
            />
            <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
              Note: When the agent speaks one of these phrases, the session will auto-terminate after a 5-second playback buffer.
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Voice, LLM, Language, Settings */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* VOICE SELECTION */}
          <div className="card p-6 flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Mic size={16} className="text-emerald-500" />
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Voices</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Signal Provider</label>
                <Select 
                  value={formData.tts.provider} 
                  onChange={(p: string) => {
                    const list = TTS_VOICES[p as keyof typeof TTS_VOICES] || [];
                    setFormData({ 
                      ...formData, 
                      tts: { ...formData.tts, provider: p, voice: list[0]?.id || 'neha' } 
                    });
                  }}
                  options={[
                    { value: 'sarvam', label: 'Sarvam TTS' },
                    { value: 'openai', label: 'OpenAI Premium' }
                  ]}
                  className="w-full text-xs"
                />
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Vocal Identity</label>
                <Select 
                  value={formData.tts.voice} 
                  onChange={(v: string) => setFormData({ ...formData, tts: { ...formData.tts, voice: v } })}
                  options={((TTS_VOICES[formData.tts.provider as keyof typeof TTS_VOICES] || [])).map((voice: any) => ({
                    value: voice.id,
                    label: voice.name.split(' (')[0]
                  }))}
                  className="w-full text-xs"
                />
              </div>
            </div>

            <div className="mt-2 flex justify-between items-center py-2 border-t border-[var(--border)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Speech Pace Speed</span>
              <span className="text-xs font-extrabold text-[var(--primary)] font-mono">{formData.tts.pace}x</span>
            </div>
            <input 
              type="range"
              min={0.6}
              max={1.5}
              step={0.05}
              value={formData.tts.pace}
              onChange={e => setFormData({ ...formData, tts: { ...formData.tts, pace: parseFloat(e.target.value) } })}
              className="w-full premium-slider appearance-none cursor-pointer"
            />
          </div>

          {/* EXPRESSIVE MODE MOCK CARD */}
          <div className="card p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-indigo-400" />
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Expressive Mode</h3>
              </div>
              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 leading-none">New</span>
            </div>
            
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Enhance your agent with emotionally intelligent, natural voice modulation and dynamic speech accent tuning.
            </p>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Enable Emotional Inflection</span>
              <button
                onClick={() => setFormData((prev: any) => ({ ...prev, expressive_mode: !prev.expressive_mode }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.expressive_mode ? 'bg-[var(--primary)]' : 'bg-zinc-700'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.expressive_mode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* LANGUAGE SETTINGS */}
          <div className="card p-6 flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Globe size={16} className="text-sky-500" />
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Language & Speech</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">STT Provider</label>
                <Select
                  value={formData.stt?.provider || 'sarvam'}
                  onChange={(p: string) => setFormData({ ...formData, stt: { ...formData.stt, provider: p } })}
                  options={[
                    { value: 'sarvam', label: 'Sarvam Voice' },
                    { value: 'deepgram', label: 'Deepgram Premium' },
                  ]}
                  className="w-full text-xs"
                />
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Default Language</label>
                <Select
                  value={formData.language}
                  onChange={(l: string) => setFormData({ ...formData, language: l, stt: { ...formData.stt, language: l } })}
                  options={[
                    { value: 'hi-IN', label: 'Hindi (Indic Dialect)' },
                    { value: 'en-US', label: 'English (Global Dialect)' }
                  ]}
                  className="w-full text-xs"
                />
              </div>
            </div>
          </div>

          {/* LLM POWERING ENGINE */}
          <div className="card p-6 flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Settings size={16} className="text-rose-500" />
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">LLM Model Configuration</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Inference Provider</label>
                <Select 
                  value={formData.llm.provider} 
                  onChange={(p: string) => {
                    const defaultModel = dynamicModels[p as keyof typeof dynamicModels]?.[0]?.id || '';
                    setFormData({ 
                      ...formData, 
                      llm: { ...formData.llm, provider: p, model: defaultModel } 
                    });
                  }}
                  options={availableProviders.map((p, i) => ({
                    value: p,
                    label: providerLabels[i] || p.toUpperCase()
                  }))}
                  className="w-full text-xs"
                />
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">Core AI Model</label>
                <Select 
                  value={formData.llm.model} 
                  onChange={(m: string) => setFormData({ ...formData, llm: { ...formData.llm, model: m } })}
                  options={currentModels.map((m: any) => ({
                    value: m.id,
                    label: m.name
                  }))}
                  className="w-full text-xs"
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-[var(--border)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Model Temperature</span>
              <span className="text-xs font-extrabold text-[var(--primary)] font-mono">{formData.llm.temperature}</span>
            </div>
            <input 
              type="range"
              min={0}
              max={2.0}
              step={0.1}
              value={formData.llm.temperature}
              onChange={e => setFormData({ ...formData, llm: { ...formData.llm, temperature: parseFloat(e.target.value) } })}
              className="w-full premium-slider appearance-none cursor-pointer"
            />
          </div>

        </div>

      </div>

    </div>
  );
};

export default AgentConfigurePage;
