import { apiRequest } from "./client.js";

export function fetchQuestions({ assunto, banca, limit } = {}) {
  const params = new URLSearchParams({ assunto });
  if (banca) params.set("banca", banca);
  if (limit) params.set("limit", String(limit));
  return apiRequest(`/api/questions?${params.toString()}`);
}

export const fetchQuestionCounts = () => apiRequest("/api/questions/counts");
