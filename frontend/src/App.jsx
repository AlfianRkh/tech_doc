import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider, useProject } from './context/ProjectContext';
import Sidebar from './components/Sidebar';
import ProjectSwitcher from './components/ProjectSwitcher';
import FlowCanvas from './components/canvas/FlowCanvas';
import NodesPage from './pages/NodesPage';
import FlowsPage from './pages/FlowsPage';
import DashboardPage from './pages/DashboardPage';
import MetricsPage from './pages/MetricsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import UsersRolesPage from './pages/UsersRolesPage';
import ProjectsPage from './pages/ProjectsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import SimulationsPage from './pages/SimulationsPage';
import DocumentsPage from './pages/DocumentsPage';
import { api } from './api/client';
import { getApiBaseUrl, setApiBaseUrl } from './config';

function ApiSettingsButton() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(() => getApiBaseUrl());

  const handleSave = (e) => {
    e.preventDefault();
    setApiBaseUrl(url);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Configure Backend API URL"
        style={{
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#3b82f6',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        ⚙ API URL
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '120%', left: 0,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 14, width: 280, zIndex: 2000,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 }}>
            Backend API Target URL
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>
            Enter your Backend URL if port or host changes (e.g. http://localhost:3001 or http://127.0.0.1:3001)
          </div>
          <form onSubmit={handleSave}>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="/api or http://localhost:3001/api"
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 10px', fontSize: 11, color: 'var(--text1)',
                outline: 'none', marginBottom: 10, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setApiBaseUrl(''); setOpen(false); }}
                style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--text3)', cursor: 'pointer' }}
              >
                Reset Default
              </button>
              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none',
                  borderRadius: 5, padding: '5px 12px', fontSize: 11, fontWeight: 600,
                  color: '#fff', cursor: 'pointer',
                }}
              >
                Save & Apply
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PlaceholderPage({ title, desc, icon }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{desc}</div>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Main app shell with sidebar & topbar
function AppShell() {
  const { user, logout } = useAuth();
  const { activeProject } = useProject();
  const [nodeTemplates, setNodeTemplates] = useState([]);

  useEffect(() => {
    api.getNodes(activeProject?.id).then(setNodeTemplates).catch(() => {});
  }, [activeProject?.id]);

  const ROLE_COLORS = { Admin: '#ef4444', Editor: '#3b82f6', Viewer: '#10b981' };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{
          height: 46, background: 'var(--bg2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px', flexShrink: 0, gap: 12,
        }}>
          {/* Left: project switcher + api config */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Active Repo:</span>
            <ProjectSwitcher />
            <ApiSettingsButton />
          </div>

          {/* Right: user + logout */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600, color: ROLE_COLORS[user.role_name] || '#8b5cf6', background: (ROLE_COLORS[user.role_name] || '#8b5cf6') + '1a', border: `1px solid ${(ROLE_COLORS[user.role_name] || '#8b5cf6')}30`, borderRadius: 4, padding: '2px 8px', fontSize: 10 }}>
                {user.role_name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{user.name}</span>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff',
              }}>
                {user.name?.[0]?.toUpperCase()}
              </div>
              <button
                id="logout-btn"
                onClick={logout}
                style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#ef4444', cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/canvas" replace />} />
            <Route path="/canvas" element={<FlowCanvas nodeTemplates={nodeTemplates} />} />
            <Route path="/canvas/:flowId" element={<FlowCanvas nodeTemplates={nodeTemplates} />} />
            <Route path="/nodes" element={<NodesPage />} />
            <Route path="/flows" element={<FlowsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/admin/users-roles" element={<UsersRolesPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/templates" element={<PlaceholderPage title="Templates" desc="Browse and use flow templates" icon="⊞" />} />
            <Route path="/simulations" element={<SimulationsPage />} />
            <Route path="/versioning" element={<PlaceholderPage title="Versioning" desc="Version control for your flows" icon="⎇" />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/reports" element={<PlaceholderPage title="Reports" desc="Generate and export detailed reports" icon="◨" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function AuthRouter() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/canvas" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/canvas" replace /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ProjectProvider>
              <AppShell />
            </ProjectProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
