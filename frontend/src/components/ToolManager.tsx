import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, X, Zap, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toolApi } from '../services/api';
import { DecommissionModal } from './DecommissionModal';
import { useNavigate } from 'react-router-dom';

interface Tool {
  id: string;
  name: string;
  description: string;
  tool_type: string;
  category: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  api_key?: string;
  body_template?: string;
  config: any;
  integration_id?: string;
}

interface Integration {
  id: string;
  provider: string;
  scopes: string[];
}

export const ToolManager: React.FC = () => {
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isTestingConfig, setIsTestingConfig] = useState(false);
  const [testResult, setTestResult] = useState<{status: 'success' | 'failure', code?: number, error?: string, fullResponse?: any} | null>(null);
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorData, setInspectorData] = useState<any>(null);
  const [decommissioningItem, setDecommissioningItem] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [creationStep, setCreationStep] = useState<'type' | 'config'>('type');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newTool, setNewTool] = useState<Partial<Tool>>({
    name: '',
    description: '',
    tool_type: 'WEBHOOK',
    category: 'Webhooks',
    url: '',
    method: 'POST',
    headers: {},
    api_key: '',
    body_template: '{\n  "input": "{{input}}"\n}',
    config: {},
    integration_id: ''
  });

  const fetchTools = async () => {
    try {
      const res = await toolApi.list();
      setTools(res.data);
    } catch (err) {
      console.error("Failed to fetch tools", err);
      toast.error('Failed to sync marketplace');
    }
  };

  const fetchIntegrations = async () => {
    try {
      const res = await api.get('/integrations/');
      setIntegrations(res.data);
    } catch (err) {
      console.error("Failed to fetch integrations", err);
    }
  };

  useEffect(() => { 
    fetchTools(); 
    fetchIntegrations();
  }, []);

  const handleSave = async () => {
    const toastId = toast.loading('Registering Tool...');
    try {
      await toolApi.create(newTool);
      toast.success('Neural Link Established', { id: toastId });
      setIsAdding(false);
      fetchTools();
      // Reset form
      setCreationStep('type');
      setNewTool({
        name: '',
        description: '',
        tool_type: 'WEBHOOK',
        category: 'Webhooks',
        url: '',
        method: 'POST',
        headers: {},
        api_key: '',
        body_template: '{\n  "input": "{{input}}"\n}',
        config: {},
        integration_id: ''
      });
    } catch (err) {
      console.error("Failed to save tool", err);
      toast.error('Failed to authorize link', { id: toastId });
    }
  };

  const handleTestTool = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTesting(id);
    const toastId = toast.loading('Testing Neural Link...');
    try {
      const res = await toolApi.test(id);
      if (res.data.status === 'success') {
        toast.success(`Active: HTTP ${res.data.code}`, { id: toastId });
        setInspectorData(res.data);
        setShowInspector(true);
      } else {
        toast.error(`Offline: ${res.data.error}`, { id: toastId });
      }
    } catch (err) {
      toast.error('Neural Link Timeout', { id: toastId });
    } finally {
      setIsTesting(null);
    }
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDecommissioningItem({ id, name });
  };

  const confirmDecommission = async () => {
    if (!decommissioningItem) return;
    setIsDeleting(true);
    const { id, name } = decommissioningItem;
    const toastId = toast.loading(`Severing ${name}...`);
    try {
      await toolApi.delete(id);
      toast.success('Link Decommissioned', { id: toastId });
      setDecommissioningItem(null);
      fetchTools();
    } catch (err) {
      console.error("Failed to delete tool", err);
      toast.error('Decommission failed', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestNewTool = async () => {
    if (!newTool.url) return toast.error("Webhook URL is required for testing");
    setIsTestingConfig(true);
    setTestResult(null);
    const toastId = toast.loading('Probing Neural Path...');
    try {
      const res = await toolApi.testConfig(newTool);
      if (res.data.status === 'success') {
        setTestResult({ status: 'success', code: res.data.code, fullResponse: res.data });
        toast.success(`Success: Node responded with ${res.data.code}`, { id: toastId });
      } else {
        setTestResult({ status: 'failure', error: res.data.error });
        toast.error(`Probe Failed: ${res.data.error}`, { id: toastId });
      }
    } catch (err) {
      toast.error('Probe Timeout', { id: toastId });
    } finally {
      setIsTestingConfig(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4 md:gap-5">
          <button onClick={() => navigate('/')} className="btn-back-premium">
            <ArrowLeft size={14} />
            <span>Overview</span>
          </button>
          <div className="space-y-1">
              <h1 className="text-xl font-heading font-black text-white uppercase tracking-wider">Tool Marketplace</h1>
              <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,97,255,0.4)]" />
                  <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest leading-none">External Node Capability Sync</p>
              </div>
          </div>
        </div>
        <button
            onClick={() => setIsAdding(true)}
            className="btn-vapi h-10 !px-6"
        >
            <Plus size={16} strokeWidth={3} />
            Create Forge Link
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tools.map(tool => (
            <div
                key={tool.id}
                className="card-vapi !p-4 rounded-xl flex flex-col relative overflow-hidden group transition-all duration-300 glow-card-primary"
            >
                <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg shadow-inner group-hover:bg-zinc-800 transition-colors">
                        {tool.tool_type === 'CALENDAR' ? '📅' : tool.tool_type === 'SHEETS' ? '📊' : tool.tool_type === 'N8N' ? '🤖' : '🔌'}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => handleTestTool(tool.id, e)}
                            className="p-1.5 text-zinc-600 hover:text-primary transition-all bg-zinc-950 rounded-md border border-border"
                            title="Test"
                        >
                            <Zap size={10} fill={isTesting === tool.id ? 'currentColor' : 'none'} className={isTesting === tool.id ? 'animate-pulse' : ''} />
                        </button>
                        <button
                            onClick={(e) => handleDelete(tool.id, tool.name, e)}
                            className="p-1.5 text-zinc-600 hover:text-red-500 transition-all bg-zinc-950 rounded-md border border-border"
                            title="Delete"
                        >
                            <Trash2 size={10} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 space-y-2 relative z-10">
                    <div>
                        <h3 className="text-[13px] font-heading font-black text-white uppercase tracking-wide line-clamp-1">{tool.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                            <span className="text-[7px] font-black text-zinc-700 uppercase tracking-widest bg-zinc-900 px-1 py-0.5 rounded border border-white/5">{tool.category || tool.tool_type}</span>
                            <span className="text-[8px] text-zinc-600 font-mono tracking-tighter truncate max-w-[150px] italic">
                                {tool.tool_type === 'WEBHOOK' || tool.tool_type === 'N8N' ? tool.url : 'Native Relay'}
                            </span>
                        </div>
                    </div>

                    <p className="text-[10px] text-zinc-600 font-medium line-clamp-1 leading-relaxed">
                        {tool.description || 'Autonomous node module.'}
                    </p>

                    <div className="flex items-center gap-1.5 pt-1">
                       <div className="px-1.5 py-0.5 bg-zinc-950/50 border border-zinc-900/50 rounded text-[7px] font-black text-zinc-700 uppercase tracking-[0.1em]">{tool.method}</div>
                       {tool.tool_type === 'N8N' && (
                           <div className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[7px] font-black text-blue-500 uppercase tracking-[0.1em]">Orchestration</div>
                       )}
                    </div>
                </div>
            </div>
        ))}

        {/* EMPTY STATE / ADD NEW BUTTON */}
        <button
            onClick={() => setIsAdding(true)}
            className="bg-zinc-950/20 border border-dashed border-zinc-900 rounded-xl p-6 flex flex-col items-center justify-center gap-4 hover:border-zinc-700 hover:bg-zinc-900/10 group transition-all duration-300 min-h-[280px]"
        >
            <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-800 group-hover:text-white group-hover:border-zinc-700 transition-all duration-300">
                <Plus size={20} />
            </div>
            <div className="text-center space-y-0.5">
                <h4 className="text-[9px] font-black text-white uppercase tracking-widest">Expand Registry</h4>
                <p className="text-[8px] text-zinc-800 font-bold uppercase tracking-widest leading-loose">Deploy New Connection</p>
            </div>
        </button>
      </div>

      {/* CREATE MODAL */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 z-[100] animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-xl rounded-2xl p-6 md:p-8 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            <div className="absolute top-6 right-6 z-20">
              <button onClick={() => setIsAdding(false)} className="text-zinc-600 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <h2 className="text-sm font-heading font-black text-white uppercase tracking-widest mb-8 shrink-0">
              {creationStep === 'type' ? 'Select Integration Template' : `Configure ${newTool.category}`}
            </h2>

            <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-1">
              {creationStep === 'type' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <button 
                    onClick={() => {
                        setNewTool({...newTool, tool_type: 'WEBHOOK', category: 'Webhooks', method: 'POST', body_template: '{\n  "input": "{{input}}"\n}'});
                        setCreationStep('config');
                    }}
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-primary/50 hover:bg-primary/5 transition-all text-center group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🔌</div>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Custom Webhook</h4>
                      <p className="text-[9px] text-zinc-600 font-medium mt-1">Connect any REST API</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                        setNewTool({...newTool, tool_type: 'N8N', category: 'n8n Workflows', method: 'POST'});
                        setCreationStep('config');
                    }}
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-center group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🤖</div>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest">n8n Workflow</h4>
                      <p className="text-[9px] text-zinc-600 font-medium mt-1">Excel, Sheets, & Budgeting</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                        setNewTool({...newTool, tool_type: 'CALENDAR', category: 'Google Apps', method: 'NATIVE'});
                        setCreationStep('config');
                    }}
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-center group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📅</div>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Google Calendar</h4>
                      <p className="text-[9px] text-zinc-600 font-medium mt-1">Schedule & Manage Events</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                        setNewTool({...newTool, tool_type: 'SHEETS', category: 'Google Apps', method: 'NATIVE'});
                        setCreationStep('config');
                    }}
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📊</div>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Google Sheets</h4>
                      <p className="text-[9px] text-zinc-600 font-medium mt-1">Log Leads & Session Data</p>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setCreationStep('type')}
                        className="text-[9px] font-black text-zinc-600 uppercase tracking-widest hover:text-white transition-colors"
                    >
                        ← Back to Templates
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Tool Name</label>
                      <input 
                        className="input-vapi w-full h-11 text-[11px]"
                        placeholder="e.g. Appointment Scheduler"
                        value={newTool.name}
                        onChange={e => setNewTool({...newTool, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">What does it do?</label>
                      <input 
                        className="input-vapi w-full h-11 text-[11px]"
                        placeholder="e.g. Schedules meetings in my primary calendar"
                        value={newTool.description}
                        onChange={e => setNewTool({...newTool, description: e.target.value})}
                      />
                    </div>
                  </div>

                  {newTool.tool_type === 'N8N' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest">N8N NEURAL BRIDGE</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">Connect your n8n workflow. Added credentials will be securely passed as JSON variables.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">n8n Webhook URL</label>
                                <input 
                                    className="input-vapi w-full h-11 font-mono text-[11px]"
                                    placeholder="https://your-n8n.com/webhook/..."
                                    value={newTool.url}
                                    onChange={e => setNewTool({...newTool, url: e.target.value})}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Integration Scopes</label>
                                    <button 
                                        onClick={() => {
                                            const config = newTool.config || {};
                                            setNewTool({...newTool, config: {...config, [`field_${Object.keys(config).length + 1}`]: ''}});
                                        }}
                                        className="text-[8px] font-black text-primary uppercase tracking-widest hover:underline"
                                    >
                                        + Add Credential
                                    </button>
                                </div>
                                
                                <div className="space-y-2">
                                    {Object.entries(newTool.config || {}).map(([key, value], idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input 
                                                className="flex-1 input-vapi h-9 text-[10px] font-mono"
                                                placeholder="Key"
                                                value={key}
                                                onChange={(e) => {
                                                    const newConfig = {...(newTool.config || {})};
                                                    delete newConfig[key];
                                                    newConfig[e.target.value] = value;
                                                    setNewTool({...newTool, config: newConfig});
                                                }}
                                            />
                                            <input 
                                                className="flex-[2] input-vapi h-9 text-[10px]"
                                                placeholder="Value"
                                                value={value as string}
                                                onChange={(e) => {
                                                    setNewTool({...newTool, config: {...(newTool.config || {}), [key]: e.target.value}});
                                                }}
                                            />
                                            <button 
                                                onClick={() => {
                                                    const newConfig = {...(newTool.config || {})};
                                                    delete newConfig[key];
                                                    setNewTool({...newTool, config: newConfig});
                                                }}
                                                className="p-2 text-zinc-800 hover:text-red-500"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {Object.keys(newTool.config || {}).length === 0 && (
                                        <div className="text-center py-4 border border-zinc-900 border-dashed rounded-xl">
                                            <p className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">No secret scopes defined</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                  )}

                  {newTool.tool_type === 'CALENDAR' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">NATIVE CALENDAR ADAPTER</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">Agent can create and manage events. Requires a valid Google OAuth token.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Connect Account</label>
                                <select 
                                    className="input-vapi w-full h-11 font-bold text-[11px]"
                                    value={newTool.integration_id}
                                    onChange={e => setNewTool({...newTool, integration_id: e.target.value})}
                                >
                                    <option value="">Manual Token Input</option>
                                    {integrations.filter(i => i.provider === 'google').map(i => (
                                        <option key={i.id} value={i.id}>Personal Google Account</option>
                                    ))}
                                </select>
                            </div>
                            
                            {!newTool.integration_id && (
                                <div className="space-y-1.5 animate-in fade-in duration-200">
                                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">OAuth Token</label>
                                    <input 
                                        type="password"
                                        className="input-vapi w-full h-11"
                                        placeholder="Paste Bearer Token"
                                        value={newTool.api_key}
                                        onChange={e => setNewTool({...newTool, api_key: e.target.value})}
                                    />
                                </div>
                            )}
                            
                            <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Calendar ID</label>
                                <input 
                                    className="input-vapi w-full h-11"
                                    placeholder="primary"
                                    value={newTool.config?.calendarId || ''}
                                    onChange={e => setNewTool({...newTool, config: {...newTool.config, calendarId: e.target.value}})}
                                />
                            </div>
                        </div>
                    </div>
                  )}

                  {newTool.tool_type === 'SHEETS' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">GOOGLE SHEETS ADAPTER</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">Log leads or session results directly into a designated spreadsheet row.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Connect Account</label>
                                <select 
                                    className="input-vapi w-full h-11 font-bold text-[11px]"
                                    value={newTool.integration_id}
                                    onChange={e => setNewTool({...newTool, integration_id: e.target.value})}
                                >
                                    <option value="">Manual Token Input</option>
                                    {integrations.filter(i => i.provider === 'google').map(i => (
                                        <option key={i.id} value={i.id}>Personal Google Account</option>
                                    ))}
                                </select>
                            </div>

                            {!newTool.integration_id && (
                                <div className="space-y-1.5 animate-in fade-in duration-200">
                                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">OAuth Token</label>
                                    <input 
                                        type="password"
                                        className="input-vapi w-full h-11"
                                        placeholder="Paste Bearer Token"
                                        value={newTool.api_key}
                                        onChange={e => setNewTool({...newTool, api_key: e.target.value})}
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Spreadsheet ID</label>
                                    <input 
                                        className="input-vapi w-full h-11"
                                        placeholder="1abcde..."
                                        value={newTool.config?.spreadsheetId || ''}
                                        onChange={e => setNewTool({...newTool, config: {...newTool.config, spreadsheetId: e.target.value}})}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Range</label>
                                    <input 
                                        className="input-vapi w-full h-11"
                                        placeholder="Sheet1!A1"
                                        value={newTool.config?.range || ''}
                                        onChange={e => setNewTool({...newTool, config: {...newTool.config, range: e.target.value}})}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                  )}

                  {newTool.tool_type === 'WEBHOOK' && (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Webhook URL</label>
                            <input 
                                className="input-vapi w-full h-11 font-mono text-[11px]"
                                placeholder="https://api.service.com/webhook"
                                value={newTool.url}
                                onChange={e => setNewTool({...newTool, url: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">API Key / Token (Secure)</label>
                            <input 
                                type="password"
                                className="input-vapi w-full h-11"
                                placeholder="••••••••••••••••"
                                value={newTool.api_key}
                                onChange={e => setNewTool({...newTool, api_key: e.target.value})}
                            />
                        </div>

                        <div className="border-t border-zinc-900 pt-6 mt-2 space-y-4">
                            <button 
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors"
                            >
                                {showAdvanced ? '− Hide' : '+ Show'} Advanced HTTP Settings
                            </button>

                            <div className={`space-y-4 overflow-hidden transition-all duration-300 ${showAdvanced ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Method</label>
                                    <select 
                                        className="input-vapi w-full h-11 font-bold text-[11px]"
                                        value={newTool.method}
                                        onChange={e => setNewTool({...newTool, method: e.target.value})}
                                    >
                                        <option>GET</option>
                                        <option>POST</option>
                                        <option>PUT</option>
                                    </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Custom Headers (JSON)</label>
                                        <input 
                                            className="input-vapi w-full h-11 text-[11px]"
                                            placeholder='{"X-Header": "Value"}'
                                            onChange={e => {
                                                try {
                                                    setNewTool({...newTool, headers: JSON.parse(e.target.value)});
                                                } catch(err) {}
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Body Template (JSON)</label>
                                    <textarea 
                                        rows={3}
                                        className="input-vapi w-full font-mono text-xs h-20 resize-none p-4"
                                        placeholder='{ "query": "{{query}}" }'
                                        value={newTool.body_template}
                                        onChange={e => setNewTool({...newTool, body_template: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4 border-t border-zinc-900 mt-2">
                    {newTool.tool_type === 'WEBHOOK' && (
                      <button 
                        onClick={handleTestNewTool}
                        disabled={isTestingConfig}
                        className="flex-1 btn-outline h-11 text-[10px]"
                      >
                        {isTestingConfig ? <RefreshCw className="animate-spin" size={12} /> : <Zap size={12} />}
                        Probe Path
                      </button>
                    )}
                    <button 
                      onClick={handleSave}
                      className="flex-[2] btn-vapi h-11 text-[10px] !bg-primary"
                    >
                      Save Neural Link
                    </button>
                  </div>

                  {testResult && (
                    <div className={`p-3 rounded-lg border flex items-center justify-between ${testResult.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-red-500/5 border-red-500/20 text-red-500'}`}>
                       <div className="flex items-center gap-2">
                         <div className={`w-1.5 h-1.5 rounded-full ${testResult.status === 'success' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                         <p className="text-[9px] font-black uppercase tracking-widest leading-none">
                           {testResult.status === 'success' ? `Node Online (HTTP ${testResult.code})` : `Failed: ${testResult.error}`}
                         </p>
                       </div>
                       {testResult.status === 'success' && (
                         <button 
                           onClick={() => { setInspectorData(testResult.fullResponse); setShowInspector(true); }}
                           className="text-[8px] font-black text-white bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800 hover:bg-zinc-800 transition-all"
                         >
                           Inspector
                         </button>
                       )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INSPECTOR MODAL */}
      {showInspector && inspectorData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 z-[200] animate-in zoom-in-95 duration-200">
           <div className="bg-zinc-950 border border-zinc-800 w-full max-w-3xl max-h-[80vh] rounded-2xl flex flex-col shadow-2xl relative overflow-hidden">
              <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-black ${inspectorData.code === 200 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {inspectorData.code}
                  </div>
                  <div>
                    <h3 className="text-sm font-heading font-black text-white uppercase tracking-widest">Response Inspector</h3>
                    <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5 leading-none">Payload captured from live node</p>
                  </div>
                </div>
                <button onClick={() => setShowInspector(false)} className="p-2 text-zinc-500 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 font-mono text-[10px] leading-relaxed text-blue-400/70">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(inspectorData.response || inspectorData, null, 2)}</pre>
                </div>
              </div>

              <div className="p-4 border-t border-zinc-900 bg-zinc-950/50 flex justify-between items-center">
                <span className="text-[8px] text-zinc-800 font-black uppercase tracking-widest opacity-50">Foundry Diagnostics v1.0</span>
                <span className="text-[8px] text-zinc-600 italic">Data parsed successfully.</span>
              </div>
           </div>
        </div>
      )}

      <DecommissionModal 
        isOpen={!!decommissioningItem}
        onClose={() => setDecommissioningItem(null)}
        onConfirm={confirmDecommission}
        title="Sever Neural Link"
        itemName={decommissioningItem?.name || ''}
        loading={isDeleting}
      />
    </div>
  );
};
