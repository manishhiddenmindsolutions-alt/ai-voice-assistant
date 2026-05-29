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
import api, { numbersApi, callsApi, telephonyApi, agentApi, twilioApi } from '../services/api';
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

  const handleDeleteNumber = async (numberId: string) => {
    const toastId = toast.loading('Removing number...');
    try {
      await numbersApi.delete(numberId);
      toast.success('PSTN number removed from registry.', { id: toastId });
      fetchTelephonyData();
    } catch (err) {
      toast.error('Failed to delete number', { id: toastId });
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
      // ALWAYS route outbound calls via Twilio REST API + LiveKit SIP Bridge for 100% trial-safe reliability
      await twilioApi.outbound({
        to_number: targetNumber,
        agent_id: selectedAgentId
      });
      toast.success('Outbound call initiated via Twilio & LiveKit Bridge.');
      fetchTelephonyData();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Outbound call dispatch failed';
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
        <div>
          <div className="mb-5">
            <BackButton fallbackPath="/" label="Overview" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Telephony Hub
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Enterprise Inbound & Outbound Calling</p>
          </div>
        </div>

        {/* HIGH-END NAVIGATION TABS */}
        <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900/80 self-start lg:self-auto shadow-inner relative">
          <button
            onClick={() => setActiveTab('gateways')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 relative z-10 ${
              activeTab === 'gateways'
                ? 'bg-gradient-to-r from-zinc-900 to-zinc-900/80 text-red-500 border border-zinc-800/80'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Server size={13} className={activeTab === 'gateways' ? 'text-red-500' : 'text-zinc-500'} />
            Call Center
          </button>
          <button
            onClick={() => setActiveTab('twilio')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 relative z-10 ${
              activeTab === 'twilio'
                ? 'bg-gradient-to-r from-zinc-900 to-zinc-900/80 text-red-500 border border-zinc-800/80'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Key size={13} className={activeTab === 'twilio' ? 'text-red-500' : 'text-zinc-500'} />
            SIP Gateways
          </button>
        </div>
      </div>

      {activeTab === 'gateways' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Outbound Dialer Column */}
          <div className="lg:col-span-2 space-y-8">
            <div className="relative overflow-hidden rounded-3xl border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-xl p-6 transition-all duration-300 hover:border-zinc-800/40 group">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
              <div className="absolute -right-20 -top-20 w-40 h-40 bg-red-500/5 rounded-full blur-3xl pointer-events-none transition-all duration-500 group-hover:bg-red-500/10" />
              
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-6 flex items-center gap-3">
                <div className="p-2.5 bg-red-500/10 rounded-xl text-red-400 border border-red-500/10">
                  <PhoneOutgoing size={15} />
                </div>
                Outbound Dispatch Control
              </h2>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Target Persona</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-zinc-950/60 border border-zinc-900 rounded-xl h-12 px-4 text-sm font-semibold text-zinc-200 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all cursor-pointer appearance-none"
                        value={selectedAgentId}
                        onChange={e => setSelectedAgentId(e.target.value)}
                      >
                        <option value="" className="bg-zinc-950 text-zinc-400">Select Voice Agent...</option>
                        {agents.map(a => (
                          <option key={a.id} value={a.id} className="bg-zinc-950 text-zinc-200">{a.agentName}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                        <MoreVertical size={14} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Destination Number (PSTN Node)</label>
                    <input 
                      className="w-full bg-zinc-950/60 border border-zinc-900 rounded-xl h-12 px-4 text-sm font-mono text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-zinc-700"
                      placeholder="+91 XXXXX XXXXX"
                      value={targetNumber}
                      onChange={e => setTargetNumber(e.target.value)}
                    />
                  </div>
                </div>

                {/* Highly Reassuring Status Banner */}
                <div className="flex items-center gap-3.5 p-4 bg-zinc-950/80 border border-zinc-900/60 rounded-2xl shadow-inner">
                  {telephonyStatus?.outbound_active ? (
                    <>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                        <CheckCircle2 size={12} strokeWidth={2.5} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Outbound Bridge Active</p>
                        <p className="text-[9px] text-zinc-500 leading-tight">Ready for highly reliable Twilio & LiveKit hybrid call dispatch.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
                        <AlertCircle size={12} strokeWidth={2.5} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">REST Outbound Active</p>
                        <p className="text-[9px] text-zinc-500 leading-tight">Standard Twilio REST Direct Dialer active for trial number testing.</p>
                      </div>
                    </>
                  )}
                </div>
                
                <button 
                  onClick={handleTriggerCall}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold h-12 rounded-xl shadow-[0_4px_20px_rgba(220,38,38,0.15)] hover:shadow-[0_4px_25px_rgba(220,38,38,0.25)] transition-all duration-300 uppercase tracking-widest text-xs flex items-center justify-center gap-2.5 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
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
            <div className="rounded-3xl border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-xl p-6">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-6 flex items-center gap-3">
                 <div className="p-2.5 bg-zinc-900 border border-zinc-800/80 rounded-xl text-zinc-400">
                  <History size={15} />
                </div>
                Dispatch Node Logs
              </h2>
              <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                {calls.length === 0 ? (
                  <div className="py-12 text-center text-xs font-semibold text-zinc-600 uppercase tracking-widest border border-dashed border-zinc-900 rounded-2xl bg-zinc-950/10">
                    No Active Node History
                  </div>
                ) : calls.map(call => {
                  const statusColors: Record<string, string> = {
                    initiated: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
                    connecting: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                  };
                  const statusColor = statusColors[call.status.toLowerCase()] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
                  
                  return (
                    <div key={call.id} className="flex items-center justify-between p-4.5 bg-zinc-950/60 border border-zinc-900/60 rounded-2xl hover:border-zinc-800 hover:bg-zinc-950 transition-all duration-300 group">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-zinc-900 rounded-xl text-red-500 border border-zinc-800/80 group-hover:bg-red-500 group-hover:text-white group-hover:border-red-500 transition-all duration-300">
                          <Phone size={15} />
                        </div>
                        <div className="space-y-1">
                          <p className="font-mono text-sm font-bold text-zinc-200 tracking-wide leading-none">{call.to_number}</p>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider leading-none mt-1">
                            {new Date(call.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 border text-[9px] rounded-lg font-bold uppercase tracking-wider flex items-center gap-1.5 ${statusColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${call.status.toLowerCase() === 'initiated' ? 'bg-emerald-400 animate-pulse' : 'bg-current'}`} />
                          {call.status}
                        </span>
                        <button className="text-zinc-650 hover:text-zinc-400 transition-colors">
                          <MoreVertical size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Numbers list Column */}
          <div className="space-y-8">
             <div className="rounded-3xl border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">PSTN Registry</h2>
                  <button 
                      onClick={() => setIsAdding(true)}
                      className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-zinc-100 border border-zinc-850 rounded-xl transition-all"
                      title="Link Phone Number"
                  >
                      <Plus size={15} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-1">
                  {numbers.length === 0 ? (
                    <div className="py-12 text-center text-xs font-semibold text-zinc-600 uppercase tracking-widest border border-dashed border-zinc-900 rounded-2xl bg-zinc-950/10">
                      No Registered Numbers
                    </div>
                  ) : numbers.map(num => {
                    const assignedAgent = agents.find(a => a.id === num.agent_id);
                    return (
                      <div key={num.id} className="p-4.5 bg-zinc-950/60 rounded-2xl border border-zinc-900 flex justify-between items-center group hover:border-zinc-800/80 hover:bg-zinc-950/80 transition-all duration-300">
                        <div className="space-y-2">
                          <p className="font-mono font-bold text-zinc-200 tracking-wider text-sm">{num.number}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest bg-zinc-900 border border-zinc-800/60 px-2 py-0.5 rounded-md">
                              {num.provider}
                            </span>
                            {assignedAgent && (
                              <span className="text-[8px] text-red-400 font-extrabold uppercase tracking-widest bg-red-500/5 border border-red-500/10 px-2 py-0.5 rounded-md">
                                → {assignedAgent.agentName}
                              </span>
                            )}
                            {num.sip_trunk_id ? (
                              <span className="text-[8px] text-emerald-400 font-extrabold uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-md">
                                SIP ACTIVE
                              </span>
                            ) : (
                              <span className="text-[8px] text-zinc-650 font-extrabold uppercase tracking-widest bg-zinc-900/40 border border-zinc-850 px-2 py-0.5 rounded-md">
                                NO TRUNK
                              </span>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteNumber(num.id)}
                          className="text-zinc-650 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 hover:bg-red-500/5 rounded-lg border border-transparent hover:border-red-500/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
             </div>
          </div>
        </div>
      ) : (
        /* LIVEKIT SIP TRUNK CONFIGURATION HUB */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
          <div className="lg:col-span-2 space-y-8">
            {/* LiveKit SIP Trunk Provisioning */}
            <div className="relative overflow-hidden rounded-3xl border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-xl p-6">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/10 to-transparent" />
              
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-6 flex items-center gap-3">
                <div className="p-2.5 bg-red-500/10 rounded-xl text-red-400 border border-red-500/10">
                  <Zap size={15} />
                </div>
                LiveKit SIP Trunk Manager
              </h2>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio SIP Termination URI</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-950/60 border border-zinc-900 rounded-xl h-12 px-4 text-sm font-mono text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-zinc-700"
                      placeholder="e.g. my-trunk.pstn.twilio.com"
                      value={sipConfig.termination_uri}
                      onChange={e => setSipConfig({...sipConfig, termination_uri: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Trunk Identifier Name</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-950/60 border border-zinc-900 rounded-xl h-12 px-4 text-sm text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-zinc-700"
                      placeholder="e.g. twilio-outbound-trunk"
                      value={sipConfig.trunk_name}
                      onChange={e => setSipConfig({...sipConfig, trunk_name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">SIP Registration Username</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-950/60 border border-zinc-900 rounded-xl h-12 px-4 text-sm text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-zinc-700"
                      placeholder="e.g. twilio-trunk-user"
                      value={sipConfig.auth_username}
                      onChange={e => setSipConfig({...sipConfig, auth_username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">SIP Registration Password</label>
                    <input 
                      type="password"
                      className="w-full bg-zinc-950/60 border border-zinc-900 rounded-xl h-12 px-4 text-sm text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-zinc-700"
                      placeholder="e.g. twilio-secure-password"
                      value={sipConfig.auth_password}
                      onChange={e => setSipConfig({...sipConfig, auth_password: e.target.value})}
                    />
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500 leading-relaxed font-semibold">
                  Registered E.164 numbers ({numbers.length} active nodes) will route through this gateway configuration dynamically on the SIP network.
                </p>

                <button 
                  onClick={handleProvisionTrunks}
                  disabled={provisioningTrunks}
                  className="w-full bg-gradient-to-r from-zinc-900 to-zinc-950 text-zinc-100 hover:text-white border border-zinc-800/80 hover:border-red-500/30 font-bold h-12 rounded-xl shadow-md transition-all duration-300 uppercase tracking-widest text-xs flex items-center justify-center gap-2 mt-2 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {provisioningTrunks ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <Zap size={14} strokeWidth={2.5} className="text-red-400 animate-pulse" />
                      Provision Native SIP Gateways
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Active Gateways List */}
            {trunks.length > 0 && (
              <div className="rounded-3xl border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-xl p-6 shadow-2xl">
                <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-6 flex items-center gap-3">
                  <div className="p-2.5 bg-zinc-900 border border-zinc-800/80 rounded-xl text-zinc-400">
                    <Link2 size={15} />
                  </div>
                  Provisioned Endpoints
                </h2>
                <div className="space-y-3.5">
                  {trunks.map(trunk => (
                    <div key={trunk.id} className="p-4 bg-zinc-950/60 border border-zinc-900 rounded-2xl flex justify-between items-center group hover:border-zinc-800/80 transition-all duration-300 shadow-sm">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-bold text-zinc-100 leading-tight">{trunk.name}</p>
                          <span className={`text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${
                            trunk.trunk_type === 'inbound' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {trunk.trunk_type}
                          </span>
                          <span className="text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
                            Registered
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-650 font-mono leading-none">{trunk.livekit_trunk_id || trunk.id}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteTrunk(trunk.id)}
                        className="text-zinc-650 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 rounded-xl"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Twilio REST API Credentials */}
            <div className="rounded-3xl border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-xl p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-6 flex items-center gap-3">
                <div className="p-2.5 bg-red-500/10 rounded-xl text-red-400 border border-red-500/10">
                  <Key size={15} />
                </div>
                Twilio Account Credentials (REST)
              </h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Account SID</label>
                    <input 
                      type="text" 
                      className="w-full bg-zinc-950/60 border border-zinc-900 rounded-xl h-12 px-4 text-sm text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-zinc-700" 
                      placeholder="ACXXXXXXXX" 
                      value={twilioKeys.twilio_account_sid} 
                      onChange={e => setTwilioKeys({...twilioKeys, twilio_account_sid: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Assigned Number</label>
                    <input 
                      type="text" 
                      className="w-full bg-zinc-950/60 border border-zinc-900 rounded-xl h-12 px-4 text-sm font-mono text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-zinc-700" 
                      placeholder="+1234567890" 
                      value={twilioKeys.twilio_phone_number} 
                      onChange={e => setTwilioKeys({...twilioKeys, twilio_phone_number: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Twilio Auth Token</label>
                    <input 
                      type="password" 
                      className="w-full bg-zinc-950/60 border border-zinc-900 rounded-xl h-12 px-4 text-sm text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-zinc-700" 
                      placeholder="vaulted auth token" 
                      value={twilioKeys.twilio_auth_token} 
                      onChange={e => setTwilioKeys({...twilioKeys, twilio_auth_token: e.target.value})} 
                    />
                  </div>
                </div>
                <button 
                  onClick={handleSaveTwilioKeys} 
                  disabled={savingKeys} 
                  className="w-full bg-gradient-to-r from-zinc-900 to-zinc-950 text-zinc-100 hover:text-white border border-zinc-800/80 hover:border-red-500/30 font-bold h-12 rounded-xl shadow-md transition-all duration-300 uppercase tracking-widest text-xs flex items-center justify-center gap-2 mt-2 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {savingKeys ? <Loader2 className="animate-spin" size={16} /> : <><ShieldCheck size={14} strokeWidth={2.5} /> Sync Twilio Profile</>}
                </button>
              </div>
            </div>
          </div>

          {/* SETUP INSTRUCTIONS SIDEBAR */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-900/80 bg-zinc-950/40 backdrop-blur-xl p-6 shadow-2xl">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest mb-6 flex items-center gap-3">
                <div className="p-2.5 bg-red-500/10 rounded-xl text-red-400 border border-red-500/10">
                  <ToggleLeft size={15} />
                </div>
                SIP Routing Hook
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Direct your incoming Twilio traffic to our LiveKit SIP bridge gateway to answer dynamically:
              </p>

              <div className="space-y-5">
                <div className="space-y-2">
                  <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest block mb-1">Twilio Inbound Webhook</span>
                  <div className="flex bg-zinc-950/60 rounded-xl border border-zinc-900/80 p-3.5 items-center justify-between shadow-inner">
                    <span className="font-mono text-[9px] text-zinc-400 truncate max-w-[200px]">
                      {resolveWebhookUrl('/inbound')}
                    </span>
                    <button
                      onClick={() => handleCopy(resolveWebhookUrl('/inbound'), 'Twilio Webhook')}
                      className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 ml-2"
                    >
                      {copiedText === 'Twilio Webhook' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest block mb-1">LiveKit SIP Origination URI</span>
                  <div className="flex bg-zinc-950/60 rounded-xl border border-zinc-900/80 p-3.5 items-center justify-between shadow-inner">
                    <span className="font-mono text-[9px] text-zinc-400 truncate max-w-[200px]">
                      {telephonyStatus?.setup_instructions?.origination_uri || 'sip:70gad9nw.sip.livekit.cloud;transport=tcp'}
                    </span>
                    <button
                      onClick={() => handleCopy(telephonyStatus?.setup_instructions?.origination_uri || 'sip:70gad9nw.sip.livekit.cloud;transport=tcp', 'Origination URI')}
                      className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 ml-2"
                    >
                      {copiedText === 'Origination URI' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-900/80 pt-6">
                  <div className="text-[10px] text-zinc-450 leading-relaxed space-y-4 font-semibold">
                    <strong className="text-zinc-200 uppercase tracking-widest text-[9px] block mb-2">Instructions:</strong>
                    <div className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-2xl">
                      <strong className="text-red-400 block mb-1">Method A: Webhook routing (Fastest)</strong>
                      <p className="text-zinc-500 leading-normal text-[9px]">
                        1. Copy the webhook URL above.<br />
                        2. Paste it in your Twilio Console under Phone Number &rarr; Voice Config &rarr; Webhook.<br />
                        3. Test inbound calling immediately!
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-2xl">
                      <strong className="text-emerald-400 block mb-1">Method B: SIP Trunking (Trunk Core)</strong>
                      <p className="text-zinc-500 leading-normal text-[9px]">
                        1. Copy the LiveKit SIP Origination URI.<br />
                        2. Paste it in your Twilio Elastic SIP Trunk Origination.<br />
                        3. Add SIP Gateways on the left to verify active auth handshakes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LINK PHONE NUMBER MODAL */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-900 w-full max-w-[390px] rounded-3xl p-7 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Link PSTN Endpoint</h2>
              <button onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-zinc-250 p-1.5 hover:bg-zinc-900 rounded-xl transition-all">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">E.164 Phone Number</label>
                <input 
                  className="w-full h-11 bg-zinc-900/60 border border-zinc-850 rounded-xl px-4 text-sm font-mono text-zinc-100 outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10 placeholder:text-zinc-700 transition-all"
                  placeholder="+1..."
                  value={newNumber.number}
                  onChange={e => setNewNumber({...newNumber, number: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Provider Node Gateway</label>
                <div className="relative">
                  <select 
                    className="w-full bg-zinc-900/60 border border-zinc-850 rounded-xl h-11 px-4 text-sm font-semibold text-zinc-200 outline-none focus:border-red-500/60 transition-all cursor-pointer appearance-none"
                    value={newNumber.provider}
                    onChange={e => setNewNumber({...newNumber, provider: e.target.value})}
                  >
                    <option value="twilio" className="bg-zinc-950 text-zinc-200">Twilio Node Gateway</option>
                    <option value="custom" className="bg-zinc-950 text-zinc-200">Generic Custom SIP Node</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                    <MoreVertical size={13} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Assigned Voice Agent (Inbound)</label>
                <div className="relative">
                  <select 
                    className="w-full bg-zinc-900/60 border border-zinc-850 rounded-xl h-11 px-4 text-sm font-semibold text-zinc-200 outline-none focus:border-red-500/60 transition-all cursor-pointer appearance-none"
                    value={newNumber.agent_id}
                    onChange={e => setNewNumber({...newNumber, agent_id: e.target.value})}
                  >
                    <option value="" className="bg-zinc-950 text-zinc-400">No Agent (Disable Inbound)</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id} className="bg-zinc-950 text-zinc-200">{a.agentName}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                    <MoreVertical size={13} />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleAddNumber}
                disabled={loading}
                className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold h-11 rounded-xl transition-all duration-300 uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : (
                  <>
                    <Smartphone size={14} strokeWidth={2.5} />
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
