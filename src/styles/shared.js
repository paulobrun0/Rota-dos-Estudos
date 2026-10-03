import { colors } from "./colors.js";

export const inputStyle = {
  flex: 1, minWidth: 0, background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 10,
  color: colors.text, fontSize: 14, padding: "11px 14px", boxSizing: "border-box",
};
export const primaryBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, background: colors.accent, color: colors.onAccent,
  border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 13, fontWeight: 600, marginTop: 10,
};
export const secondaryBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, background: colors.surface2, color: colors.text,
  border: `1px solid ${colors.border}`, borderRadius: 10, padding: "8px 12px",
};
export const iconBtnStyle = {
  background: "transparent", border: "none", color: colors.textFaint, padding: 4, display: "flex", alignItems: "center",
};
export const navBtnStyle = {
  width: 34, height: 34, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface,
  color: colors.textMuted, display: "flex", alignItems: "center", justifyContent: "center",
};
