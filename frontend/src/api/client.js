import { getApiBaseUrl } from '../config';

const BASE = getApiBaseUrl() || 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('tf_token');
}

async function req(method, path, body) {
  const BASE = getApiBaseUrl();
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function withProject(path, projectId) {
  if (!projectId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}project_id=${projectId}`;
}

export const api = {
  // Auth
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  register: (name, email, password) => req('POST', '/auth/register', { name, email, password }),
  forgotPassword: (email) => req('POST', '/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => req('POST', '/auth/reset-password', { token, newPassword }),
  getMe: () => req('GET', '/auth/me'),

  // Projects / Repos
  getProjects: () => req('GET', '/projects'),
  createProject: (data) => req('POST', '/projects', data),
  updateProject: (id, data) => req('PUT', `/projects/${id}`, data),
  deleteProject: (id) => req('DELETE', `/projects/${id}`),

  // Users
  getUsers: () => req('GET', '/users'),
  updateUserRole: (id, role_id) => req('PUT', `/users/${id}/role`, { role_id }),
  deleteUser: (id) => req('DELETE', `/users/${id}`),

  // Roles
  getRoles: () => req('GET', '/roles'),
  createRole: (data) => req('POST', '/roles', data),
  updateRole: (id, data) => req('PUT', `/roles/${id}`, data),
  deleteRole: (id) => req('DELETE', `/roles/${id}`),

  // Permissions Registry
  getPermissions: () => req('GET', '/permissions'),
  createPermission: (data) => req('POST', '/permissions', data),
  updatePermission: (id, data) => req('PUT', `/permissions/${id}`, data),
  deletePermission: (id) => req('DELETE', `/permissions/${id}`),

  // Node Templates (project-scoped)
  getNodes: (projectId) => req('GET', withProject('/nodes', projectId)),
  createNode: (data) => req('POST', '/nodes', data),
  updateNode: (id, data) => req('PUT', `/nodes/${id}`, data),
  deleteNode: (id) => req('DELETE', `/nodes/${id}`),

  // Flows (project-scoped)
  getFlows: (projectId) => req('GET', withProject('/flows', projectId)),
  getFlow: (id) => req('GET', `/flows/${id}`),
  createFlow: (data) => req('POST', '/flows', data),
  generateFlowByText: (text, projectId) => req('POST', '/flows/generate-text', { text, project_id: projectId }),
  updateFlow: (id, data) => req('PUT', `/flows/${id}`, data),
  deleteFlow: (id) => req('DELETE', `/flows/${id}`),

  // Flow Nodes
  addFlowNode: (flowId, data) => req('POST', `/flows/${flowId}/nodes`, data),
  updateFlowNode: (flowId, nodeId, data) => req('PUT', `/flows/${flowId}/nodes/${nodeId}`, data),
  deleteFlowNode: (flowId, nodeId) => req('DELETE', `/flows/${flowId}/nodes/${nodeId}`),

  // Flow Connections
  addConnection: (flowId, data) => req('POST', `/flows/${flowId}/connections`, data),
  deleteConnection: (flowId, connId) => req('DELETE', `/flows/${flowId}/connections/${connId}`),
  getConnections: (projectId, flowId, search) => {
    let path = '/connections';
    const params = [];
    if (projectId) params.push(`project_id=${projectId}`);
    if (flowId) params.push(`flow_id=${flowId}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (params.length) path += '?' + params.join('&');
    return req('GET', path);
  },

  // Simulations
  getSimulations: (projectId, flowId, search) => {
    let path = '/simulations';
    const params = [];
    if (projectId) params.push(`project_id=${projectId}`);
    if (flowId) params.push(`flow_id=${flowId}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (params.length) path += '?' + params.join('&');
    return req('GET', path);
  },
  createSimulation: (flowId, inputData = {}) =>
    req('POST', '/simulations', { flow_id: flowId, input_data: inputData }),
  getSimulation: (id) => req('GET', `/simulations/${id}`),
  getFlowSimulations: (flowId) => req('GET', `/simulations/flow/${flowId}`),
  deleteSimulation: (id) => req('DELETE', `/simulations/${id}`),

  // Dashboard & Metrics
  getDashboard: () => req('GET', '/dashboard'),
  getMetrics: () => req('GET', '/metrics'),
};
