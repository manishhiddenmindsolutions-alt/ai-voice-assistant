import { useState, useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import { 
  Brain, 
  Mic, 
  Volume2, 
  Info,
  Zap,
  Code,
  Activity,
  Sparkles,
  Command,
  Monitor
} from 'lucide-react';
import api, { agentApi, sessionApi, toolApi, numbersApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
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
    { id: 'echo', name: 'Echo (Deep)' },
    { id: 'shimmer', name: 'Shimmer (High)' }
  ]
};

const BLUEPRINTS = [
  {
    name: "Real Estate Closer",
    icon: "🏘️",
    prompt: "You are a high-performing real estate closer. Your tone is professional, persuasive, and knowledgeable. Focus on lead qualification and property value points.",
    vad: { activation_threshold: 0.5, min_speech_duration: 0.3, min_silence_duration: 0.8 },
    llm: { provider: 'groq', model: 'llama-3.3-70b-versatile' }
  },
  {
    name: "Concierge AI",
    icon: "🤵",
    prompt: "You are an elegant concierge. You assist with scheduling, recommendations, and local knowledge. Your tone is refined, helpful, and sophisticated.",
    vad: { activation_threshold: 0.5, min_speech_duration: 0.3, min_silence_duration: 0.8 },
    llm: { provider: 'openai', model: 'gpt-4o-mini' }
  },
  {
    name: "Technical Support",
    icon: "⚙️",
    prompt: "You are a technical support engineer. You are patient, analytical, and structured. Use step-by-step reasoning to resolve issues.",
    vad: { activation_threshold: 0.5, min_speech_duration: 0.3, min_silence_duration: 0.8 },
    llm: { provider: 'groq', model: 'mixtral-8x7b-32768' }
  }
];

const PreviewStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-zinc-800/40 last:border-none">
    <span className="text-sm text-zinc-500">{label}</span>
    <span className="text-sm font-semibold text-zinc-200 truncate max-w-[180px]">{value}</span>
  </div>
);

