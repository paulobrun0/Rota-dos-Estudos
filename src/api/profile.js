import { apiRequest } from "./client.js";

export const updateProfile = (patch) => apiRequest("/api/me", { method: "PATCH", body: JSON.stringify(patch) });

export const changePassword = (currentPassword, newPassword) =>
  apiRequest("/api/me/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });

export const changeEmail = (currentPassword, newEmail) =>
  apiRequest("/api/me/change-email", { method: "POST", body: JSON.stringify({ currentPassword, newEmail }) });

// Downscales + re-encodes client-side so the upload stays small regardless
// of the source photo's resolution.
export function readImageAsDataUrl(file, maxSize = 200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("não foi possível ler o arquivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("arquivo não é uma imagem válida"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
