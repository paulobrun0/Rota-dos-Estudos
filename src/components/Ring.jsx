import React from "react";
import { colors } from "../styles/colors.js";

export function Ring({ pct, size = 88 }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surface2} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.amber} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="sg" fontSize="18" fontWeight="700" fill={colors.text}>
        {pct}%
      </text>
    </svg>
  );
}
