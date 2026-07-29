/**
 * Centralized API Base URL Configuration.
 * Priority:
 * 1. Custom URL set by user in Settings (stored in localStorage 'tf_api_url')
 * 2. Environment variable VITE_API_URL
 * 3. Local vs Production auto-detection fallback
 */
export function getApiBaseUrl() {
  // 1. User manual override from UI settings
  const custom = localStorage.getItem('tf_api_url');
  if (custom && custom.trim()) {
    const trimmed = custom.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  // 2. Environment variable (e.g. set in .env file VITE_API_URL)
  if (import.meta.env.VITE_API_URL) {
    const envUrl = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
  }

  // 3. Fallback auto-detection for Local and Live
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    // Local development (localhost, 127.0.0.1, or local IP)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
      return `${protocol}//${hostname}:3001/api`;
    }
    // Live production domain fallback
    return `${protocol}//${hostname}:3001/api`;
  }

  return 'http://localhost:3001/api';
}

export function setApiBaseUrl(newUrl) {
  if (!newUrl || !newUrl.trim()) {
    localStorage.removeItem('tf_api_url');
  } else {
    localStorage.setItem('tf_api_url', newUrl.trim());
  }
  window.location.reload();
}
