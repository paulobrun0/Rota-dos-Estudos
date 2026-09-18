import React, { useState } from "react";
import { colors } from "../styles/colors.js";
import { primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";
import { WEEKDAY_KEYS } from "../lib/planner.js";
import { WeekdayToggle } from "./WeekdayToggle.jsx";

// Shown once, on every tab, until the user picks their study days for the
// first time — either dismiss option (save a custom pick, or the "every
// day" shortcut) sets data.studyDays to a real array, which is what makes
// this stop rendering (see App.jsx's `data.studyDays === null` check).
export function StudyDaysBanner({ setStudyDays }) {
  const [selected, setSelected] = useState(WEEKDAY_KEYS);

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.amber}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.amber, marginBottom: 4 }}>quantos dias por semana você estuda?</div>
      <div style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 12 }}>
        marque os dias — num dia de fora, sua sequência não quebra, só espera você voltar. dá pra mudar depois em ajustes.
      </div>
      <div style={{ marginBottom: 12 }}>
        <WeekdayToggle value={selected} onChange={setSelected} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setStudyDays(selected)} style={{ ...primaryBtnStyle, marginTop: 0 }}>salvar</button>
        <button onClick={() => setStudyDays(WEEKDAY_KEYS)} style={secondaryBtnStyle}>estudo todo dia, sem descanso fixo</button>
      </div>
    </div>
  );
}
