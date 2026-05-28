import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  PhoneOutgoing, 
  History, 
  MoreVertical, 
  Plus, 
  Trash2, 
  Smartphone, 
  Loader2, 
  X, 
  Key, 
  Server, 
  Copy, 
  Check,
  ShieldCheck,
  ToggleLeft,
  Zap,
  Link2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import api, { numbersApi, callsApi, telephonyApi, agentApi, freeswitchApi } from '../services/api';
import { useAgentStore } from '../store/useAgentStore';
import toast from 'react-hot-toast';
import { BackButton } from './BackButton';

interface Number {
  id: string;
  number: string;
  provider: string;
  agent_id?: string;
  sip_trunk_id?: string;
}

interface Call {
  id: string;
  session_id: string;
  status: string;
  started_at: string;
  to_number: string;
}

export const TelephonyPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'gateways' | 'twilio'>('gateways');
  const [numbers, setNumbers] = useState<Number[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // Link Number State
  const [newNumber, setNewNumber] = useState({ 
    number: '', 
    provider: 'twilio', 
    agent_id: '' 
  });
  
  // Outbound State
  const [targetNumber, setTargetNumber] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  
  // SIP Trunk Provisioning State
  const [sipConfig, setSipConfig] = useState({
    termination_uri: '',
    auth_username: '',
    auth_password: '',
    trunk_name: ''
  });
  const [trunks, setTrunks] = useState<any[]>([]);
  const [telephonyStatus, setTelephonyStatus] = useState<any>(null);
  
  // Legacy Twilio Secrets State
  const [twilioKeys, setTwilioKeys] = useState({
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [provisioningTrunks, setProvisioningTrunks] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  const { agents } = useAgentStore();

  const fetchTelephonyData = async () => {
    try {
      const [numResp, callResp, agentsResp] = await Promise.all([
        numbersApi.list(),
        callsApi.list(),
        agentApi.list()
      ]);
      setNumbers(numResp.data || []);
      setCalls(callResp.data?.calls || []);
      useAgentStore.getState().setAgents(agentsResp.data || []);
    } catch (err) {
      console.error("Failed to fetch telephony data", err);
    }
  };

  const fetchTrunks = async () => {
    try {
      const [trunkResp, statusResp] = await Promise.all([
        telephonyApi.listTrunks(),
        telephonyApi.status()
      ]);
      setTrunks(trunkResp.data);
      setTelephonyStatus(statusResp.data);
    } catch (err) {
      console.error("Failed to fetch trunk data", err);
    }
  };

  const fetchTwilioKeys = async () => {
    try {
      const resp = await api.get('/keys/');
      const keys = resp.data.keys || {};
      setTwilioKeys({
        twilio_account_sid: keys.twilio_account_sid || '',
        twilio_auth_token: keys.twilio_auth_token || '',
        twilio_phone_number: keys.twilio_phone_number || ''
      });
    } catch (err) {
      console.error("Failed to fetch Twilio secrets profile", err);
    }
  };

  useEffect(() => {
    fetchTelephonyData();
    fetchTrunks();
    fetchTwilioKeys();
  }, []);

  const handleAddNumber = async () => {
    if (!newNumber.number.trim()) {
      toast.error('E.164 phone number required');
      return;
    }
    setLoading(true);
    try {
      await numbersApi.create(newNumber);
      setIsAdding(false);
      setNewNumber({ number: '', provider: 'twilio', agent_id: '' });
      fetchTelephonyData();
      toast.success('Number successfully registered in PSTN registry.');
    } catch (err) {
      toast.error('Link registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTwilioKeys = async () => {
    setSavingKeys(true);
    try {
      await api.post('/keys/', twilioKeys);
      toast.success('Twilio credentials successfully updated & vaulted.');
      fetchTwilioKeys();
    } catch (err) {
      toast.error('Failed to save secure profile credentials.');
    } finally {
      setSavingKeys(false);
    }
  };

  const handleTriggerCall = async () => {
    if (!selectedAgentId) {
      toast.error('Please select an active voice agent');
      return;
    }
    if (!targetNumber.trim()) {
      toast.error('Target customer phone number required');
      return;
    }
    
    setLoading(true);
    try {
      // Primary: Route outbound call via native FreeSWITCH Event Socket Gateway
      await freeswitchApi.outbound({
        to_number: targetNumber,
        agent_id: selectedAgentId,
        gateway: 'Sophia'
      });
      toast.success('Outbound call initiated via FreeSWITCH Gateway.');
      fetchTelephonyData();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'FreeSWITCH outbound dispatch failed';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleProvisionTrunks = async () => {
    if (!sipConfig.termination_uri.trim()) {
      toast.error('Twilio SIP Termination URI is required');
      return;
    }
    if (!sipConfig.auth_username.trim() || !sipConfig.auth_password.trim()) {
      toast.error('SIP authentication credentials are required');
      return;
    }
    
    // Collect phone numbers from the PSTN registry
    const phoneNumbers = numbers.map(n => n.number);
    if (phoneNumbers.length === 0) {
      toast.error('Register at least one phone number in the PSTN Registry first');
      return;
    }

    setProvisioningTrunks(true);
    try {
      await telephonyApi.provisionTrunks({
        termination_uri: sipConfig.termination_uri,
        auth_username: sipConfig.auth_username,
        auth_password: sipConfig.auth_password,
        phone_numbers: phoneNumbers,
        trunk_name: sipConfig.trunk_name || undefined,
      });
      toast.success('SIP trunks provisioned successfully!');
      fetchTrunks();
      setSipConfig({ termination_uri: '', auth_username: '', auth_password: '', trunk_name: '' });
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Trunk provisioning failed';
      toast.error(errMsg);
    } finally {
      setProvisioningTrunks(false);
    }
  };

  const handleDeleteTrunk = async (trunkId: string) => {
    try {
      await telephonyApi.deleteTrunk(trunkId);
      toast.success('SIP trunk removed.');
      fetchTrunks();
    } catch (err) {
      toast.error('Failed to delete trunk');
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Helper to dynamically resolve public Twilio webhooks in local & production environment
  const resolveWebhookUrl = (path: string) => {
    const origin = window.location.origin;
    const backendBase = origin.includes('localhost') || origin.includes('127.0.0.1')
      ? origin.replace('5173', '8000')
      : origin;
    return `${backendBase}/api/v1/telephony/twilio${path}`;
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-8 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-4 md:gap-5">
          <BackButton fallbackPath="/" label="Overview" />
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wider text-zinc-100 leading-none mb-0">
              Telephony Bridge
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider leading-none">PSTN Gateway Interface</p>
            </div>
          </div>
        </div>

        {/* PREMIUM NAVIGATION TABS */}
        <div className="flex bg-zinc-950/80 p-1 rounded-2xl border border-zinc-850 self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('gateways')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'gateways'
                ? 'bg-zinc-900 text-red-500 border border-zinc-800 shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Server size={13} />
            Active Gateways
          </button>
          <button
            onClick={() => setActiveTab('twilio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'twilio'
                ? 'bg-zinc-900 text-red-500 border border-zinc-800 shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Key size={13} />
            Twilio Config
          </button>
        </div>
      </div>

      {activeTab === 'gateways' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Outbound Dialer Column */}
          <div className="lg:col-span-2 space-y-8">
            <div className="card-vapi relative overflow-hidden group glow-card-primary !p-6 rounded-3xl">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/15 to-transparent" />
              
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-6 flex items-center gap-2.5">
                <div className="p-2 bg-red-500/10 rounded-xl text-red-500">
                  <PhoneOutgoing size={15} />
                </div>
                Outbound Dialer
              </h2>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Target Persona</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm font-semibold text-zinc-205 outline-none focus:border-red-500 transition-all cursor-pointer"
                      value={selectedAgentId}
                      onChange={e => setSelectedAgentId(e.target.value)}
                    >
                      <option value="">Select Voice Agent...</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.agentName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Destination Number (PSTN Node)</label>
                    <input 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm font-mono text-zinc-200 outline-none focus:border-red-500 transition-all placeholder:text-zinc-700"
                      placeholder="+91 XXXXX XXXXX"
                      value={targetNumber}
                      onChange={e => setTargetNumber(e.target.value)}
                    />
                  </div>
                </div>

                {/* SIP Trunk Status Indicator */}
                <div className="flex items-center gap-3 p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                  {telephonyStatus?.outbound_active ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">SIP Trunk Active — Outbound via LiveKit</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} className="text-amber-400 shrink-0" />
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">No SIP Trunk — Using Twilio REST Fallback</span>
                    </>
                  )}
                </div>
                
                <button 
                  onClick={handleTriggerCall}
                  disabled={loading}
                  className="btn-vapi w-full h-11 rounded-xl shadow-xs transition-all duration-300 font-bold uppercase tracking-wider text-xs gap-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <Smartphone size={15} strokeWidth={2.5} />
                      Execute Outbound Dispatch
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Calls log */}
            <div className="card-vapi glow-card-primary !p-6 rounded-3xl">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-6 flex items-center gap-2.5">
                 <div className="p-2 bg-zinc-900 border border-zinc-850 rounded-xl text-zinc-400">
                  <History size={15} />
                </div>
                Node Activity Logs
              </h2>
              <div className="space-y-3">
                {calls.length === 0 ? (
                  <div className="py-10 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider border border-dashed border-zinc-800 rounded-3xl bg-zinc-950/20">
                    No Active Node History
                  </div>
                ) : calls.map(call => (
                  <div key={call.id} className="flex items-center justify-between p-5 bg-zinc-950/20 border border-zinc-900 rounded-3xl hover:border-zinc-800 hover:-translate-y-0.5 transition-all duration-300 group shadow-xs">
                    <div className="flex items-center gap-4.5">
                      <div className="p-2.5 bg-zinc-900 rounded-xl text-red-500 border border-zinc-850 group-hover:bg-red-650 group-hover:text-white group-hover:border-red-500 transition-all duration-350 shadow-xs">
                        <Phone size={16} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-mono text-base font-semibold text-zinc-100 leading-tight">{call.to_number}</p>
                        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mt-0.5">{new Date(call.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="px-2.5 py-0.5 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] rounded-lg font-bold uppercase tracking-wider">
                        {call.status}
                      </span>
                      <button className="text-zinc-500 hover:text-zinc-200 transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Numbers list Column */}
          <div className="space-y-8">
             <div className="card-vapi glow-card-primary !p-6 rounded-3xl">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">PSTN Registry</h2>
                  <button 
                      onClick={() => setIsAdding(true)}
                      className="p-2 bg-zinc-900 text-zinc-200 rounded-xl hover:bg-zinc-850 hover:text-zinc-100 border border-zinc-800 transition-all shadow-xs"
                      title="Link Phone Number"
                  >
                      <Plus size={16} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="space-y-3">
                  {numbers.length === 0 ? (
                    <div className="py-8 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider border border-dashed border-zinc-800 rounded-3xl bg-zinc-950/20">
                      No Registered Numbers
                    </div>
                  ) : numbers.map(num => {
                    const assignedAgent = agents.find(a => a.id === num.agent_id);
                    return (
                      <div key={num.id} className="p-5 bg-zinc-950/20 rounded-3xl border border-zinc-900 flex justify-between items-center group hover:border-zinc-800 hover:-translate-y-0.5 transition-all duration-300 shadow-xs">
                        <div className="space-y-1">
                          <p className="font-mono font-semibold text-zinc-100 tracking-wide text-sm">{num.number}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded">
                              {num.provider}
                            </span>
                            {assignedAgent && (
                              <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider bg-red-500/5 border border-red-500/10 px-1.5 py-0.5 rounded">
                                → {assignedAgent.agentName}
                              </span>
                            )}
                            {num.sip_trunk_id ? (
                              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                                SIP ✓
                              </span>
                            ) : (
                              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded">
                                No Trunk
                              </span>
                            )}
                          </div>
                        </div>
                         <button className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
             </div>
          </div>
        </div>
      ) : (
        /* FreeSWITCH GATEWAY CONFIGURATION HUB */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* FreeSWITCH Gateway Provisioning */}
            <div className="card-vapi relative overflow-hidden group glow-card-primary !p-6 rounded-3xl">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/15 to-transparent" />
              
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-6 flex items-center gap-2.5">
                <div className="p-2 bg-red-500/10 rounded-xl text-red-500">
                  <Zap size={15} />
                </div>
                FreeSWITCH Gateway Settings
              </h2>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">FreeSWITCH Proxy IP/Domain</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm font-mono text-zinc-200 outline-none focus:border-red-500 transition-all placeholder:text-zinc-700"
                      placeholder="e.g. 10.0.0.5:5060"
                      value={sipConfig.termination_uri}
                      onChange={e => setSipConfig({...sipConfig, termination_uri: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Gateway Name</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm text-zinc-200 outline-none focus:border-red-500 transition-all placeholder:text-zinc-700"
                      placeholder="e.g. twilio-outbound-gateway"
                      value={sipConfig.trunk_name}
                      onChange={e => setSipConfig({...sipConfig, trunk_name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">SIP Registration Username</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm text-zinc-200 outline-none focus:border-red-500 transition-all placeholder:text-zinc-700"
                      placeholder="e.g. twilio-trunk-user"
                      value={sipConfig.auth_username}
                      onChange={e => setSipConfig({...sipConfig, auth_username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">SIP Registration Password</label>
                    <input 
                      type="password"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm text-zinc-200 outline-none focus:border-red-500 transition-all placeholder:text-zinc-700"
                      placeholder="e.g. twilio-secure-password"
                      value={sipConfig.auth_password}
                      onChange={e => setSipConfig({...sipConfig, auth_password: e.target.value})}
                    />
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Registered E.164 numbers ({numbers.length} nodes active) will route through this gateway configuration dynamically.
                </p>

                <button 
                  onClick={handleProvisionTrunks}
                  disabled={provisioningTrunks}
                  className="btn-vapi w-full h-11 rounded-xl shadow-xs transition-all duration-300 font-bold uppercase tracking-wider text-xs gap-2 mt-2"
                >
                  {provisioningTrunks ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <Zap size={15} strokeWidth={2.5} />
                      Register FreeSWITCH Gateway
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Active Gateways List */}
            {trunks.length > 0 && (
              <div className="card-vapi glow-card-primary !p-6 rounded-3xl">
                <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-5 flex items-center gap-2.5">
                  <div className="p-2 bg-zinc-900 border border-zinc-850 rounded-xl text-zinc-400">
                    <Link2 size={15} />
                  </div>
                  Active Gateways
                </h2>
                <div className="space-y-3">
                  {trunks.map(trunk => (
                    <div key={trunk.id} className="p-4 bg-zinc-950/20 border border-zinc-900 rounded-2xl flex justify-between items-center group hover:border-zinc-800 transition-all duration-300">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-semibold text-zinc-100">{trunk.name}</p>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            trunk.trunk_type === 'inbound' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {trunk.trunk_type}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            trunk.status === 'active'
                              ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10'
                              : 'bg-red-500/5 text-red-400 border border-red-500/10'
                          }`}>
                            Registered
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono">{trunk.livekit_trunk_id || trunk.id}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteTrunk(trunk.id)}
                        className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy Twilio REST Keys (Fallback) */}
            <details className="group">
              <summary className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider cursor-pointer hover:text-zinc-400 transition-colors list-none flex items-center gap-2">
                <Key size={11} />
                Legacy Twilio REST Credentials (Fallback)
                <span className="text-zinc-700 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="card-vapi glow-card-primary !p-6 rounded-3xl mt-3">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Account SID</label>
                      <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm text-zinc-200 outline-none focus:border-red-500 transition-all placeholder:text-zinc-700" placeholder="ACXXXXXXXX" value={twilioKeys.twilio_account_sid} onChange={e => setTwilioKeys({...twilioKeys, twilio_account_sid: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Phone Number</label>
                      <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm font-mono text-zinc-200 outline-none focus:border-red-500 transition-all placeholder:text-zinc-700" placeholder="+1234567890" value={twilioKeys.twilio_phone_number} onChange={e => setTwilioKeys({...twilioKeys, twilio_phone_number: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Auth Token</label>
                      <input type="password" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm text-zinc-200 outline-none focus:border-red-500 transition-all placeholder:text-zinc-700" placeholder="vaulted auth token" value={twilioKeys.twilio_auth_token} onChange={e => setTwilioKeys({...twilioKeys, twilio_auth_token: e.target.value})} />
                    </div>
                  </div>
                  <button onClick={handleSaveTwilioKeys} disabled={savingKeys} className="btn-vapi w-full h-11 rounded-xl shadow-xs transition-all duration-300 font-bold uppercase tracking-wider text-xs gap-2 mt-2">
                    {savingKeys ? <Loader2 className="animate-spin" size={16} /> : <><ShieldCheck size={15} strokeWidth={2.5} /> Sync Twilio Profile</>}
                  </button>
                </div>
              </div>
            </details>
          </div>

          {/* SETUP INSTRUCTIONS SIDEBAR */}
          <div className="space-y-6">
            <div className="card-vapi glow-card-primary !p-6 rounded-3xl">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ToggleLeft className="text-red-500" size={15} />
                FreeSWITCH Setup
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                Configure your FreeSWITCH server to fetch XML Dialplans and stream real-time audio streams:
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">XML Dialplan Server</span>
                  <div className="flex bg-zinc-950 rounded-xl border border-zinc-900 p-3 items-center justify-between shadow-inner">
                    <span className="font-mono text-[9px] text-zinc-400 truncate max-w-[200px]">
                      {telephonyStatus?.freeswitch_dialplan_xml_url || 'http://localhost:8000/api/v1/telephony/freeswitch/dialplan'}
                    </span>
                    <button
                      onClick={() => handleCopy(telephonyStatus?.freeswitch_dialplan_xml_url || 'http://localhost:8000/api/v1/telephony/freeswitch/dialplan', 'Dialplan Server')}
                      className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 ml-2"
                    >
                      {copiedText === 'Dialplan Server' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">WebSocket Audio Media</span>
                  <div className="flex bg-zinc-950 rounded-xl border border-zinc-900 p-3 items-center justify-between shadow-inner">
                    <span className="font-mono text-[9px] text-zinc-400 truncate max-w-[200px]">
                      {telephonyStatus?.freeswitch_media_ws_url || 'ws://localhost:8000/api/v1/telephony/freeswitch/media'}
                    </span>
                    <button
                      onClick={() => handleCopy(telephonyStatus?.freeswitch_media_ws_url || 'ws://localhost:8000/api/v1/telephony/freeswitch/media', 'WebSocket Media')}
                      className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 ml-2"
                    >
                      {copiedText === 'WebSocket Media' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-4">
                  <p className="text-[10px] text-zinc-500 leading-relaxed space-y-2">
                    <strong className="text-zinc-400 block mb-2">Instructions:</strong>
                    <span className="block">1. Enable the <code>mod_xml_curl</code> module in FreeSWITCH modules.conf.</span>
                    <span className="block">2. Set up XML Dialplan directory bindings to point to the Dialplan Server above.</span>
                    <span className="block">3. Load <code>mod_audio_fork</code> to establish real-time low-latency binary streams to the Media WebSocket.</span>
                    <span className="block">4. Inbound calls are auto-directed to the assigned agent dynamically!</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LINK PHONE NUMBER MODAL */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-[380px] rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-base font-bold text-zinc-100 uppercase tracking-wider">Link Phone Number</h2>
              <button onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">E.164 Phone Number</label>
                <input 
                  className="w-full h-11 bg-zinc-900 border border-zinc-850 rounded-xl px-4 text-sm font-mono text-zinc-200 outline-none focus:border-red-500 placeholder:text-zinc-650 transition-all"
                  placeholder="+1..."
                  value={newNumber.number}
                  onChange={e => setNewNumber({...newNumber, number: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Provider Type</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-855 rounded-xl h-11 px-4 text-sm font-semibold text-zinc-200 outline-none focus:border-red-500 transition-all cursor-pointer"
                  value={newNumber.provider}
                  onChange={e => setNewNumber({...newNumber, provider: e.target.value})}
                >
                  <option value="twilio">Twilio Gateway</option>
                  <option value="custom">Generic Custom SIP</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Assigned Voice Agent (Inbound)</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-850 rounded-xl h-11 px-4 text-sm font-semibold text-zinc-200 outline-none focus:border-red-500 transition-all cursor-pointer"
                  value={newNumber.agent_id}
                  onChange={e => setNewNumber({...newNumber, agent_id: e.target.value})}
                >
                  <option value="">No Agent (Disable Inbound)</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.agentName}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleAddNumber}
                disabled={loading}
                className="btn-vapi w-full h-11 rounded-xl mt-2 font-bold uppercase tracking-wider text-xs gap-2 animate-pulse"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : (
                  <>
                    <Smartphone size={15} strokeWidth={2.5} />
                    Register PSTN Node
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
