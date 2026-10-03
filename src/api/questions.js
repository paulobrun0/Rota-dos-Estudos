import { apiRequest } from "./client.js";

export function fetchQuestions({ assunto, materia, banca, limit } = {}) {
  const params = new URLSearchParams({ assunto });
  if (materia) params.set("materia", materia);
  if (banca) params.set("banca", banca);
  if (limit) params.set("limit", String(limit));
  return apiRequest(`/api/questions?${params.toString()}`);
}

export const fetchQuestionCounts = () => apiRequest("/api/questions/counts");

export function recordQuestionAttempt(attempt) {
  return apiRequest("/api/question-attempts", { method: "POST", body: JSON.stringify(attempt) });
}

export function fetchQuestionHistory({ concursoId, onlyErrors = false, search = "", offset = 0 }) {
  const params = new URLSearchParams({ concursoId, onlyErrors: String(onlyErrors), offset: String(offset), search });
  return apiRequest(`/api/question-history?${params}`);
}

export const fetchQuestion = (id) => apiRequest(`/api/questions/${id}`);
