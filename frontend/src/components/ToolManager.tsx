import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toolApi } from '../services/api';
import { DecommissionModal } from './DecommissionModal';
import { BackButton } from './BackButton';

const GoogleCalendarIcon = ({ size = 22 }: { size?: number }) => (
  <img 
    src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/google-calendar.svg" 
    alt="Google Calendar" 
    style={{ width: size, height: size }}
    className="object-contain animate-fade-in" 
  />
);

const GoogleSheetsIcon = ({ size = 22 }: { size?: number }) => (
  <img 
    src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/google-sheets.svg" 
    alt="Google Sheets" 
    style={{ width: size, height: size }}
    className="object-contain animate-fade-in" 
  />
);

const N8NIcon = ({ size = 22 }: { size?: number }) => (
  <img 
    src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/n8n.svg" 
    alt="n8n Workflow" 
    style={{ width: size, height: size }}
    className="object-contain animate-fade-in" 
  />
);

const CustomWebhookIcon = ({ size = 22 }: { size?: number }) => (
  <img 
    src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/n8n.svg" 
    alt="n8n Webhook Relay" 
    style={{ width: size, height: size }}
    className="object-contain animate-fade-in" 
  />
);

const renderToolIcon = (toolType: string, size = 22) => {
  switch (toolType) {
    case 'CALENDAR':
      return <GoogleCalendarIcon size={size} />;
    case 'SHEETS':
      return <GoogleSheetsIcon size={size} />;
    case 'N8N':
      return <N8NIcon size={size} />;
    default:
      return <CustomWebhookIcon size={size} />;
  }
};

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
      toast.success('Tool Connected successfully', { id: toastId });
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
    const toastId = toast.loading('Testing Connection...');
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
      toast.error('Connection Timeout', { id: toastId });
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
      toast.success('Tool Disconnected', { id: toastId });
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
    const toastId = toast.loading('Testing Webhook Endpoint...');
    try {
      const res = await toolApi.testConfig(newTool);
      if (res.data.status === 'success') {
        setTestResult({ status: 'success', code: res.data.code, fullResponse: res.data });
        toast.success(`Success: Node responded with ${res.data.code}`, { id: toastId });
      } else {
        setTestResult({ status: 'failure', error: res.data.error });
        toast.error(`Test Failed: ${res.data.error}`, { id: toastId });
      }
    } catch (err) {
      toast.error('Test Timeout', { id: toastId });
    } finally {
      setIsTestingConfig(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-500 font-sans">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 pb-6 border-b border-zinc-900/60 mb-10">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 leading-tight">
            Tool Marketplace
          </h1>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Sync workflows & automated API relays</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 self-start md:self-auto">
          <BackButton fallbackPath="/" label="Overview" />

          <button
            onClick={() => {
              setCreationStep('type');
              setIsAdding(true);
            }}
            className="h-11 px-5 rounded-xl bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-300 text-zinc-950 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition flex items-center gap-2"
          >
            <Plus size={15} strokeWidth={2.5} />
            Add New Tool
          </button>
        </div>
      </div>

      {/* TOOLS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="rounded-3xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-xl p-6 hover:border-zinc-800 hover:bg-zinc-950 transition-all duration-300 flex flex-col justify-between min-h-[270px] group cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent" />

            <div>
              {/* TOP */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-13 h-13 rounded-2xl bg-zinc-900/60 flex items-center justify-center border border-zinc-850 shadow-md">
                    {renderToolIcon(tool.tool_type, 24)}
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-zinc-200 tracking-wide group-hover:text-zinc-100 transition-colors duration-300 line-clamp-1">
                      {tool.name}
                    </h3>
                    <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest block mt-0.5">
                      {tool.category || tool.tool_type}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleTestTool(tool.id, e)}
                    className="w-9 h-9 rounded-xl border border-zinc-900 bg-zinc-950 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:border-zinc-800 transition-all duration-300 active:scale-95"
                    title="Probe Link"
                  >
                    <Zap size={13} className={isTesting === tool.id ? 'animate-pulse text-yellow-500' : ''} />
                  </button>

                  <button
                    onClick={(e) => handleDelete(tool.id, tool.name, e)}
                    className="w-9 h-9 rounded-xl border border-zinc-900 bg-zinc-950 flex items-center justify-center text-zinc-550 hover:text-red-500 hover:border-red-500/20 transition-all duration-300 active:scale-95"
                    title="Decommission Link"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* DESCRIPTION */}
              <p className="text-zinc-500 text-xs leading-relaxed font-semibold line-clamp-2">
                {tool.description || 'External integration adapter for cellular routing nodes.'}
              </p>
            </div>

            {/* URL/INFO */}
            <div className="mt-5 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-900 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">
                  {tool.tool_type === 'N8N' ? 'Orchestration Flow' : 'Endpoint Node'}
                </span>
                <span className="text-[8px] font-extrabold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850/80 text-zinc-400">
                  {tool.method}
                </span>
              </div>
              <p className="mt-2 text-[10px] text-zinc-400 font-mono truncate leading-none">
                {tool.tool_type === 'WEBHOOK' || tool.tool_type === 'N8N' ? tool.url : 'Native Relay Adapter'}
              </p>
            </div>
          </div>
        ))}

        {/* ADD CARD */}
        <button
          onClick={() => {
            setCreationStep('type');
            setIsAdding(true);
          }}
          className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/10 p-6 flex flex-col items-center justify-center min-h-[270px] hover:border-zinc-700 hover:bg-zinc-950/20 hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-500 group-hover:text-zinc-300 group-hover:border-zinc-800 transition duration-300 mb-5 shadow-inner">
            <Plus size={22} strokeWidth={2.5} />
          </div>
          <h3 className="text-sm font-extrabold text-zinc-300 tracking-wide uppercase tracking-widest">
            Add New Tool
          </h3>
          <p className="text-zinc-550 text-xs mt-2.5 text-center max-w-[220px] leading-relaxed font-semibold">
            Connect custom webhooks, workflows and direct Google service integrations.
          </p>
        </button>
      </div>

      {/* ADD/CONFIGURE MODAL */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-850">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100">
                  {creationStep === 'type' ? 'Add Tool' : `Configure ${newTool.category}`}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {creationStep === 'type' ? 'Configure a new integration.' : 'Complete configuration parameter values.'}
                </p>
              </div>
              <button
                onClick={() => setIsAdding(false)}
                className="w-10 h-10 rounded-xl border border-zinc-855 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* BODY */}
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {creationStep === 'type' ? (
                /* STEP 1: SELECT TYPE */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <button 
                    onClick={() => {
                        setNewTool({...newTool, tool_type: 'WEBHOOK', category: 'Webhooks', method: 'POST', body_template: '{\n  "input": "{{input}}"\n}'});
                        setCreationStep('config');
                    }}
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-850 hover:border-primary/50 hover:bg-primary/5 transition text-center group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-950/40 flex items-center justify-center group-hover:scale-110 transition border border-zinc-800"><CustomWebhookIcon size={24} /></div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-100">Custom Webhook</h4>
                      <p className="text-xs text-zinc-500 mt-1">Connect any REST API endpoint</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                        setNewTool({...newTool, tool_type: 'N8N', category: 'n8n Workflows', method: 'POST'});
                        setCreationStep('config');
                    }}
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-850 hover:border-blue-500/50 hover:bg-blue-500/5 transition text-center group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-950/40 flex items-center justify-center group-hover:scale-110 transition border border-zinc-800"><N8NIcon size={24} /></div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-100">n8n Workflow</h4>
                      <p className="text-xs text-zinc-500 mt-1">Budgeting, spreadsheets & custom flows</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                        setNewTool({...newTool, tool_type: 'CALENDAR', category: 'Google Apps', method: 'NATIVE'});
                        setCreationStep('config');
                    }}
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-850 hover:border-amber-500/50 hover:bg-amber-500/5 transition text-center group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-950/40 flex items-center justify-center group-hover:scale-110 transition border border-zinc-800"><GoogleCalendarIcon size={24} /></div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-100">Google Calendar</h4>
                      <p className="text-xs text-zinc-500 mt-1">Schedule meetings & query events</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                        setNewTool({...newTool, tool_type: 'SHEETS', category: 'Google Apps', method: 'NATIVE'});
                        setCreationStep('config');
                    }}
                    className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-850 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition text-center group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-950/40 flex items-center justify-center group-hover:scale-110 transition border border-zinc-800"><GoogleSheetsIcon size={24} /></div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-100">Google Sheets</h4>
                      <p className="text-xs text-zinc-500 mt-1">Log session entries & user profiles</p>
                    </div>
                  </button>
                </div>
              ) : (
                /* STEP 2: CONFIGURE VALUES */
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-4 mb-2">
                    <button 
                      onClick={() => setCreationStep('type')}
                      className="text-xs font-semibold text-zinc-500 uppercase tracking-widest hover:text-zinc-200 transition"
                    >
                      ← Back to Templates
                    </button>
                  </div>

                  {/* NAME */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">
                      Tool Name
                    </label>
                    <input
                      value={newTool.name}
                      onChange={(e) =>
                        setNewTool({
                          ...newTool,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Appointment Scheduler"
                      className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition"
                    />
                  </div>

                  {/* DESCRIPTION */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">
                      Description
                    </label>
                    <textarea
                      value={newTool.description}
                      onChange={(e) =>
                        setNewTool({
                          ...newTool,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe what this tool does so the AI model knows when to execute it..."
                      className="w-full h-28 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm outline-none resize-none focus:border-primary transition leading-relaxed"
                    />
                  </div>

                  {/* TYPE SPECIFIC CONFIGS */}
                  {newTool.tool_type === 'N8N' && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="text-xs font-bold text-primary uppercase tracking-widest">N8N INTEGRATION BRIDGE</span>
                        </div>
                        <p className="text-xs text-zinc-550 leading-relaxed font-semibold">
                          Connect your n8n workflow. Configured scopes will be securely passed as payload JSON variables.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">
                          n8n Webhook URL
                        </label>
                        <input 
                          className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-mono outline-none focus:border-primary transition"
                          placeholder="https://your-n8n.com/webhook/..."
                          value={newTool.url}
                          onChange={e => setNewTool({...newTool, url: e.target.value})}
                        />
                      </div>

                      {/* Secret Scopes / Credentials */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Secret Scopes</label>
                          <button 
                            onClick={() => {
                              const config = newTool.config || {};
                              setNewTool({
                                ...newTool, 
                                config: {
                                  ...config, 
                                  [`field_${Object.keys(config).length + 1}`]: ''
                                }
                              });
                            }}
                            className="text-xs font-bold text-primary uppercase tracking-widest hover:underline"
                          >
                            + Add Scope
                          </button>
                        </div>

                        <div className="space-y-2">
                          {Object.entries(newTool.config || {}).map(([key, value], idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input 
                                className="flex-1 h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs font-mono outline-none focus:border-primary"
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
                                className="flex-[2] h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs outline-none focus:border-primary"
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
                                className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          {Object.keys(newTool.config || {}).length === 0 && (
                            <div className="text-center py-4 border border-zinc-905 border-dashed rounded-xl">
                              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">No secret scopes defined</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {newTool.tool_type === 'CALENDAR' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">NATIVE CALENDAR ADAPTER</span>
                        </div>
                        <p className="text-xs text-zinc-550 leading-relaxed font-semibold">
                          Allows agent to view and book events. Uses Google Cloud credential structures.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Connect Account</label>
                        <select 
                          className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-semibold"
                          value={newTool.integration_id}
                          onChange={e => setNewTool({...newTool, integration_id: e.target.value})}
                        >
                          <option value="">Manual OAuth Token Input</option>
                          {integrations.filter(i => i.provider === 'google').map(i => (
                            <option key={i.id} value={i.id}>Connected Google Account</option>
                          ))}
                        </select>
                      </div>

                      {!newTool.integration_id && (
                        <div className="space-y-2 animate-in fade-in duration-200">
                          <label className="text-sm font-medium text-zinc-300">OAuth Access Token</label>
                          <input 
                            type="password"
                            className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-mono"
                            placeholder="ya29.a0AfH6SM..."
                            value={newTool.api_key}
                            onChange={e => setNewTool({...newTool, api_key: e.target.value})}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Calendar ID</label>
                        <input 
                          className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-mono"
                          placeholder="primary"
                          value={newTool.config?.calendarId || ''}
                          onChange={e => setNewTool({...newTool, config: {...newTool.config, calendarId: e.target.value}})}
                        />
                      </div>
                    </div>
                  )}

                  {newTool.tool_type === 'SHEETS' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">GOOGLE SHEETS ADAPTER</span>
                        </div>
                        <p className="text-xs text-zinc-550 leading-relaxed font-semibold">
                          Log live conversations, caller details, and leads directly inside custom spreadsheet cells.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Connect Account</label>
                        <select 
                          className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-semibold"
                          value={newTool.integration_id}
                          onChange={e => setNewTool({...newTool, integration_id: e.target.value})}
                        >
                          <option value="">Manual OAuth Token Input</option>
                          {integrations.filter(i => i.provider === 'google').map(i => (
                            <option key={i.id} value={i.id}>Connected Google Account</option>
                          ))}
                        </select>
                      </div>

                      {!newTool.integration_id && (
                        <div className="space-y-2 animate-in fade-in duration-200">
                          <label className="text-sm font-medium text-zinc-300">OAuth Access Token</label>
                          <input 
                            type="password"
                            className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-mono"
                            placeholder="ya29.a0AfH6SM..."
                            value={newTool.api_key}
                            onChange={e => setNewTool({...newTool, api_key: e.target.value})}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-300">Spreadsheet ID / URL</label>
                          <input 
                            className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-mono truncate"
                            placeholder="Paste Spreadsheet ID or full Link"
                            value={newTool.config?.spreadsheetId || ''}
                            onChange={e => {
                                const val = e.target.value;
                                let finalId = val;
                                const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                                if (match && match[1]) {
                                    finalId = match[1];
                                    toast.success('Spreadsheet ID parsed successfully!');
                                }
                                setNewTool({...newTool, config: {...newTool.config, spreadsheetId: finalId}});
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-300">Spreadsheet Range</label>
                          <input 
                            className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-mono"
                            placeholder="Sheet1!A1"
                            value={newTool.config?.range || ''}
                            onChange={e => setNewTool({...newTool, config: {...newTool.config, range: e.target.value}})}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {newTool.tool_type === 'WEBHOOK' && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      {/* URL */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">
                          Endpoint URL
                        </label>
                        <input
                          value={newTool.url}
                          onChange={(e) =>
                            setNewTool({
                              ...newTool,
                              url: e.target.value,
                            })
                          }
                          placeholder="https://api.example.com/webhook"
                          className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-mono outline-none focus:border-primary transition"
                        />
                      </div>

                      {/* API KEY */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">API Key / Token (Secure)</label>
                        <input 
                          type="password"
                          className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-mono"
                          placeholder="••••••••••••••••"
                          value={newTool.api_key}
                          onChange={e => setNewTool({...newTool, api_key: e.target.value})}
                        />
                      </div>

                      {/* ADVANCED HTTP OPTIONS */}
                      <div className="border-t border-zinc-900 pt-4 mt-2 space-y-4">
                        <button 
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 hover:text-zinc-200 transition-colors"
                        >
                          {showAdvanced ? '− Hide' : '+ Show'} Advanced HTTP Settings
                        </button>

                        <div className={`space-y-4 overflow-hidden transition-all duration-305 ${showAdvanced ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-zinc-300">HTTP Method</label>
                              <select 
                                className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-semibold"
                                value={newTool.method}
                                onChange={e => setNewTool({...newTool, method: e.target.value})}
                              >
                                <option>GET</option>
                                <option>POST</option>
                                <option>PUT</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-zinc-300">Custom Headers (JSON)</label>
                              <input 
                                className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm outline-none focus:border-primary transition font-mono text-xs"
                                placeholder='{"X-Header": "Value"}'
                                onChange={e => {
                                  try {
                                    setNewTool({...newTool, headers: JSON.parse(e.target.value)});
                                  } catch(err) {}
                                }}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Body Template (JSON)</label>
                            <textarea 
                              rows={3}
                              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm outline-none resize-none focus:border-primary transition font-mono leading-relaxed text-xs"
                              placeholder='{ "query": "{{query}}" }'
                              value={newTool.body_template}
                              onChange={e => setNewTool({...newTool, body_template: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTIONS */}
                  <div className="flex items-center gap-3 pt-6 border-t border-zinc-900">
                    {newTool.tool_type === 'WEBHOOK' && (
                      <button
                        onClick={handleTestNewTool}
                        disabled={isTestingConfig}
                        className="flex-1 h-11 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition flex items-center justify-center gap-2"
                      >
                        {isTestingConfig ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                        Probe Path
                      </button>
                    )}

                    <button
                      onClick={handleSave}
                      className="flex-[1.5] h-11 rounded-xl bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition shadow-lg shadow-primary/10"
                    >
                      Save Tool Connection
                    </button>
                  </div>

                  {/* PROBE RESULTS */}
                  {testResult && (
                    <div className={`p-4 rounded-xl border flex items-center justify-between animate-in slide-in-from-top-2 ${
                      testResult.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-red-500/5 border-red-500/20 text-red-500'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${testResult.status === 'success' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                        <span className="text-xs font-semibold uppercase tracking-wider leading-none">
                          {testResult.status === 'success' ? `Node Online (HTTP ${testResult.code})` : `Probe Failed: ${testResult.error}`}
                        </span>
                      </div>
                      {testResult.status === 'success' && (
                        <button 
                          onClick={() => { setInspectorData(testResult.fullResponse); setShowInspector(true); }}
                          className="text-xs font-bold text-zinc-100 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 transition"
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
           <div className="bg-zinc-950 border border-zinc-800 w-full max-w-3xl max-h-[80vh] rounded-3xl flex flex-col shadow-2xl relative overflow-hidden">
              <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${inspectorData.code === 200 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {inspectorData.code || '200'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-zinc-100 uppercase tracking-widest">Response Inspector</h3>
                    <p className="text-xs text-zinc-550 font-bold uppercase tracking-wider mt-0.5 leading-none">Payload captured from live node</p>
                  </div>
                </div>
                <button onClick={() => setShowInspector(false)} className="p-2 text-zinc-500 hover:text-zinc-200 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                <div className="bg-zinc-900/50 border border-zinc-850 rounded-2xl p-6 font-mono text-xs leading-relaxed text-blue-400/80 max-h-[50vh] overflow-y-auto custom-scrollbar">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(inspectorData.response || inspectorData, null, 2)}</pre>
                </div>
              </div>

              <div className="p-4 border-t border-zinc-900 bg-zinc-950/50 flex justify-between items-center">
                <span className="text-xs text-zinc-550 font-bold uppercase tracking-wider opacity-60">Foundry Diagnostics v1.0</span>
                <span className="text-xs text-zinc-650 font-semibold italic">Data parsed successfully.</span>
              </div>
           </div>
        </div>
      )}

      {/* DECOMMISSION DIALOG */}
      <DecommissionModal 
        isOpen={!!decommissioningItem}
        onClose={() => setDecommissioningItem(null)}
        onConfirm={confirmDecommission}
        title="Disconnect Tool"
        itemName={decommissioningItem?.name || ''}
        loading={isDeleting}
      />
    </div>
  );
};
