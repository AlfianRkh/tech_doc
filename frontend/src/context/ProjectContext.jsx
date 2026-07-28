import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getApiBaseUrl } from '../config';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProjectState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tf_active_project')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const BASE = getApiBaseUrl();
      const res = await fetch(`${BASE}/projects`, { headers: authHeaders() });
      const data = await res.json();
      setProjects(data);

      // Auto-set first project if no active project
      setActiveProjectState(prev => {
        if (!prev && data.length > 0) {
          localStorage.setItem('tf_active_project', JSON.stringify(data[0]));
          return data[0];
        }
        // Refresh active project data
        if (prev) {
          const updated = data.find(p => p.id === prev.id);
          if (updated) {
            localStorage.setItem('tf_active_project', JSON.stringify(updated));
            return updated;
          }
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const setActiveProject = (project) => {
    localStorage.setItem('tf_active_project', JSON.stringify(project));
    setActiveProjectState(project);
  };

  const createProject = async ({ name, code, description, color, icon }) => {
    const BASE = getApiBaseUrl();
    const res = await fetch(`${BASE}/projects`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, code, description, color, icon }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create project');
    await fetchProjects();
    return data;
  };

  const updateProject = async (id, updates) => {
    const BASE = getApiBaseUrl();
    const res = await fetch(`${BASE}/projects/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update project');
    await fetchProjects();
    return data;
  };

  const deleteProject = async (id) => {
    const BASE = getApiBaseUrl();
    const res = await fetch(`${BASE}/projects/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete project');
    await fetchProjects();
    if (activeProject?.id === id) {
      setActiveProject(projects.find(p => p.id !== id) || null);
    }
    return data;
  };

  useEffect(() => {
    if (token) fetchProjects();
  }, [token, fetchProjects]);

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      setActiveProject,
      fetchProjects,
      createProject,
      updateProject,
      deleteProject,
      loading,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider');
  return ctx;
}
