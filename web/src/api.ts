// Mesma origem em produção (a API serve o painel); proxy /api no dev.
const BASE = "/api";
const KEY = "mr_token";

export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t: string | null) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* sem storage */ } };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}), ...init.headers },
  });
  if (res.status === 401) { setToken(null); location.reload(); }
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
