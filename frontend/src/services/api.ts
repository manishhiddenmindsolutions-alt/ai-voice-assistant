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
};

export const callsApi = {
  list: () => api.get('/calls/'),
  outbound: (data: any) => api.post('/calls/outbound', data),
};

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
};

export default api;
