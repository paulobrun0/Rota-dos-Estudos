import { colors } from "./colors.js";

export const inputStyle = {
  flex: 1, background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8,
  color: colors.text, fontSize: 14, padding: "9px 12px", boxSizing: "border-box", outline: "none",
};
export const primaryBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, background: colors.amber, color: "#241a08",
  border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, marginTop: 10,
};
export const secondaryBtnStyle = {
  display: "flex", alignItems: "center", gap: 6, background: colors.surface2, color: colors.text,
  border: `1px solid ${colors.border}`, borderRadius: 8, padding: "0 12px",
};
export const iconBtnStyle = {
  background: "transparent", border: "none", color: colors.textFaint, padding: 4, display: "flex", alignItems: "center",
};
export const navBtnStyle = {
  width: 30, height: 30, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface,
  color: colors.textMuted, display: "flex", alignItems: "center", justifyContent: "center",
};
