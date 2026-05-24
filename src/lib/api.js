import { supabase } from './supabase.js';

export const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://astroknotsheep-meridian-api.hf.space';

/**
 * Always fetch a fresh access_token straight from Supabase. Supabase rotates
 * JWTs hourly; relying on a cached token in localStorage will produce silent
 * 401s. Returns null if there is no live session.
 */
export async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  // Keep localStorage in sync so anything legacy that reads it still works.
  localStorage.setItem('sb_token', data.session.access_token);
  return {
    Authorization: `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Thin fetch wrapper that injects fresh auth headers and surfaces HTTP status
 * back to the caller untouched (so consent-aware routing can react to 403).
 */
export async function apiFetch(path, options = {}) {
  const headers = await getAuthHeaders();
  if (!headers) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
}
