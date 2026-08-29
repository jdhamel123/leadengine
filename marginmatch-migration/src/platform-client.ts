/**
 * Host-independent browser client.
 * Replaces @appdeploy/client with standard fetch + pluggable auth.
 */
type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function token() {
  return localStorage.getItem('marginmatch_access_token') || '';
}

async function request<T = any>(method: string, path: string, body?: unknown): Promise<{ data: T }> {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  const accessToken = token();
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.error || data?.message || ('Request failed: ' + response.status);
    throw new Error(String(message));
  }
  return { data: data as T };
}

export const api = {
  get<T = any>(path: string) { return request<T>('GET', path); },
  post<T = any>(path: string, body?: unknown) { return request<T>('POST', path, body); },
};

export const auth = {
  isSignedIn(): boolean {
    return Boolean(token());
  },

  async validateSession(): Promise<boolean> {
    if (!token()) return false;
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token() },
        credentials: 'same-origin',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async signIn(): Promise<void> {
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = '/api/auth/sign-in?returnTo=' + returnTo;
  },

  setAccessToken(value: string) {
    localStorage.setItem('marginmatch_access_token', value);
  },

  signOut() {
    localStorage.removeItem('marginmatch_access_token');
  },
};
