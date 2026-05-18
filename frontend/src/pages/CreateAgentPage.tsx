import { useState, useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import { 
  Brain, 
  Mic, 
  Volume2, 
  Info,
  Zap,
  ArrowLeft,
  Shield,
  Code,
  Activity,
  Sparkles,
  Command,
  Monitor
} from 'lucide-react';
import { agentApi, sessionApi, toolApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

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

const CreateAgentPage = () => {
  const { editingAgent, setAgents, agents, setActiveSession } = useAgentStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const navigate = useNavigate();

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
    
    // Fetch available tools for selection
    const fetchTools = async () => {
      try {
        const res = await toolApi.list();
        setAvailableTools(res.data);
      } catch (err) {
        console.error("Failed to load neural tools", err);
      }
    };
    
    fetchTools();
    setIsLoading(false);
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
    
    const processToast = toast.loading(andLaunch ? 'Forging & Testing...' : 'Synchronizing Forge...');
    
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
      
      const newAgents = [...agents];
      const idx = newAgents.findIndex((a: any) => a.id === saved.id);
      if (idx > -1) newAgents[idx] = saved;
      else newAgents.push(saved);
      setAgents(newAgents);

      if (andLaunch) {
        const sessionRes = await sessionApi.start(saved);
        setActiveSession(sessionRes.data);
        toast.success('Neural Link Established', { id: processToast });
      } else {
        toast.success('Forge Synchronized', { id: processToast });
        navigate('/agents');
      }
    } catch (err) {
      console.error('Forge failed:', err);
      toast.error('Forge Protocol Error', { id: processToast });
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between max-w-[500px] mx-auto mb-10 overflow-x-auto pb-4 px-2 no-scrollbar gap-6 md:gap-2">
      {[
        { id: 1, label: 'Identity', icon: <Brain size={12} /> },
        { id: 2, label: 'Vocal', icon: <Mic size={12} /> },
        { id: 3, label: 'Tools', icon: <Command size={12} /> },
        { id: 4, label: 'Pro-VAD', icon: <Activity size={12} /> }
      ].map((s) => (
        <div key={s.id} className="flex items-center gap-2 shrink-0">
          <div className={`step-indicator !w-6 !h-6 !text-[9px] ${step === s.id ? 'step-active' : step > s.id ? 'step-completed' : 'step-inactive'}`}>
            {step > s.id ? '✓' : s.id}
          </div>
          <span className={`text-[8px] font-black uppercase tracking-widest ${step === s.id ? 'text-white' : 'text-zinc-600'} whitespace-nowrap`}>
            {s.label}
          </span>
          {s.id < 4 && <div className="hidden sm:block w-8 h-px bg-white/5 ml-1" />}
        </div>
      ))}
    </div>
  );

  if (isLoading) return <div className="h-full flex items-center justify-center font-bold text-primary animate-pulse">Establishing Forge...</div>;

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col space-y-10 pb-24">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 mb-2">
        <div className="flex items-center gap-4 md:gap-5">
          <button onClick={() => navigate('/agents')} className="btn-back-premium">
            <ArrowLeft size={14} />
            <span>Registry</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase leading-none">
              {editingAgent ? 'Neural Configuration' : 'Forge Assistant'}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
               <span className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest">Protocol Phase: Stage {step}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={() => handleSave(false)} className="flex-1 md:w-auto btn-outline !h-9 !px-5 text-[10px]">
            Save Draft
          </button>
          <button onClick={() => handleSave(true)} className="flex-[1.5] md:w-auto btn-vapi h-9 px-6 text-[10px]">
            <Zap size={14} fill="white" strokeWidth={0} />
            Initialize Link
          </button>
        </div>
      </div>

      {renderStepIndicator()}

      {/* MAIN FORGE CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 flex-1 min-h-0 overflow-visible">
        
        <div className="xl:col-span-8 flex flex-col">
          
          <div className="flex-1">
            {step === 1 && (
              <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                <div className="space-y-4">
                   <div className="flex items-center gap-2 px-1">
                    <Sparkles size={14} className="text-primary" />
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[0.25em]">Neural Blueprints</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {BLUEPRINTS.map(bp => (
                      <button key={bp.name} onClick={() => applyBlueprint(bp)} className="p-5 bg-zinc-900/40 border border-white/5 rounded-2xl text-left hover:border-primary/40 transition-all group hover:bg-zinc-900 relative overflow-hidden glow-card-primary">
                        <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{bp.icon}</div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wide mb-1 leading-none">{bp.name}</h4>
                        <p className="text-[9px] text-zinc-600 font-medium line-clamp-2 italic leading-relaxed opacity-70">"{bp.prompt}"</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card-vapi space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Assistant Name</label>
                      <input value={formData.agentName} onChange={e => setFormData({ ...formData, agentName: e.target.value })} className="input-vapi w-full h-11 text-[11px] font-black" placeholder="e.g. Identity Node-01" />
                    </div>
                    <ConfigGroup label="Intelligence Provider" value={formData.llm.provider} options={['groq', 'cerebras', 'openai']} onChange={(p: string) => setFormData({ ...formData, llm: { ...formData.llm, provider: p, model: LLM_MODELS[p as keyof typeof LLM_MODELS][0].id } })} />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ConfigGroup label="Core Inference Model" value={formData.llm.model} options={LLM_MODELS[formData.llm.provider as keyof typeof LLM_MODELS].map(m => m.id)} labels={LLM_MODELS[formData.llm.provider as keyof typeof LLM_MODELS].map(m => m.name)} onChange={(m: string) => setFormData({ ...formData, llm: { ...formData.llm, model: m } })} />
                    <SensitivitySlider label="Creativity (Temp)" value={formData.llm.temperature} min={0} max={2.0} step={0.1} onChange={(v: number) => setFormData({...formData, llm: {...formData.llm, temperature: v}})} sub="Standard: 0.7" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest leading-none">Behavioral Directives</label>
                      <span className="text-[8px] font-black text-primary/60 px-2 py-0.5 bg-primary/10 rounded-md border border-primary/20">System Lock</span>
                    </div>
                    <textarea value={formData.prompt} onChange={e => setFormData({ ...formData, prompt: e.target.value })} className="input-vapi w-full !py-4 h-56 resize-none text-[13px] leading-relaxed" placeholder="Detailed constraints and identity knowledge..." />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <ProPanel label="STT (The Ear)" icon={<Monitor size={12} />}>
                      <ConfigGroup label="Signal Provider" value={formData.stt.provider} options={['sarvam', 'deepgram']} onChange={(p: string) => setFormData({ ...formData, stt: { ...formData.stt, provider: p } })} />
                      <ConfigGroup label="Primary Language" value={formData.language} options={['hi-IN', 'en-US', 'bn-IN']} onChange={(l: string) => setFormData({ ...formData, language: l, stt: { ...formData.stt, language: l } })} />
                    </ProPanel>
                    <ProPanel label="TTS (The Voice)" icon={<Volume2 size={12} />}>
                      <ConfigGroup label="Vocal Engine" value={formData.tts.provider} options={['sarvam', 'openai']} onChange={(p: string) => setFormData({ ...formData, tts: { ...formData.tts, provider: p, voice: TTS_VOICES[p as keyof typeof TTS_VOICES][0].id } })} />
                      <ConfigGroup label="Neural ID" value={formData.tts.voice} options={TTS_VOICES[formData.tts.provider as keyof typeof TTS_VOICES].map(v => v.id)} labels={TTS_VOICES[formData.tts.provider as keyof typeof TTS_VOICES].map(v => v.name)} onChange={(v: string) => setFormData({ ...formData, tts: { ...formData.tts, voice: v } })} />
                    </ProPanel>
                </div>
                <div className="card-vapi !p-6">
                   <SensitivitySlider 
                     label="Speech Pace (Speed)" 
                     value={formData.tts.pace || 1.0} 
                     min={0.5} 
                     max={2.0} 
                     step={0.1} 
                     onChange={(v: number) => setFormData({...formData, tts: {...formData.tts, pace: v}})} 
                     sub="Standard: 1.0x" 
                   />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="card-vapi space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Neural Registry Linking</h3>
                      <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">Connect external intelligence nodes.</p>
                    </div>
                    <button onClick={() => navigate('/tools')} className="btn-outline !py-2 text-[9px]">Marketplace</button>
                  </div>

                  {availableTools.length === 0 ? (
                    <div className="p-20 text-center border border-dashed border-white/5 rounded-[2.5rem] bg-zinc-950/20">
                      <Command size={48} className="mx-auto text-zinc-800 mb-6" />
                      <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest italic">Registry Empty</p>
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
                            className={`p-4 rounded-xl border text-left transition-all duration-300 group relative ${
                              isSelected 
                                ? 'bg-primary/5 border-primary/40 shadow-2xl shadow-primary/10' 
                                : 'bg-zinc-950/50 border-white/5 hover:border-white/10 hover:bg-zinc-900'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-zinc-800 text-zinc-600'}`}>
                                <Code size={16} />
                              </div>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                            </div>
                            <h4 className="text-[11px] font-black text-white uppercase tracking-widest mb-0.5 leading-none">{tool.name}</h4>
                            <p className="text-[9px] text-zinc-600 line-clamp-1 font-medium italic">{tool.description || 'Forge module.'}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}

            {step === 4 && (
              <div className="card-vapi space-y-12 animate-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Audio Signal Processing</h3>
                    <div className="text-[10px] font-black text-amber-500 px-4 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/20">PRO CONTROLS</div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                    <SensitivitySlider label="Activation Logic" value={formData.vad.activation_threshold} min={0.1} max={0.9} step={0.05} onChange={(v: number) => setFormData({...formData, vad: {...formData.vad, activation_threshold: v}})} sub="Standard: 0.5" />
                    <SensitivitySlider label="Speech Resilience" value={formData.vad.min_speech_duration} min={0.05} max={1.0} step={0.05} onChange={(v: number) => setFormData({...formData, vad: {...formData.vad, min_speech_duration: v}})} sub="Standard: 0.3s" />
                    <SensitivitySlider label="Silence Tolerance" value={formData.vad.min_silence_duration} min={0.1} max={3.0} step={0.1} onChange={(v: number) => setFormData({...formData, vad: {...formData.vad, min_silence_duration: v}})} sub="Standard: 0.8s" />
                    <SensitivitySlider label="Signal Padding" value={formData.vad.padding_duration} min={0.05} max={1.0} step={0.05} onChange={(v: number) => setFormData({...formData, vad: {...formData.vad, padding_duration: v}})} sub="Standard: 0.1s" />
                  </div>

                  <div className="p-6 bg-zinc-950 border border-white/5 rounded-[2rem] flex gap-5">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500 shrink-0">
                       <Info size={18} />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-bold uppercase tracking-widest italic pt-1">VAD protocols directly impact neural latency. Increased values improve stability but add delay.</p>
                  </div>
              </div>
            )}
          </div>

          {/* WIZARD FOOTER */}
          <div className="mt-8 flex justify-between items-center py-4 border-t border-white/5 sticky bottom-0 bg-background/50 backdrop-blur-xl">
             {step === 1 ? (
               <button 
                 onClick={() => navigate('/agents')}
                 className="btn-outline !h-10 !px-6 text-[10px] hover:border-red-500/20 hover:text-red-500 transition-colors"
               >
                 Cancel
               </button>
             ) : (
               <button 
                 onClick={() => setStep(s => Math.max(1, s - 1))}
                 className="btn-outline !h-10 !px-6 text-[10px]"
               >
                 Back Protocol
               </button>
             )}
             <button 
               onClick={() => {
                 if (step === 1 && !formData.agentName.trim()) return toast.error("Assistant name required");
                 if (step < 4) setStep(s => s + 1);
                 else handleSave(true);
               }}
               className="btn-vapi !px-10 h-10 text-[10px]"
             >
               {step < 4 ? 'Next Stage' : 'Forge & Launch'}
             </button>
          </div>
        </div>

        {/* PERSISTENT PREVIEW */}
        <div className="xl:col-span-4">
          <div className="card-vapi bg-zinc-900 border-white/5 !p-8 sticky top-24 shadow-2xl space-y-8">
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-24 h-24 rounded-2xl bg-zinc-800 flex items-center justify-center text-5xl shadow-inner border border-white/5 transition-transform duration-500 hover:rotate-6">
                 {BLUEPRINTS.find(b => b.name === formData.agentName)?.icon || '🤖'}
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">{formData.agentName || 'Identity Void'}</h3>
                <span className="text-[9px] font-black text-primary px-3 py-1 bg-primary/10 border border-primary/20 rounded-md inline-block tracking-widest uppercase mb-1">Link Protocol Ready</span>
              </div>
            </div>

            <div className="space-y-6 pt-2">
              <StatItem label="Intelligence" value={formData.llm.model.substring(0, 15)} progress={90} color="bg-primary" />
              <StatItem label="Vocal" value={formData.tts.voice} progress={75} color="bg-primary" />
              <StatItem label="Behavior" value={`${formData.llm.temperature} Temp`} progress={formData.llm.temperature * 50} color="bg-primary" />
            </div>

            <div className="divider h-px bg-white/5" />

            <div className="space-y-5">
               <FeatureIcon icon={<Shield size={16} className="text-emerald-500" />} label="Isolated Neural Hub" />
               <FeatureIcon icon={<Activity size={16} className="text-primary" />} label="Real-time VAD Pipeline" />
               <FeatureIcon icon={<Command size={16} className="text-indigo-500" />} label="Autonomous Tool Logic" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfigGroup = ({ label, value, options, labels, onChange }: any) => (
  <div className="space-y-2.5">
    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest ml-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className="input-vapi w-full !bg-zinc-950 text-xs font-semibold h-11">
      {options.map((o: any, i: number) => (
        <option key={o} value={o}>{labels ? labels[i] : o}</option>
      ))}
    </select>
  </div>
);

const ProPanel = ({ label, icon, children }: any) => (
  <div className="bg-zinc-900/40 p-6 rounded-2xl border border-white/5 space-y-6">
    <div className="flex items-center gap-2.5 mb-1 font-black text-white text-[11px] uppercase tracking-widest leading-none">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/15">{icon}</div>
      {label}
    </div>
    {children}
  </div>
);

const SensitivitySlider = ({ label, value, min, max, step, onChange, sub }: any) => (
  <div className="space-y-4">
    <div className="flex justify-between items-end px-1">
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full h-1 bg-white/5 rounded-full appearance-none accent-primary cursor-pointer" />
    <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-tighter ml-1">{sub}</span>
  </div>
);

const StatItem = ({ label, value, progress, color }: any) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-[10px] font-bold">
      <span className="text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className="text-white">{value}</span>
    </div>
    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${progress}%` }} />
    </div>
  </div>
);

const FeatureIcon = ({ icon, label }: any) => (
  <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] italic">
    {icon} <span>{label}</span>
  </div>
);

export default CreateAgentPage;
