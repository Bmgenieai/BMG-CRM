const TOKEN_KEY = 'bmgenie_crm_token';

/** API origin for production (Vercel). Empty = same-origin `/api` (local Vite proxy / cPanel). */
export function apiBase() {
  const raw = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  return raw;
}

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = apiBase();
  return base ? `${base}/api${p}` : `/api${p}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    body:
      options.body && !(options.body instanceof FormData) && typeof options.body === 'object'
        ? JSON.stringify(options.body)
        : options.body,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Invalid response' };
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
