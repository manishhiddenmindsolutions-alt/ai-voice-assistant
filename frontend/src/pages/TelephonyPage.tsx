import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  Plus, 
  Trash2, 
  Loader2, 
  X, 
  Search,
  Zap,
  Key,
  Copy,
  Check,
  Server,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import api, { numbersApi, agentApi, telephonyApi } from '../services/api';
import { useAgentStore } from '../store/useAgentStore';
import toast from 'react-hot-toast';

interface PhoneNumber {
  id: string;
  number: string;
  provider: string;
  provider_sid?: string;
  agent_id?: string;
  sip_trunk_id?: string;
}

interface SipTrunk {
  id: string;
  name: string;
  inbound_numbers?: string[];
  termination_uri: string;
  trunk_type: string;
  livekit_trunk_id?: string;
}

const TelephonyPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'numbers' | 'sip' | 'settings'>('numbers');
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [telephonyStatus, setTelephonyStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drawer & Form States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Twilio Secrets Vault Form
  const [twilioKeys, setTwilioKeys] = useState({
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: ''
  });
  const [savingKeys, setSavingKeys] = useState(false);

  // SIP trunk provision Form
  const [sipConfig, setSipConfig] = useState({
    termination_uri: '',
    auth_username: '',
    auth_password: '',
    trunk_name: ''
  });
  const [provisioningTrunk, setProvisioningTrunk] = useState(false);

  // Number Import Form
  const [importForm, setImportForm] = useState({
    label: '',
    countryCode: '+1',
    phoneNumber: '',
    twilioSid: '',
    twilioToken: '',
    routingRegion: false
  });

  const { agents, setAgents } = useAgentStore();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [numResp, agentsResp, trunkResp, statusResp, keysResp] = await Promise.all([
        numbersApi.list(),
        agentApi.list(),
        telephonyApi.listTrunks().catch(() => ({ data: [] })),
        telephonyApi.status().catch(() => ({ data: null })),
        api.get('/keys/').catch(() => ({ data: { keys: {} } }))
      ]);

      setNumbers(numResp.data || []);
      setAgents(agentsResp.data || []);
      setTrunks(trunkResp.data || []);
      setTelephonyStatus(statusResp.data || null);

      const keys = keysResp.data.keys || {};
      setTwilioKeys({
        twilio_account_sid: keys.twilio_account_sid || '',
        twilio_auth_token: keys.twilio_auth_token || '',
        twilio_phone_number: keys.twilio_phone_number || ''
      });

      // Load labels
      const savedLabels = localStorage.getItem('hms_phone_labels');
      if (savedLabels) {
        setLabels(JSON.parse(savedLabels));
      }
    } catch (err) {
      console.error("Failed to load telephony data:", err);
      toast.error("Could not load telephony settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImportNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importForm.phoneNumber.trim()) {
      toast.error('Phone number is required');
      return;
    }
    
    setIsImporting(true);
    const fullNumber = `${importForm.countryCode}${importForm.phoneNumber.trim().replace(/\D/g, '')}`;
    
    try {
      if (importForm.twilioSid && importForm.twilioToken) {
        await api.post('/keys/', {
          twilio_account_sid: importForm.twilioSid,
          twilio_auth_token: importForm.twilioToken,
          twilio_phone_number: fullNumber
        });
      }

      const resp = await numbersApi.create({
        number: fullNumber,
        provider: 'twilio',
        provider_sid: importForm.twilioSid || undefined,
        agent_id: ''
      });

      const newNum = resp.data;

      if (importForm.label.trim() && newNum.id) {
        const updatedLabels = { ...labels, [newNum.id]: importForm.label.trim() };
        setLabels(updatedLabels);
        localStorage.setItem('hms_phone_labels', JSON.stringify(updatedLabels));
      }

      toast.success('Phone number imported successfully');
      setIsDrawerOpen(false);
      
      setImportForm({
        label: '',
        countryCode: '+1',
        phoneNumber: '',
        twilioSid: '',
        twilioToken: '',
        routingRegion: false
      });

      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Import failed. Check credentials.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteNumber = async (id: string) => {
    if (!confirm('Are you sure you want to delete this phone number?')) return;
    try {
      await numbersApi.delete(id);
      toast.success('Phone number removed');
      const updatedLabels = { ...labels };
      delete updatedLabels[id];
      setLabels(updatedLabels);
      localStorage.setItem('hms_phone_labels', JSON.stringify(updatedLabels));
      fetchData();
    } catch (err) {
      toast.error('Failed to remove number');
    }
  };

  const handleAssignAgent = async (numberId: string, agentId: string) => {
    try {
      await numbersApi.update(numberId, { agent_id: agentId || null });
      toast.success('Routing target updated');
      fetchData();
    } catch (err) {
      toast.error('Failed to assign agent');
    }
  };

  const handleSaveTwilioKeys = async () => {
    setSavingKeys(true);
    try {
      await api.post('/keys/', twilioKeys);
      toast.success('Twilio vault credentials synchronized');
      fetchData();
    } catch (err) {
      toast.error('Failed to save Twilio credentials');
    } finally {
      setSavingKeys(false);
    }
  };

  const handleProvisionTrunks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sipConfig.termination_uri.trim()) {
      toast.error('SIP termination URI is required');
      return;
    }
    if (!sipConfig.auth_username.trim() || !sipConfig.auth_password.trim()) {
      toast.error('SIP authentication is required');
      return;
    }

    const phoneNumbers = numbers.map(n => n.number);
    if (phoneNumbers.length === 0) {
      toast.error('Please import at least one Phone Number first');
      return;
    }

    setProvisioningTrunk(true);
    try {
      await telephonyApi.provisionTrunks({
        termination_uri: sipConfig.termination_uri,
        auth_username: sipConfig.auth_username,
        auth_password: sipConfig.auth_password,
        phone_numbers: phoneNumbers,
        trunk_name: sipConfig.trunk_name || undefined
      });
      toast.success('SIP trunk provisioned successfully!');
      setSipConfig({ termination_uri: '', auth_username: '', auth_password: '', trunk_name: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Trunk provisioning failed');
    } finally {
      setProvisioningTrunk(false);
    }
  };

  const handleDeleteTrunk = async (trunkId: string) => {
    if (!confirm('Are you sure you want to delete this SIP trunk?')) return;
    try {
      await telephonyApi.deleteTrunk(trunkId);
      toast.success('SIP trunk deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete trunk');
    }
  };

  const handleCopy = (text: string, labelStr: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(labelStr);
    toast.success(`${labelStr} copied`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const resolveWebhookUrl = (path: string) => {
    const origin = window.location.origin;
    const backendBase = origin.includes('localhost') || origin.includes('127.0.0.1')
      ? origin.replace('5173', '8000')
      : origin;
    return `${backendBase}/api/v1/telephony/twilio${path}`;
  };

  const filteredNumbers = numbers.filter(n => {
    const label = labels[n.id] || '';
    const numberStr = n.number || '';
    return label.toLowerCase().includes(searchQuery.toLowerCase()) || 
           numberStr.includes(searchQuery);
  });

  return (
    <div className="space-y-6 text-[var(--text-primary)] relative pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)]">
              <Phone size={18} className="text-white" />
            </div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--text-primary)]">Telephony Hub</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-medium ml-[52px]">Configure numbers, provision SIP gateways, and connect inbound routing rules.</p>
        </div>
        {activeTab === 'numbers' && numbers.length > 0 && (
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer self-start md:self-auto btn-shine active:scale-[0.97]"
            style={{
              backgroundColor: 'var(--primary)',
              color: '#fff',
              boxShadow: '0 4px 14px -3px rgba(79, 70, 229, 0.4)'
            }}
          >
            <Plus size={14} />
            Import number
          </button>
        )}
      </div>

      {/* SEGMENTED TAB BUTTONS */}
      <div className="flex border-b border-[var(--border)] gap-6 relative z-10">
        <button
          onClick={() => setActiveTab('numbers')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'numbers' 
              ? 'border-black dark:border-white text-[var(--text-primary)]' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Phone size={14} />
          Phone Numbers
        </button>
        <button
          onClick={() => setActiveTab('sip')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'sip' 
              ? 'border-black dark:border-white text-[var(--text-primary)]' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Zap size={14} />
          SIP Trunks
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'settings' 
              ? 'border-black dark:border-white text-[var(--text-primary)]' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Key size={14} />
          Connection Settings
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 relative z-10">
          <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
        </div>
      ) : (
        <div className="relative z-10">
          {/* TAB 1: PHONE NUMBERS LIST */}
          {activeTab === 'numbers' && (
            numbers.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center py-20 px-4 border border-[var(--border)] rounded-2xl bg-[var(--surface-secondary)]/10 text-center">
                <div className="w-12 h-12 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] shadow-sm mb-4">
                  <Phone size={20} />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">No phone numbers</h3>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mb-6">Import a Twilio phone number to route inbound voice calls to an agent.</p>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="flex items-center gap-1.5 border border-[var(--border)] hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  Import number
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={15} />
                  <input
                    type="text"
                    placeholder="Search numbers or labels..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-secondary)]/20 text-xs font-semibold focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  />
                </div>

                <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--surface-secondary)]/10">
                  <table className="w-full border-collapse text-left text-xs font-medium">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/20 text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
                        <th className="px-6 py-4">Label</th>
                        <th className="px-6 py-4">Phone Number</th>
                        <th className="px-6 py-4">Provider</th>
                        <th className="px-6 py-4">Routing Target Agent</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredNumbers.map((num) => {
                        const label = labels[num.id] || 'Primary Line';
                        return (
                          <tr key={num.id} className="hover:bg-[var(--surface-secondary)]/15">
                            <td className="px-6 py-4">
                              <span className="font-bold text-[var(--text-primary)]">{label}</span>
                            </td>
                            <td className="px-6 py-4 font-mono text-[var(--text-secondary)] tracking-wider">
                              {num.number}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-secondary)]">
                                {num.provider}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <select
                                value={num.agent_id || ''}
                                onChange={(e) => handleAssignAgent(num.id, e.target.value)}
                                className="px-3 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                              >
                                <option value="">No Agent Assigned</option>
                                {agents.map((agent) => (
                                  <option key={agent.id} value={agent.id}>
                                    {agent.agentName}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleDeleteNumber(num.id)}
                                className="p-2 text-[var(--text-muted)] hover:text-red-500 rounded-lg hover:bg-red-500/5 border border-transparent hover:border-red-500/10 cursor-pointer"
                                title="Delete Number"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* TAB 2: SIP TRUNKS / GATEWAYS */}
          {activeTab === 'sip' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Provisioning Form */}
              <div className="lg:col-span-2 border border-[var(--border)] rounded-2xl p-6 bg-[var(--surface-secondary)]/10 space-y-5">
                <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <Zap size={16} className="text-[var(--primary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Provision LiveKit SIP Trunk</h3>
                </div>

                <form onSubmit={handleProvisionTrunks} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Twilio SIP Termination URI</label>
                      <input 
                        type="text"
                        placeholder="my-trunk.pstn.twilio.com"
                        value={sipConfig.termination_uri}
                        onChange={e => setSipConfig({...sipConfig, termination_uri: e.target.value})}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-xs font-mono focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Trunk Identifier Name</label>
                      <input 
                        type="text"
                        placeholder="twilio-outbound-trunk"
                        value={sipConfig.trunk_name}
                        onChange={e => setSipConfig({...sipConfig, trunk_name: e.target.value})}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-xs font-semibold focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">SIP Authentication Username</label>
                      <input 
                        type="text"
                        placeholder="Username"
                        value={sipConfig.auth_username}
                        onChange={e => setSipConfig({...sipConfig, auth_username: e.target.value})}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-xs focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">SIP Authentication Password</label>
                      <input 
                        type="password"
                        placeholder="Password"
                        value={sipConfig.auth_password}
                        onChange={e => setSipConfig({...sipConfig, auth_password: e.target.value})}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-xs font-mono focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={provisioningTrunk}
                    className="w-full bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {provisioningTrunk ? <Loader2 className="animate-spin" size={14} /> : 'Provision SIP Trunk'}
                  </button>
                </form>
              </div>

              {/* Trunks List Column */}
              <div className="border border-[var(--border)] rounded-2xl p-6 bg-[var(--surface-secondary)]/10 space-y-4">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2 flex items-center gap-2">
                  <Server size={14} />
                  Active SIP Trunks ({trunks.length})
                </h3>
                {trunks.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] text-center py-12">No active LiveKit SIP Trunks provisioned.</p>
                ) : (
                  <div className="space-y-3">
                    {trunks.map(t => (
                      <div key={t.id} className="p-3 bg.surface border border-[var(--border)] rounded-xl flex items-center justify-between group hover:border-[var(--text-secondary)]">
                        <div className="space-y-1 min-w-0">
                          <p className="font-bold text-xs truncate">{t.name || 'Unnamed Trunk'}</p>
                          <p className="font-mono text-[9px] text-[var(--text-muted)] truncate">{t.termination_uri}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteTrunk(t.id)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-500 rounded-lg hover:bg-red-500/5 cursor-pointer shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONNECTION SETTINGS */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Twilio Vault Credentials Form */}
              <div className="lg:col-span-2 border border-[var(--border)] rounded-2xl p-6 bg-[var(--surface-secondary)]/10 space-y-5">
                <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <Key size={16} className="text-[var(--primary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Twilio Credentials Vault</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Twilio Account SID</label>
                      <input 
                        type="text"
                        placeholder="ACxxxxxxxxxxxxxxxx"
                        value={twilioKeys.twilio_account_sid}
                        onChange={e => setTwilioKeys({...twilioKeys, twilio_account_sid: e.target.value})}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-xs font-mono focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Twilio Configured Caller ID</label>
                      <input 
                        type="text"
                        placeholder="+1xxxxxxxxxx"
                        value={twilioKeys.twilio_phone_number}
                        onChange={e => setTwilioKeys({...twilioKeys, twilio_phone_number: e.target.value})}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-xs font-mono focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Twilio Auth Token</label>
                    <input 
                      type="password"
                      placeholder="••••••••••••••••••••••••••••••••"
                      value={twilioKeys.twilio_auth_token}
                      onChange={e => setTwilioKeys({...twilioKeys, twilio_auth_token: e.target.value})}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-xs font-mono focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                    />
                  </div>

                  <button
                    onClick={handleSaveTwilioKeys}
                    disabled={savingKeys}
                    className="w-full bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {savingKeys ? <Loader2 className="animate-spin" size={14} /> : <><ShieldCheck size={14} /> Synchronize Twilio Vault</>}
                  </button>
                </div>
              </div>

              {/* Instructions / URI Copy Column */}
              <div className="border border-[var(--border)] rounded-2xl p-6 bg-[var(--surface-secondary)]/10 space-y-5">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2 flex items-center gap-2">
                  <AlertCircle size={14} />
                  Webhook Configuration
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[9px] text-[var(--text-secondary)] font-extrabold uppercase tracking-widest block">Twilio Voice Webhook</span>
                    <div className="flex bg-[var(--surface)] rounded-lg border border-[var(--border)] p-2.5 items-center justify-between min-w-0">
                      <span className="font-mono text-[9px] text-[var(--text-secondary)] truncate flex-1 mr-2">{resolveWebhookUrl('/inbound')}</span>
                      <button
                        onClick={() => handleCopy(resolveWebhookUrl('/inbound'), 'Twilio Voice Webhook')}
                        className="text-[var(--text-muted)] hover:text-black dark:hover:text-white cursor-pointer shrink-0"
                      >
                        {copiedText === 'Twilio Voice Webhook' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] text-[var(--text-secondary)] font-extrabold uppercase tracking-widest block">LiveKit SIP Origination URI</span>
                    <div className="flex bg-[var(--surface)] rounded-lg border border-[var(--border)] p-2.5 items-center justify-between min-w-0">
                      <span className="font-mono text-[9px] text-[var(--text-secondary)] truncate flex-1 mr-2">
                        {telephonyStatus?.setup_instructions?.origination_uri || 'sip:70gad9nw.sip.livekit.cloud;transport=tcp'}
                      </span>
                      <button
                        onClick={() => handleCopy(telephonyStatus?.setup_instructions?.origination_uri || 'sip:70gad9nw.sip.livekit.cloud;transport=tcp', 'SIP URI')}
                        className="text-[var(--text-muted)] hover:text-black dark:hover:text-white cursor-pointer shrink-0"
                      >
                        {copiedText === 'SIP URI' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[9.5px] leading-relaxed text-[var(--text-secondary)] space-y-2">
                    <p><strong>To receive inbound calls:</strong> Paste the Twilio Voice Webhook URL into the Voice Webhook box of your phone number in Twilio Console.</p>
                    <p><strong>For SIP routing:</strong> Bind active phone numbers to LiveKit trunks via the LiveKit SIP origination endpoint.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RIGHT SIDE DRAWER FOR IMPORT */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[1000] flex justify-end">
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          <div className="relative w-full max-w-[420px] h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col z-10 animate-none">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Phone size={15} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">Import phone number from Twilio</h2>
                  <p className="text-[10px] text-[var(--text-muted)]">Configure Twilio credentials for webhook routing</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleImportNumber} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Label</label>
                <input
                  type="text"
                  placeholder="Easy to identify name of the phone number"
                  value={importForm.label}
                  onChange={e => setImportForm({...importForm, label: e.target.value})}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-secondary)]/10 text-xs font-semibold focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Phone number</label>
                <div className="flex gap-2">
                  <select
                    value={importForm.countryCode}
                    onChange={e => setImportForm({...importForm, countryCode: e.target.value})}
                    className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-secondary)]/15 text-xs font-bold focus:outline-none focus:border-[var(--primary)] cursor-pointer text-[var(--text-primary)]"
                  >
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+33">🇫🇷 +33</option>
                  </select>
                  <input
                    type="text"
                    placeholder="201 555 0123"
                    value={importForm.phoneNumber}
                    onChange={e => setImportForm({...importForm, phoneNumber: e.target.value})}
                    className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-secondary)]/10 text-xs font-mono font-bold focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Twilio Account SID</label>
                <input
                  type="text"
                  placeholder="Twilio Account SID"
                  value={importForm.twilioSid}
                  onChange={e => setImportForm({...importForm, twilioSid: e.target.value})}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-secondary)]/10 text-xs font-mono focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Twilio Auth Token (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave empty to use configured vault key"
                  value={importForm.twilioToken}
                  onChange={e => setImportForm({...importForm, twilioToken: e.target.value})}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-secondary)]/10 text-xs font-mono focus:outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-start justify-between p-3.5 bg-[var(--surface-secondary)]/20 border border-[var(--border)] rounded-xl">
                <div className="space-y-0.5 mr-4">
                  <span className="text-xs font-bold text-[var(--text-primary)]">Routing Region Configuration</span>
                  <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">Configure a specific routing region with dedicated token</p>
                </div>
                <button
                  type="button"
                  onClick={() => setImportForm({...importForm, routingRegion: !importForm.routingRegion})}
                  className={`w-9 h-5 rounded-full p-0.5 relative shrink-0 cursor-pointer ${importForm.routingRegion ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-100 ${importForm.routingRegion ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 border border-[var(--border)] hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImportNumber}
                disabled={isImporting}
                className="px-4 py-2 bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isImporting ? <Loader2 className="animate-spin" size={12} /> : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelephonyPage;