const CreateAgentPage = () => {
  const { editingAgent, setAgents, agents, setActiveSession } = useAgentStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [userNumbers, setUserNumbers] = useState<any[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState<string>('none');
  const navigate = useNavigate();

  // Dynamic Provider Model state variables
  const [dynamicModels, setDynamicModels] = useState<any>(LLM_MODELS);
  const [availableProviders, setAvailableProviders] = useState<string[]>(['groq', 'cerebras', 'openai', 'openrouter']);
  const [providerLabels, setProviderLabels] = useState<string[]>(['Groq Inference', 'Cerebras Speed', 'OpenAI Premium', 'OpenRouter Global']);

  const [formData, setFormData] = useState<any>(editingAgent || {
    agentName: '',
    description: '',
    prompt: '',
    status: 'draft',
    language: 'hi-IN',
    stt: { provider: 'sarvam', model: 'saaras:v3', language: 'hi-IN' },
    llm: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.7 },
    tts: { provider: 'sarvam', model: 'bulbul:v3', voice: 'neha', pace: 1.0 },
    vad: { activation_threshold: 0.5, min_speech_duration: 0.3, min_silence_duration: 0.8, padding_duration: 0.1 },
    tools: []
  });

  useEffect(() => {
    if (editingAgent) setFormData(editingAgent);
    
    // Fetch dynamic provider models
    const fetchDynamicProviders = async () => {
      try {
        const res = await api.get('/providers/');
        const connections = res.data || [];
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
              mergedModels[pName as keyof typeof LLM_MODELS] = parsed;
            }
            if (!pList.includes(pName)) {
              pList.push(pName);
              pLabels.push(labelMapping[pName] || conn.provider.toUpperCase());
            }
          });

          setDynamicModels(mergedModels);
          setAvailableProviders(pList);
          setProviderLabels(pLabels);
        }
      } catch (err) {
        console.error("Failed to load dynamic provider model registries", err);
      }
    };

    // Fetch available tools for selection
    const fetchTools = async () => {
      try {
        const res = await toolApi.list();
        setAvailableTools(res.data);
      } catch (err) {
        console.error("Failed to load neural tools", err);
      }
    };

    // Fetch user numbers
    const fetchNumbers = async () => {
      try {
        const res = await numbersApi.list();
        setUserNumbers(res.data || []);
        if (editingAgent) {
          const linkedNum = res.data?.find((n: any) => n.agent_id === editingAgent.id);
          if (linkedNum) {
            setSelectedNumberId(linkedNum.id);
          }
        }
      } catch (err) {
        console.error("Failed to load user numbers", err);
      }
    };
    
    Promise.all([fetchDynamicProviders(), fetchTools(), fetchNumbers()]).finally(() => {
      setIsLoading(false);
    });
  }, [editingAgent]);

  const applyBlueprint = (bp: any) => {
    setFormData({
      ...formData,
      agentName: bp.name,
      prompt: bp.prompt,
      vad: { ...formData.vad, ...bp.vad },
      llm: { ...formData.llm, ...bp.llm }
    });
    setStep(1);
    toast.success(`'${bp.name}' Blueprint Applied`);
  };

  const handleSave = async (andLaunch = false) => {
    if (!formData.agentName.trim()) return toast.error('Assistant name is required');
    
    const processToast = toast.loading(andLaunch ? 'Deploying & Testing...' : 'Saving Assistant...');
    
    try {
      const res = await agentApi.createOrUpdate(formData);
      const saved = res.data;

      // Link selected tools
      const selectedToolIds = formData.tools || [];
      if (selectedToolIds.length > 0) {
        await Promise.all(
          selectedToolIds.map((toolId: string) => agentApi.linkTool(saved.id, toolId))
        );
      }

      // Link / Unlink selected phone number
      await Promise.all(
        userNumbers.map(async (num: any) => {
          if (num.id === selectedNumberId) {
            if (num.agent_id !== saved.id) {
              await numbersApi.update(num.id, { agent_id: saved.id });
            }
          } else if (num.agent_id === saved.id) {
            await numbersApi.update(num.id, { agent_id: null });
          }
        })
      );
      
      const newAgents = [...agents];
      const idx = newAgents.findIndex((a: any) => a.id === saved.id);
      if (idx > -1) newAgents[idx] = saved;
      else newAgents.push(saved);
      setAgents(newAgents);

      if (andLaunch) {
        const sessionRes = await sessionApi.start(saved);
        setActiveSession(sessionRes.data);
        toast.success('Voice Agent Live', { id: processToast });
      } else {
        toast.success('Assistant Saved successfully', { id: processToast });
        navigate('/agents');
      }
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to save assistant', { id: processToast });
    }
  };

  const renderStepIndicator = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-10">
      {[
        { id: 1, label: 'Identity', icon: <Brain size={14} /> },
        { id: 2, label: 'Vocal', icon: <Mic size={14} /> },
        { id: 3, label: 'Tools', icon: <Command size={14} /> },
        { id: 4, label: 'Pro-VAD', icon: <Activity size={14} /> }
      ].map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => {
            if (s.id === 1 || formData.agentName.trim()) {
              setStep(s.id);
            } else {
              toast.error("Assistant name required to navigate");
            }
          }}
          className={`p-3 rounded-xl border transition flex items-center gap-3 justify-center ${
            step === s.id
              ? 'bg-zinc-900 border-zinc-700 text-zinc-100 shadow-[0_0_15px_rgba(255,255,255,0.01)]'
              : step > s.id
                ? 'bg-zinc-900/20 border-zinc-800 text-emerald-400'
                : 'bg-zinc-950/20 border-zinc-850 text-zinc-500 hover:border-zinc-800'
          }`}
        >
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold ${
            step === s.id ? 'bg-zinc-100 text-zinc-950' : step > s.id ? 'bg-emerald-500/10' : 'bg-zinc-900'
          }`}>
            {step > s.id ? '✓' : s.id}
          </div>
          <span className="text-sm font-semibold tracking-wide">{s.label}</span>
        </button>
      ))}
    </div>
  );

  if (isLoading) return <div className="h-full flex items-center justify-center text-lg font-medium text-zinc-400 animate-pulse">Preparing Assistant...</div>;

  const currentProvider = (formData.llm?.provider || 'groq') as keyof typeof LLM_MODELS;
  const currentModels = dynamicModels[currentProvider] || LLM_MODELS.groq;

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
        <div>
          <div className="mb-5">
            <BackButton fallbackPath="/agents" label="Agents" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
            {editingAgent ? 'Configure Assistant' : 'Register Assistant'}
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            Configure and launch your AI voice assistant connection node.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleSave(false)} className="h-11 px-5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition flex items-center gap-2">
            Save Draft
          </button>
          <button onClick={() => handleSave(true)} className="h-11 px-5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition flex items-center gap-2 shadow-lg shadow-primary/10">
            <Zap size={15} fill="currentColor" strokeWidth={0} />
            Launch Agent
          </button>
        </div>
      </div>

      {renderStepIndicator()}

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        
        {/* FORM PANEL */}
        <div className="space-y-8">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* BLUEPRINTS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Sparkles size={14} className="text-zinc-500" />
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Agent Blueprints</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {BLUEPRINTS.map(bp => (
                    <button
                      key={bp.name}
                      onClick={() => applyBlueprint(bp)}
                      className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 text-left"
                    >
                      <div className="text-3xl mb-4">{bp.icon}</div>
                      <h3 className="text-base font-semibold text-zinc-100 mb-2">{bp.name}</h3>
                      <p className="text-sm text-zinc-400 leading-relaxed italic line-clamp-3">"{bp.prompt}"</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* IDENTITY FORM */}
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Assistant Name</label>
                    <input 
                      value={formData.agentName} 
                      onChange={e => setFormData({ ...formData, agentName: e.target.value })} 
                      className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition" 
                      placeholder="e.g. Identity Node-01" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Linked Phone Number</label>
                    <select
                      value={selectedNumberId}
                      onChange={e => setSelectedNumberId(e.target.value)}
                      className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition cursor-pointer"
                    >
                      <option value="none">No Phone Number (Web / Chat only)</option>
                      {userNumbers.map((num: any) => (
                        <option key={num.id} value={num.id}>
                          {num.number} ({num.provider === 'twilio' ? 'Twilio Telephony' : num.provider.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ConfigGroup 
                    label="Intelligence Provider" 
                    value={formData.llm.provider} 
                    options={availableProviders} 
                    labels={providerLabels}
                    onChange={(p: string) => {
                      const defaultModel = dynamicModels[p as keyof typeof dynamicModels]?.[0]?.id || '';
                      setFormData({ 
                        ...formData, 
                        llm: { ...formData.llm, provider: p, model: defaultModel } 
                      });
                    }} 
                  />
                  <ConfigGroup 
                    label="Core Inference Model" 
                    value={formData.llm.model} 
                    options={currentModels.map((m: any) => m.id)} 
                    labels={currentModels.map((m: any) => m.name)} 
                    onChange={(m: string) => setFormData({ ...formData, llm: { ...formData.llm, model: m } })} 
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SensitivitySlider 
                    label="Creativity (Temperature)" 
                    value={formData.llm.temperature} 
                    min={0} 
                    max={2.0} 
                    step={0.1} 
                    onChange={(v: number) => setFormData({...formData, llm: {...formData.llm, temperature: v}})} 
                    sub="Higher values yield creative, diverse responses." 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Behavioral Directives</label>
                  <textarea 
                    value={formData.prompt} 
                    onChange={e => setFormData({ ...formData, prompt: e.target.value })} 
                    className="w-full !py-4 h-48 resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition leading-relaxed" 
                    placeholder="Enter detailed directives, constraints, persona rules, and background domain knowledge..." 
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ProPanel label="STT (The Ear)" icon={<Monitor size={14} />}>
                  <ConfigGroup 
                    label="Signal Provider" 
                    value={formData.stt.provider} 
                    options={['sarvam', 'deepgram']} 
                    labels={['Sarvam Voice', 'Deepgram Premium']}
                    onChange={(p: string) => setFormData({ ...formData, stt: { ...formData.stt, provider: p } })} 
                  />
                  <ConfigGroup 
                    label="Primary Language" 
                    value={formData.language} 
                    options={['hi-IN', 'en-US', 'bn-IN']} 
                    labels={['Hindi (India)', 'English (US)', 'Bengali (India)']}
                    onChange={(l: string) => setFormData({ ...formData, language: l, stt: { ...formData.stt, language: l } })} 
                  />
                </ProPanel>
                <ProPanel label="TTS (The Voice)" icon={<Volume2 size={14} />}>
                  <ConfigGroup 
                    label="Vocal Engine" 
                    value={formData.tts.provider} 
                    options={['sarvam', 'openai']} 
                    labels={['Sarvam Indic Voice', 'OpenAI Premium Voice']}
                    onChange={(p: string) => {
                      const defaultVoice = TTS_VOICES[p as keyof typeof TTS_VOICES]?.[0]?.id || '';
                      setFormData({ 
                        ...formData, 
                        tts: { ...formData.tts, provider: p, voice: defaultVoice } 
                      });
                    }} 
                  />
                  <ConfigGroup 
                    label="Voice ID" 
                    value={formData.tts.voice} 
                    options={TTS_VOICES[formData.tts.provider as keyof typeof TTS_VOICES].map(v => v.id)} 
                    labels={TTS_VOICES[formData.tts.provider as keyof typeof TTS_VOICES].map(v => v.name)} 
                    onChange={(v: string) => setFormData({ ...formData, tts: { ...formData.tts, voice: v } })} 
                  />
                </ProPanel>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                <SensitivitySlider 
                  label="Speech Pace (Speed)" 
                  value={formData.tts.pace || 1.0} 
                  min={0.5} 
                  max={2.0} 
                  step={0.1} 
                  onChange={(v: number) => setFormData({...formData, tts: {...formData.tts, pace: v}})} 
                  sub="Ratio of generated voice synthesis feedback speed (Standard: 1.0x)." 
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">Agent Tools Integration</h3>
                  <p className="text-sm text-zinc-500 mt-1">Connect operational tools to execute platform triggers.</p>
                </div>
                <button onClick={() => navigate('/tools')} className="h-9 px-4 rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm font-medium text-zinc-305 hover:bg-zinc-800 transition">Marketplace</button>
              </div>

              {availableTools.length === 0 ? (
                <div className="p-16 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40">
                  <Command size={40} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-sm text-zinc-550 italic font-medium">No tools available in current registry.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableTools.map(tool => {
                    const isSelected = (formData.tools || []).includes(tool.id);
                    return (
                      <button 
                        key={tool.id}
                        onClick={() => {
                          const current = formData.tools || [];
                          const next = isSelected 
                            ? current.filter((id: string) => id !== tool.id)
                            : [...current, tool.id];
                          setFormData({ ...formData, tools: next });
                        }}
                        className={`p-5 rounded-2xl border text-left transition-all duration-300 group relative ${
                          isSelected 
                            ? 'bg-primary/5 border-primary/45 shadow-sm' 
                            : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/20'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            isSelected ? 'bg-primary text-on-primary shadow shadow-primary/10' : 'bg-zinc-900 text-zinc-500'
                          }`}>
                            <Code size={16} />
                          </div>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                        </div>
                        <h4 className="text-sm font-semibold text-zinc-100">{tool.name}</h4>
                        <p className="text-xs text-zinc-550 line-clamp-1 italic mt-1">{tool.description || 'Custom module link.'}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 space-y-8 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-zinc-100">Audio Signal Processing</h3>
                <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">Advanced Audio</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                <SensitivitySlider label="Activation Threshold" value={formData.vad.activation_threshold} min={0.1} max={0.9} step={0.05} onChange={(v: number) => setFormData({...formData, vad: {...formData.vad, activation_threshold: v}})} sub="VAD threshold detection floor." />
                <SensitivitySlider label="Speech Resilience" value={formData.vad.min_speech_duration} min={0.05} max={1.0} step={0.05} onChange={(v: number) => setFormData({...formData, vad: {...formData.vad, min_speech_duration: v}})} sub="Minimum sound duration floor." />
                <SensitivitySlider label="Silence Tolerance" value={formData.vad.min_silence_duration} min={0.1} max={3.0} step={0.1} onChange={(v: number) => setFormData({...formData, vad: {...formData.vad, min_silence_duration: v}})} sub="Delay buffer before speaker changes." />
                <SensitivitySlider label="Signal Padding" value={formData.vad.padding_duration} min={0.05} max={1.0} step={0.05} onChange={(v: number) => setFormData({...formData, vad: {...formData.vad, padding_duration: v}})} sub="Padding border boundaries." />
              </div>

              <div className="p-5 bg-zinc-950/40 border border-zinc-800 rounded-xl flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                  <Info size={16} />
                </div>
                <p className="text-xs text-zinc-550 leading-relaxed pt-0.5">
                  Voice Activity Detection controls latency and sensitivity thresholds. Correct settings ensure stable, real-time responses with zero disruption.
                </p>
              </div>
            </div>
          )}

          {/* BOTTOM STEP CONTROLS */}
          <div className="mt-8 flex justify-between items-center py-5 border-t border-zinc-900/60 sticky bottom-0 bg-background/50 backdrop-blur-xl z-10">
            {step === 1 ? (
              <button 
                type="button"
                onClick={() => navigate('/agents')}
                className="h-10 px-5 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition flex items-center justify-center gap-2"
              >
                Cancel
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => setStep(s => Math.max(1, s - 1))}
                className="h-10 px-5 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition flex items-center justify-center gap-2"
              >
                Previous Stage
              </button>
            )}
            <button 
              type="button"
              onClick={() => {
                if (step === 1 && !formData.agentName.trim()) return toast.error("Assistant name required");
                if (step < 4) setStep(s => s + 1);
                else handleSave(true);
              }}
              className="h-11 px-6 rounded-xl bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
            >
              {step < 4 ? 'Next Stage' : 'Save & Launch'}
            </button>
          </div>
        </div>

        {/* SIDEBAR PREVIEW (MATCHES PROFILE CARD STYLE EXACTLY) */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 sticky top-24">
            
            <div className="flex flex-col items-center text-center">
              {/* AVATAR BOX WITH STATUS DOT */}
              <div className="relative mb-5">
                <AgentAvatar name={formData.agentName} agent={formData} className="w-24 h-24 text-5xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 border-2 border-zinc-950 animate-pulse" />
              </div>

              {/* NAME */}
              <h2 className="text-xl font-semibold text-zinc-100 truncate max-w-[280px]">
                {formData.agentName || 'Unnamed Assistant'}
              </h2>

              {/* BADGE */}
              <div className="mt-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                Link Protocol Ready
              </div>
            </div>

            {/* PREVIEW STATS */}
            <div className="mt-8 space-y-1">
              <PreviewStat 
                label="Intelligence" 
                value={dynamicModels[currentProvider]?.find((m: any) => m.id === formData.llm.model)?.name || formData.llm.model} 
              />
              <PreviewStat 
                label="Provider" 
                value={formData.llm.provider.toUpperCase()} 
              />
              <PreviewStat 
                label="Voice Identity" 
                value={formData.tts.voice} 
              />
              <PreviewStat 
                label="Language" 
                value={formData.language.split('-')[0].toUpperCase()} 
              />
              <PreviewStat 
                label="Pace Speed" 
                value={`${formData.tts.pace || 1.0}x`} 
              />
              <PreviewStat 
                label="VAD Sensitivity" 
                value={formData.vad.activation_threshold} 
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const ConfigGroup = ({ label, value, options, labels, onChange }: any) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-zinc-300">{label}</label>
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition"
    >
      {options.map((o: any, i: number) => (
        <option key={o} value={o}>{labels ? labels[i] : o}</option>
      ))}
    </select>
  </div>
);

const ProPanel = ({ label, icon, children }: any) => (
  <div className="bg-zinc-950/40 p-6 rounded-2xl border border-zinc-800 space-y-6 flex-1">
    <div className="flex items-center gap-3 mb-1 font-semibold text-zinc-150 text-base uppercase tracking-wider leading-none">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/15">{icon}</div>
      {label}
    </div>
    {children}
  </div>
);

const SensitivitySlider = ({ label, value, min, max, step, onChange, sub }: any) => (
  <div className="space-y-3">
    <div className="flex justify-between items-end px-1">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <span className="text-sm font-semibold text-zinc-100">{value}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      onChange={e => onChange(parseFloat(e.target.value))} 
      className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-primary cursor-pointer" 
    />
    <p className="text-xs text-zinc-550 mt-1">{sub}</p>
  </div>
);

export default CreateAgentPage;