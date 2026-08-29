import { apiRequest } from "./client.js";

export const fetchRanking = () => apiRequest("/api/ranking");

export const setRankingVisibility = (showInRanking) =>
  apiRequest("/api/me", { method: "PATCH", body: JSON.stringify({ showInRanking }) });
