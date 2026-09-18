import React from "react";
import { WEEKDAY_KEYS } from "../lib/planner.js";
import { colors } from "../styles/colors.js";

const SHORT_LABELS = { dom: "D", seg: "S", ter: "T", qua: "Q", qui: "Q", sex: "S", sab: "S" };

// A row of 7 toggle pills, one per weekday, for picking which days count as
// "study days" — used both in ajustes (the persistent setting) and the
// one-time onboarding nudge in App.jsx. `value` is an array of the selected
// WEEKDAY_KEYS; `onChange` receives the full new array on every click.
export function WeekdayToggle({ value, onChange }) {
  function toggle(day) {
    const set = new Set(value);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    onChange(WEEKDAY_KEYS.filter((d) => set.has(d)));
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      {WEEKDAY_KEYS.map((day) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            onClick={() => toggle(day)}
            title={day}
            style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              border: `1px solid ${active ? colors.amber : colors.border}`,
              background: active ? colors.amberSoft : colors.surface2,
              color: active ? colors.amber : colors.textMuted,
              fontSize: 12.5, fontWeight: 700, textTransform: "uppercase",
            }}
          >
            {SHORT_LABELS[day]}
          </button>
        );
      })}
    </div>
  );
}
