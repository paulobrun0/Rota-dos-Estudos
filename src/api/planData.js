import { apiRequest } from "./client.js";

export async function fetchPlanData() {
  const result = await apiRequest("/api/data");
  if ((result.value !== null && typeof result.value !== "string") || !Number.isSafeInteger(result.revision) || result.revision < 0) {
    throw new Error("Resposta inválida ao carregar o plano. Atualize o aplicativo e tente novamente.");
  }
  return result;
}

export async function savePlanData(value, revision) {
  const result = await apiRequest("/api/data", { method: "PUT", body: JSON.stringify({ value, revision }) });
  if (!Number.isSafeInteger(result.revision) || result.revision <= revision) throw new Error("O servidor não confirmou o salvamento do plano.");
  return result;
}
