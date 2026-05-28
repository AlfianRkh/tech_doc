const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Node Templates
  getNodes: () => req('GET', '/nodes'),
  createNode: (data) => req('POST', '/nodes', data),
  updateNode: (id, data) => req('PUT', `/nodes/${id}`, data),
  deleteNode: (id) => req('DELETE', `/nodes/${id}`),

  // Flows
  getFlows: () => req('GET', '/flows'),
  getFlow: (id) => req('GET', `/flows/${id}`),
  createFlow: (data) => req('POST', '/flows', data),
  generateFlowByText: (text) => req('POST', '/flows/generate-text', { text }),
  updateFlow: (id, data) => req('PUT', `/flows/${id}`, data),
  deleteFlow: (id) => req('DELETE', `/flows/${id}`),

  // Flow Nodes
  addFlowNode: (flowId, data) => req('POST', `/flows/${flowId}/nodes`, data),
  updateFlowNode: (flowId, nodeId, data) => req('PUT', `/flows/${flowId}/nodes/${nodeId}`, data),
  deleteFlowNode: (flowId, nodeId) => req('DELETE', `/flows/${flowId}/nodes/${nodeId}`),

  // Flow Connections
  addConnection: (flowId, data) => req('POST', `/flows/${flowId}/connections`, data),
  deleteConnection: (flowId, connId) => req('DELETE', `/flows/${flowId}/connections/${connId}`),

  // Simulations
  createSimulation: (flowId, inputData = {}) =>
    req('POST', '/simulations', { flow_id: flowId, input_data: inputData }),
  getSimulation: (id) => req('GET', `/simulations/${id}`),
  getFlowSimulations: (flowId) => req('GET', `/simulations/flow/${flowId}`),

  // Dashboard & Metrics
  getDashboard: () => req('GET', '/dashboard'),
  getMetrics: () => req('GET', '/metrics'),
};
