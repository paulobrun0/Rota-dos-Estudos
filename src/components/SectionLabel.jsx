import React from "react";
import { colors } from "../styles/colors.js";

export function SectionLabel({ text }) {
  return <div style={{ fontSize: 11.5, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint, margin: "18px 2px 10px", fontWeight: 600 }}>{text}</div>;
}
