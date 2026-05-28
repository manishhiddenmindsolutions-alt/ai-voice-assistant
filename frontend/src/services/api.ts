import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
});

// REQUEST INTERCEPTOR: Inject JWT Token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// RESPONSE INTERCEPTOR: Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: any) => api.post('/auth/register', null, { params: data }),
  login: (data: any) => {
    const params = new URLSearchParams();
    Object.keys(data).forEach(key => params.append(key, data[key]));
    return api.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  },
  me: () => api.get('/auth/me'),
  updateProfile: (data: { full_name?: string; avatar_url?: string }) => api.put('/auth/me', data),
};

export const agentApi = {
  list: () => api.get('/agents'),
  createOrUpdate: (data: any) => api.post('/agents', data),
  delete: (id: string) => api.delete(`/agents/${id}`),
  linkTool: (agent_id: string, tool_id: string) => api.post('/tools/link', null, { params: { agent_id, tool_id } }),
};

export const toolApi = {
  list: () => api.get('/tools/'),
  create: (tool: any) => api.post('/tools/', tool),
  delete: (id: string) => api.delete(`/tools/${id}`),
  test: (id: string) => api.post(`/tools/${id}/test`),
  testConfig: (config: any) => api.post('/tools/test-config', config),
};

export const sessionApi = {
  start: (config: any) => api.post('/sessions/start', config),
  health: () => api.get('/sessions/health'),
};

export const numbersApi = {
  list: () => api.get('/numbers/'),
  create: (data: any) => api.post('/numbers/', data),
  update: (id: string, data: any) => api.put(`/numbers/${id}`, data),
};

export const callsApi = {
  list: (params?: {
    direction?: string;
    status?: string;
    agent_id?: string;
    days?: number;
    limit?: number;
    offset?: number;
  }) => api.get('/calls/', { params }),
  detail: (id: string) => api.get(`/calls/${id}`),
  transcripts: (id: string) => api.get(`/calls/${id}/transcripts`),
  outbound: (data: any) => api.post('/calls/outbound', data),
  updateStatus: (id: string, status: string, duration?: number) =>
    api.put(`/calls/${id}/status`, null, { params: { status, duration } }),
};

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  analytics: (days?: number) => api.get('/dashboard/analytics', { params: { days: days || 30 } }),
};

export const telephonyApi = {
  // SIP Trunk Management
  provisionTrunks: (data: {
    termination_uri: string;
    auth_username: string;
    auth_password: string;
    phone_numbers: string[];
    trunk_name?: string;
  }) => api.post('/telephony/trunks', data),
  listTrunks: () => api.get('/telephony/trunks'),
  deleteTrunk: (id: string) => api.delete(`/telephony/trunks/${id}`),
  
  // Outbound Calls
  outbound: (data: { to_number: string; agent_id: string }) =>
    api.post('/telephony/outbound', data),
  
  // Status & Diagnostics
  status: () => api.get('/telephony/status'),
};

export const freeswitchApi = {
  // Outbound calls
  outbound: (data: { to_number: string; agent_id: string; gateway: string; caller_id?: string }) =>
    api.post('/telephony/freeswitch/outbound', data),
  // Status
  status: () => api.get('/settings/telephony'),
};

export const settingsApi = {
  // Telephony settings
  getTelephony: () => api.get('/settings/telephony'),
  updateTelephony: (data: any) => api.put('/settings/telephony', data),
  
  // General settings
  getGeneral: () => api.get('/settings/general'),
  updateGeneral: (data: any) => api.put('/settings/general', data),
  
  // Account info
  getAccount: () => api.get('/settings/account'),
};

export default api;
