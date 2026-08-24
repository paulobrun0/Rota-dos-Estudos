import { apiRequest } from "../api/client.js";

export const registerUser = (email, password) =>
  apiRequest("/api/register", { method: "POST", body: JSON.stringify({ email, password }) });

export const loginUser = (email, password) =>
  apiRequest("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const resetPassword = (email, recoveryCode, newPassword) =>
  apiRequest("/api/reset-password", { method: "POST", body: JSON.stringify({ email, recoveryCode, newPassword }) });

export const logoutUser = () => apiRequest("/api/logout", { method: "POST" });

export const fetchCurrentUser = () => apiRequest("/api/me");
