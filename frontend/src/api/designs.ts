import { api } from "./client";

export type DesignSource = "UPLOAD" | "AI";

export interface Design {
  id: string;
  resource_url: string;
  source: DesignSource;
  created_at: string;
}

export interface GenerateResponse {
  candidates: Design[];
  credits_remaining: number;
}

export async function getCredits(): Promise<number> {
  return (await api.get<{ balance: number }>("/designs/credits")).data.balance;
}

export async function getRecentDesigns(): Promise<Design[]> {
  return (await api.get<Design[]>("/designs/recent")).data;
}

export async function uploadDesign(file: File): Promise<Design> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<Design>("/designs/upload", form)).data;
}

export async function generateDesigns(prompt: string): Promise<GenerateResponse> {
  return (await api.post<GenerateResponse>("/designs/generate", { prompt })).data;
}
