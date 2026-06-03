const DEFAULT_API_BASE_URL = 'http://localhost:8000';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

/**
 * fetch() wrapper that attaches a Clerk session token as a Bearer header.
 * Pass `getToken` from Clerk's useAuth() hook.
 */
export async function authedFetch(url, options = {}, getToken) {
  const token = await getToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}