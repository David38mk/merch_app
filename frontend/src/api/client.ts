import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_BASE as string) ?? "/api";

export const api = axios.create({ baseURL: API_BASE });

const TOKEN_KEY = "mhc_token";

export function getToken(): string | null {
  // "Remember me" → localStorage (survives restart). Otherwise sessionStorage (dies with the tab).
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null, remember = true): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (token) {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If an authenticated request comes back 401, the session expired: drop the token
// and tell the app. Auth endpoints handle their own 401s (bad credentials).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url ?? "";
    const isAuthEndpoint = /\/auth\/(login|google|register)/.test(url);
    if (status === 401 && getToken() && !isAuthEndpoint) {
      setToken(null);
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  },
);
