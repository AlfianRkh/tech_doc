import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import FlowCanvas from './components/canvas/FlowCanvas';
import NodesPage from './pages/NodesPage';
import FlowsPage from './pages/FlowsPage';
import DashboardPage from './pages/DashboardPage';
import MetricsPage from './pages/MetricsPage';
import { api } from './api/client';

function PlaceholderPage({ title, desc, icon }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{desc}</div>
    </div>
  );
}

export default function App() {
  const [nodeTemplates, setNodeTemplates] = useState([]);

  useEffect(() => {
    api.getNodes().then(setNodeTemplates).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Top bar */}
          <div style={{
            height: 38, background: 'var(--bg2)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>TechFlow Documentation Platform</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Admin</span>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff',
              }}>A</div>
            </div>
          </div>

          {/* Page content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/canvas" replace />} />
              <Route path="/canvas" element={<FlowCanvas nodeTemplates={nodeTemplates} />} />
              <Route path="/canvas/:flowId" element={<FlowCanvas nodeTemplates={nodeTemplates} />} />
              <Route path="/nodes" element={<NodesPage />} />
              <Route path="/flows" element={<FlowsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/connections" element={<PlaceholderPage title="Connections" desc="Manage external connections and integrations" icon="⤷" />} />
              <Route path="/templates" element={<PlaceholderPage title="Templates" desc="Browse and use flow templates" icon="⊞" />} />
              <Route path="/simulations" element={<PlaceholderPage title="Simulations" desc="Manage and review all simulation runs" icon="▷" />} />
              <Route path="/versioning" element={<PlaceholderPage title="Versioning" desc="Version control for your flows" icon="⎇" />} />
              <Route path="/documents" element={<PlaceholderPage title="Documents" desc="Documentation and technical guides" icon="⊟" />} />
              <Route path="/reports" element={<PlaceholderPage title="Reports" desc="Generate and export detailed reports" icon="◨" />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}
