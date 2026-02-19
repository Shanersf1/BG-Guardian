// API base URL logic:
// - VITE_API_URL: set at build time for Capacitor/native app (e.g. http://192.168.1.10:3001/api or https://yourserver.com/api)
// - Dev + tunnel: /api (Vite proxy)
// - Dev + LAN: hostname:3001
// - Production web: /api (same origin)
function getApiBase() {
    const override = import.meta.env.VITE_API_URL;
    if (override) return override.replace(/\/$/, '');
    if (import.meta.env.DEV && typeof window !== 'undefined') {
        if (window.location.hostname.includes('trycloudflare.com') || window.location.hostname.includes('ngrok'))
            return '/api';
        return `${window.location.protocol}//${window.location.hostname}:3001/api`;
    }
    return '/api';
}
const API_BASE = getApiBase();

async function request(path, options = {}) {
    const url = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || `Request failed: ${res.status}`);
    }
    return data;
}

export const api = {
    getReadings: (limit = 50) => request(`/readings?limit=${limit}`),
    addReading: (reading) => request('/readings', { method: 'POST', body: JSON.stringify(reading) }),
    getSettings: () => request('/settings'),
    saveSettings: (settings) => request('/settings', { method: 'POST', body: JSON.stringify(settings) }),
    getConfig: () => request('/config'),
    saveConfig: (config) => request('/config', { method: 'POST', body: JSON.stringify(config) }),
    fetchCareLink: () => request('/fetch-carelink', { method: 'POST' }),
    getPushPublicKey: () => request('/push-public-key'),
    subscribePush: (subscription) => request('/push-subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
    unsubscribePush: (endpoint) => request('/push-unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),
};
