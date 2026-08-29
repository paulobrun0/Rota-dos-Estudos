import { apiRequest } from "./client.js";

export const fetchUsers = () => apiRequest("/api/admin/users");

export const deleteUser = (id) => apiRequest(`/api/admin/users/${id}`, { method: "DELETE" });

export const setUserAdmin = (id, isAdmin) =>
  apiRequest(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ isAdmin }) });

export const setUserSuspended = (id, isSuspended) =>
  apiRequest(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ isSuspended }) });

export const setUserEmail = (id, email) =>
  apiRequest(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ email }) });

export const resetUserPassword = (id) =>
  apiRequest(`/api/admin/users/${id}/reset-password`, { method: "POST" });
