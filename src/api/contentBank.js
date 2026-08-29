import { apiRequest } from "./client.js";

export const fetchContentBank = () => apiRequest("/api/content-bank");
