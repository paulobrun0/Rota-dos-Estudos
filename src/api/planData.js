import { apiRequest } from "./client.js";

export async function fetchPlanData() {
  try {
    const { value } = await apiRequest("/api/data");
    return value;
  } catch {
    return null;
  }
}

export async function savePlanData(value) {
  try {
    await apiRequest("/api/data", { method: "PUT", body: JSON.stringify({ value }) });
  } catch {
    // ignore transient storage errors
  }
}
