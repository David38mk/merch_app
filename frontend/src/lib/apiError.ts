import { AxiosError } from "axios";

/** Pull a human message out of an API error (FastAPI `detail`, incl. 422 arrays). */
export function apiError(e: unknown, fallback: string): string {
  if (e instanceof AxiosError) {
    const detail = e.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error,\s*/, "");
  }
  return fallback;
}
