import React from "react";
import { colors } from "../styles/colors.js";

export function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="nav-item"
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
        borderRadius: 12, border: "none", background: active ? colors.accentSoft : "transparent",
        color: active ? colors.accent : colors.textMuted, fontSize: 14, fontWeight: 500,
        textAlign: "left", width: "100%",
      }}
    >
      <span style={{ color: active ? colors.accent : colors.textMuted }}>{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}
