/**
 * Centralized API Base URL Configuration.
 * Priority:
 * 1. Custom URL set by user in Settings (stored in localStorage 'tf_api_url')
 * 2. Environment variable VITE_API_URL
 * 3. Default relative '/api' (proxied via Vite or same-origin)
 */
export function getApiBaseUrl() {
  const custom = localStorage.getItem('tf_api_url');
  if (custom && custom.trim()) {
    const trimmed = custom.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  if (import.meta.env.VITE_API_URL) {
    const envUrl = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
  }
  return '/api';
}

export function setApiBaseUrl(newUrl) {
  if (!newUrl || !newUrl.trim()) {
    localStorage.removeItem('tf_api_url');
  } else {
    localStorage.setItem('tf_api_url', newUrl.trim());
  }
  // Reload page to apply new API URL across all contexts
  window.location.reload();
}
